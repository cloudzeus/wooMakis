'use server'

import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { bunnyUpload, cdnUrlFor } from '@/lib/bunny'
import { buildDerivatives, contentHash, imageDimensions, storageKeyFor } from '@/lib/images'
import { executeProductUpdate, planProductUpdate, type WritePlan } from '@/lib/woo/write'
import { isDeepSeekConfigured, translateProductFields } from '@/lib/deepseek'

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

/** Local-only edit. Never touches WooCommerce. */
export async function saveProductFields(
  productId: string,
  form: {
    sku: string
    status: string
    price: string
    regularPrice: string
    stockStatus: string
    translations: { locale: string; name: string; shortDescription: string }[]
  },
): Promise<ActionResult> {
  await requirePermission('product.edit')

  const price = form.price.trim()
  const regular = form.regularPrice.trim()
  if (price && Number.isNaN(Number(price))) return { ok: false, error: 'Η τιμή πρέπει να είναι αριθμός.' }
  if (regular && Number.isNaN(Number(regular))) return { ok: false, error: 'Η κανονική τιμή πρέπει να είναι αριθμός.' }

  await prisma.product.update({
    where: { id: productId },
    data: {
      sku: form.sku.trim() || null,
      status: form.status,
      price: price || null,
      regularPrice: regular || null,
      // Recomputed here for the same reason the pull derives it: Woo's own
      // sale fields are unreadable on this site.
      onSale: !!price && !!regular && Number(price) < Number(regular),
      stockStatus: form.stockStatus,
    },
  })

  for (const t of form.translations) {
    await prisma.productTranslation.updateMany({
      where: { productId, locale: t.locale },
      data: { name: t.name.trim(), shortDescription: t.shortDescription.trim() || null },
    })
  }

  revalidatePath(`/products/${productId}`)
  revalidatePath('/products')
  return { ok: true, message: 'Οι αλλαγές αποθηκεύτηκαν τοπικά. Δεν στάλθηκαν στο WooCommerce.' }
}

/**
 * Converts an upload to WebP, stores it on Bunny, and attaches it to the
 * product locally. Writes to BunnyCDN only — WooCommerce is untouched until
 * pushProductImages is called separately.
 */
export async function uploadProductImage(productId: string, formData: FormData): Promise<ActionResult> {
  await requirePermission('media.upload')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Δεν επιλέχθηκε αρχείο.' }
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Το αρχείο πρέπει να είναι εικόνα.' }
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: 'Το αρχείο ξεπερνά τα 15 MB.' }

  const input = Buffer.from(await file.arrayBuffer())

  // WebP is the stored master, per the request. quality 82 is visually lossless
  // for product photography at these sizes while roughly halving the bytes.
  const webp = await sharp(input).webp({ quality: 82 }).toBuffer()

  const hash = contentHash(webp)
  const existing = await prisma.mediaAsset.findUnique({ where: { contentHash: hash } })

  let assetId: string
  if (existing) {
    assetId = existing.id
  } else {
    const key = storageKeyFor(hash, 'original', 'webp')
    await bunnyUpload(key, webp, 'image/webp')
    const derivatives = await buildDerivatives(hash, webp)
    for (const d of derivatives) await bunnyUpload(d.key, d.body, `image/${d.format}`)
    const { width, height } = await imageDimensions(webp)

    const asset = await prisma.mediaAsset.create({
      data: {
        contentHash: hash,
        sourceUrl: cdnUrlFor(key), // locally originated — Bunny is the source
        storageKey: key,
        cdnUrl: cdnUrlFor(key),
        mimeType: 'image/webp',
        bytes: webp.byteLength,
        width, height,
        derivatives: derivatives.map(d => ({ width: d.width, format: d.format, key: d.key })),
        mirroredAt: new Date(),
      },
    })
    assetId = asset.id
  }

  const count = await prisma.productImage.count({ where: { productId } })
  await prisma.productImage.upsert({
    where: { productId_assetId: { productId, assetId } },
    update: {},
    create: { productId, assetId, position: count, alt: null },
  })

  revalidatePath(`/products/${productId}`)
  return {
    ok: true,
    message: `Η εικόνα μετατράπηκε σε WebP (${Math.round(webp.byteLength / 1024)} KB) και ανέβηκε στο Bunny.`,
  }
}

export async function removeProductImage(productId: string, assetId: string): Promise<ActionResult> {
  await requirePermission('media.delete')
  await prisma.productImage.deleteMany({ where: { productId, assetId } })
  revalidatePath(`/products/${productId}`)
  return { ok: true, message: 'Η εικόνα αφαιρέθηκε από το προϊόν (παραμένει στο Bunny).' }
}

/**
 * Translates a product into `toLocale` with DeepSeek and saves the result
 * locally. Works for a locale that already exists (retranslate) and for one
 * that does not (fill the gap) — 20 of the 214 products exist in one language
 * only.
 *
 * Nothing is sent to WooCommerce. A translation row created here has wooId
 * null, meaning it has no upstream post yet; publishing it would mean creating
 * a Polylang post and linking the translation group, which is a separate
 * operation deferred to phase 4.
 */
export async function translateProduct(
  productId: string,
  toLocale: string,
): Promise<ActionResult> {
  await requirePermission('product.edit')

  if (!isDeepSeekConfigured()) {
    return { ok: false, error: 'Λείπει το DEEPSEEK_API_KEY στο .env — η μετάφραση είναι απενεργοποιημένη.' }
  }
  if (!['el', 'en'].includes(toLocale)) {
    return { ok: false, error: `Μη υποστηριζόμενη γλώσσα: ${toLocale}` }
  }

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { translations: true },
  })

  // Prefer Greek as the source — it is the language the catalog is authored in.
  const source =
    product.translations.find(t => t.locale !== toLocale && t.locale === 'el')
    ?? product.translations.find(t => t.locale !== toLocale)
  if (!source) return { ok: false, error: 'Δεν υπάρχει γλώσσα-πηγή για μετάφραση.' }

  let translated
  try {
    translated = await translateProductFields(
      { name: source.name, shortDescription: source.shortDescription, description: source.description },
      source.locale,
      toLocale,
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const existing = product.translations.find(t => t.locale === toLocale)
  if (existing) {
    await prisma.productTranslation.update({
      where: { productId_locale: { productId, locale: toLocale } },
      data: {
        name: translated.name,
        shortDescription: translated.shortDescription || null,
        description: translated.description || null,
      },
    })
  } else {
    await prisma.productTranslation.create({
      data: {
        productId,
        locale: toLocale,
        // No upstream post exists for this language yet.
        wooId: null,
        name: translated.name,
        slug: slugify(translated.name),
        shortDescription: translated.shortDescription || null,
        description: translated.description || null,
      },
    })
  }

  revalidatePath(`/products/${productId}`)
  revalidatePath('/products')
  return {
    ok: true,
    message: existing
      ? `Η μετάφραση «${toLocale}» ενημερώθηκε από «${source.locale}».`
      : `Δημιουργήθηκε νέα μετάφραση «${toLocale}» από «${source.locale}». Δεν έχει σταλεί στο WooCommerce.`,
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 190) || 'product'
}

export type PushPreview = {
  plans: { locale: string; wooId: number; plan: WritePlan }[]
  gate: { allowWrites: boolean; dryRun: boolean; environment: string }
  gallery: { src: string; alt: string | null }[]
}

/**
 * Builds — but does not send — the WooCommerce payload for this product's
 * gallery. WordPress sideloads each `src`, so the Bunny CDN url is what gets
 * pulled into the media library.
 *
 * The FULL gallery is always sent: WooCommerce replaces the image set wholesale,
 * so a partial array silently deletes the omitted images.
 */
export async function previewImagePush(productId: string): Promise<PushPreview> {
  await requirePermission('product.view')

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: {
      translations: true,
      images: { include: { asset: true }, orderBy: { position: 'asc' } },
    },
  })

  const gallery = product.images.map(pi => ({ src: pi.asset.cdnUrl, alt: pi.alt }))

  // Locally created translations have no upstream post, so there is nothing to
  // update for them — they are skipped rather than silently creating a post.
  const plans = product.translations
    .filter((t): t is typeof t & { wooId: number } => t.wooId !== null)
    .map(t => ({
      locale: t.locale,
      wooId: t.wooId,
      plan: planProductUpdate(t.wooId, { images: gallery.map(g => ({ src: g.src, alt: g.alt ?? '' })) }),
    }))

  const { allowWrites, dryRun, environment } = plans[0]?.plan.gate
    ?? { allowWrites: false, dryRun: true, environment: 'unknown' }

  return { plans, gate: { allowWrites, dryRun, environment }, gallery }
}

/**
 * Sends the gallery to WooCommerce. Requires product.edit AND the SUPER_ADMIN
 * role via sync.push, plus all three gates in lib/woo/write.ts.
 */
export async function pushImagesToWoo(productId: string, confirmed: boolean): Promise<ActionResult> {
  await requirePermission('sync.push')

  if (!confirmed) return { ok: false, error: 'Απαιτείται ρητή επιβεβαίωση πριν την αποστολή.' }

  const preview = await previewImagePush(productId)
  if (!preview.plans.length) return { ok: false, error: 'Το προϊόν δεν έχει wooId — δεν μπορεί να σταλεί.' }

  const results: string[] = []
  for (const { locale, wooId, plan } of preview.plans) {
    const confirmedPlan = { ...plan, wouldExecute: plan.gate.allowWrites && !plan.gate.dryRun && true }
    try {
      await executeProductUpdate(confirmedPlan)
      results.push(`${locale} (#${wooId}) ✓`)
    } catch (err) {
      return { ok: false, error: `Απέτυχε για ${locale} (#${wooId}): ${String(err)}` }
    }
  }

  revalidatePath(`/products/${productId}`)
  return { ok: true, message: `Στάλθηκε στο WooCommerce: ${results.join(', ')}` }
}
