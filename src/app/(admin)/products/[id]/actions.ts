'use server'

import { revalidatePath } from 'next/cache'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { bunnyUpload, cdnUrlFor } from '@/lib/bunny'
import { buildDerivatives, contentHash, imageDimensions, storageKeyFor } from '@/lib/images'
import {
  executeUpdate, planCreate, planProductUpdate, readBack, readGate, verifyFields,
  type FieldVerdict, type WritePlan,
} from '@/lib/woo/write'
import { isDeepSeekConfigured, translateProductFields } from '@/lib/deepseek'
import { normalizeAttributes, toWooPayload } from '@/lib/woo/attributes'
import { slugify } from '@/lib/slug'

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
  await renumber(productId)
  revalidatePath(`/products/${productId}`)
  return { ok: true, message: 'Η εικόνα αφαιρέθηκε από το προϊόν (παραμένει στο Bunny).' }
}

/**
 * Persists a drag-and-drop reorder. Position 0 is the main photo — the one
 * WooCommerce shows as the product thumbnail everywhere.
 *
 * Ids not present in `assetIds` keep their existing relative order and are
 * appended, so a stale client (someone else added an image in another tab)
 * cannot silently drop images from the gallery.
 */
export async function reorderProductImages(
  productId: string,
  assetIds: string[],
): Promise<ActionResult> {
  await requirePermission('product.edit')

  const current = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
    select: { assetId: true },
  })
  const known = new Set(current.map(i => i.assetId))

  const ordered = assetIds.filter(id => known.has(id))
  const missing = current.map(i => i.assetId).filter(id => !ordered.includes(id))
  const final = [...ordered, ...missing]

  await prisma.$transaction(
    final.map((assetId, position) =>
      prisma.productImage.update({
        where: { productId_assetId: { productId, assetId } },
        data: { position },
      }),
    ),
  )

  revalidatePath(`/products/${productId}`)
  revalidatePath('/products')
  return {
    ok: true,
    message: missing.length
      ? `Η σειρά αποθηκεύτηκε. ${missing.length} εικόνες προστέθηκαν στο τέλος (είχαν αλλάξει αλλού).`
      : 'Η σειρά αποθηκεύτηκε. Η πρώτη εικόνα είναι πλέον η κύρια.',
  }
}

async function renumber(productId: string) {
  const rows = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
    select: { assetId: true },
  })
  await prisma.$transaction(
    rows.map((r, position) =>
      prisma.productImage.update({
        where: { productId_assetId: { productId, assetId: r.assetId } },
        data: { position },
      }),
    ),
  )
}

/**
 * Local-only attribute edit. Options are free text for product-local
 * attributes; for global ones (id > 0) WooCommerce will only accept options
 * that already exist as taxonomy terms, which the editor warns about.
 */
export async function saveProductAttributes(
  productId: string,
  attributes: unknown,
): Promise<ActionResult> {
  await requirePermission('product.edit')

  const normalized = normalizeAttributes(attributes)
  await prisma.product.update({
    where: { id: productId },
    data: { attributes: normalized as object },
  })

  revalidatePath(`/products/${productId}`)
  return {
    ok: true,
    message: `${normalized.length} χαρακτηριστικά αποθηκεύτηκαν τοπικά. Δεν στάλθηκαν στο WooCommerce.`,
  }
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


// ── Push to WooCommerce ────────────────────────────────────
//
// Everything below crosses the boundary into a live store. Nothing here sends
// anything without an explicit `confirmed: true` from the caller AND the two
// environment gates in lib/woo/write.ts being open.

/** Which groups of fields the operator chose to send. */
export type PushScope = {
  /** name, short_description, description — per locale. */
  content: boolean
  /** sku, status, regular_price, stock_status — shared across locales. */
  pricing: boolean
  /** The whole attribute set. WooCommerce replaces it wholesale. */
  attributes: boolean
  /** The whole gallery, in editor order. WooCommerce replaces it wholesale. */
  images: boolean
}

export type PushPreview = {
  plans: { locale: string; wooId: number; plan: WritePlan }[]
  gate: { allowWrites: boolean; dryRun: boolean; environment: string }
  /** Translations that exist only here and therefore cannot be pushed. */
  skipped: string[]
  warnings: string[]
}

/**
 * Builds — but does not send — the payload for each language post.
 *
 * Polylang makes every language a separate WordPress post with its own id,
 * gallery and attribute set, so a product edit is N updates, not one. Shared
 * fields (price, stock, attributes, images) are repeated in each; only the
 * copy differs.
 */
export async function previewProductPush(
  productId: string,
  scope: PushScope,
): Promise<PushPreview> {
  await requirePermission('product.view')

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: {
      translations: true,
      images: { include: { asset: true }, orderBy: { position: 'asc' } },
    },
  })

  const warnings: string[] = []

  /** False for a product created here that has never been published upstream. */
  const existsUpstream = product.translations.some(t => t.wooId !== null)

  // WordPress sideloads each src, so the Bunny CDN url is what it fetches.
  // The FULL gallery goes every time: a partial array deletes the rest.
  const images = product.images.map(pi => ({ src: pi.asset.cdnUrl, alt: pi.alt ?? '' }))

  // Only a real warning when there is something upstream to destroy. On a
  // create there is no gallery yet, and telling the operator their send will
  // WIPE one is both false and alarming at the exact moment it matters.
  if (scope.images && images.length === 0 && existsUpstream) {
    warnings.push('Το προϊόν δεν έχει εικόνες — η αποστολή θα ΣΒΗΣΕΙ τη συλλογή στο WooCommerce.')
  }

  const attributes = normalizeAttributes(product.attributes)
  const globals = attributes.filter(a => a.id > 0)
  if (scope.attributes && globals.length) {
    warnings.push(
      `${globals.length} χαρακτηριστικά είναι καθολικά (taxonomy). Το WooCommerce δέχεται μόνο ` +
      'τιμές που υπάρχουν ήδη ως όροι — νέες τιμές αγνοούνται σιωπηλά.',
    )
  }

  const shared: Record<string, unknown> = {}
  if (scope.pricing) {
    shared.sku = product.sku ?? ''
    shared.status = product.status
    // `price` is read-only in the WooCommerce REST API — it is computed from
    // regular_price and sale_price. Sending it is ignored, so it is left out.
    shared.regular_price = product.regularPrice?.toString() ?? ''
    shared.stock_status = product.stockStatus
  }
  // An empty array is a deliberate "remove everything" on an update, and
  // meaningless noise on a create — WooCommerce has nothing to clear.
  if (scope.attributes && (attributes.length > 0 || existsUpstream)) {
    shared.attributes = toWooPayload(attributes)
  }
  if (scope.images && (images.length > 0 || existsUpstream)) {
    shared.images = images
  }

  // Greek first, always. When the product is new, the Greek post has to exist
  // before the English one can name it as its translation group.
  const ordered = [...product.translations].sort((a, b) =>
    a.locale === 'el' ? -1 : b.locale === 'el' ? 1 : a.locale.localeCompare(b.locale))

  const plans = ordered.map(t => {
    const body: Record<string, unknown> = { ...shared }

    if (t.wooId === null) {
      // A create must carry the copy even when only pricing was ticked: a
      // WooCommerce product with no name is not a product.
      body.name = t.name
      body.slug = t.slug
      body.short_description = t.shortDescription ?? ''
      if (t.description) body.description = t.description
      body.type = product.type
      body.status = product.status
      body.sku = product.sku ?? ''
      body.regular_price = product.regularPrice?.toString() ?? ''
      body.stock_status = product.stockStatus
      // Polylang exposes `lang` on the products endpoint — verified against
      // the live store — and it is what puts the new post in the right
      // language rather than the site default.
      body.lang = t.locale
      return { locale: t.locale, wooId: 0, plan: planCreate('products', body) }
    }

    if (scope.content) {
      body.name = t.name
      body.short_description = t.shortDescription ?? ''
      if (t.description) body.description = t.description
    }
    return { locale: t.locale, wooId: t.wooId, plan: planProductUpdate(t.wooId, body) }
  }).filter(p => Object.keys(p.plan.body).length > 0)

  const creating = ordered.filter(t => t.wooId === null).map(t => t.locale)
  if (creating.length) {
    warnings.push(
      `Οι γλώσσες ${creating.join(', ')} ΔΕΝ υπάρχουν ακόμα στο WooCommerce και θα ` +
      'ΔΗΜΙΟΥΡΓΗΘΟΥΝ ως νέα προϊόντα. Η ενέργεια δεν αναιρείται από εδώ.',
    )
  }

  return { plans, gate: readGate(), skipped: [], warnings }
}

export type PushReport = {
  locale: string
  wooId: number
  verdicts: FieldVerdict[]
  ok: boolean
}

export type PushResult =
  | { ok: true; message: string; reports: PushReport[] }
  | { ok: false; error: string; reports?: PushReport[] }

/**
 * Sends the selected fields, then READS EACH POST BACK and diffs it.
 *
 * The read-back is the whole point. WooCommerce's PUT response echoes the
 * request, so a 200 proves only that the request was accepted — not that the
 * store changed. A separate GET afterwards is the only evidence that it did,
 * and it is what catches the silent no-op class of failure we already hit on
 * the SoftOne side with `MTRGROUP`.
 */
export async function pushProductToWoo(
  productId: string,
  scope: PushScope,
  confirmed: boolean,
): Promise<PushResult> {
  await requirePermission('sync.push')

  if (!confirmed) return { ok: false, error: 'Απαιτείται ρητή επιβεβαίωση πριν την αποστολή.' }
  if (!Object.values(scope).some(Boolean)) {
    return { ok: false, error: 'Δεν επιλέχθηκε κανένα πεδίο για αποστολή.' }
  }

  const preview = await previewProductPush(productId, scope)
  if (!preview.plans.length) {
    return { ok: false, error: 'Καμία μετάφραση δεν έχει wooId — δεν υπάρχει τίποτα να σταλεί.' }
  }

  const reports: PushReport[] = []
  /** Ids assigned during this run, so the second language can link to the first. */
  const created = new Map<string, number>()

  for (const { locale, wooId, plan } of preview.plans) {
    const body = { ...plan.body }

    // Link the new post into the existing translation group. Without this
    // Polylang leaves it as a standalone product in that language and the two
    // never appear as each other's translation.
    if (plan.method === 'POST' && created.size > 0) {
      body.translations = Object.fromEntries(created)
    }

    let response: Record<string, unknown>
    try {
      response = await executeUpdate({
        ...plan,
        body,
        wouldExecute: plan.gate.allowWrites && !plan.gate.dryRun,
      })
    } catch (err) {
      return {
        ok: false,
        error: `Απέτυχε η αποστολή για ${locale}${wooId ? ` (#${wooId})` : ''}: ${err instanceof Error ? err.message : String(err)}`,
        reports,
      }
    }

    let id = wooId
    if (plan.method === 'POST') {
      id = Number(response.id ?? 0)
      if (!id) {
        return { ok: false, error: `Το WooCommerce δεν επέστρεψε id για τη γλώσσα ${locale}.`, reports }
      }
      // Recorded immediately: if a later language fails, the product must not
      // be created a second time on the next attempt.
      await prisma.productTranslation.update({
        where: { productId_locale: { productId, locale } },
        data: { wooId: id },
      })
      created.set(locale, id)
    }

    // Read back from the store, not from the response, which merely echoes.
    const live = await readBack('products', id)
    const verdicts = verifyFields(body, live)
    reports.push({ locale, wooId: id, verdicts, ok: verdicts.every(v => v.match) })
  }

  revalidatePath(`/products/${productId}`)
  revalidatePath('/products')

  const failed = reports.filter(r => !r.ok)
  if (failed.length) {
    const fields = failed.flatMap(r => r.verdicts.filter(v => !v.match).map(v => `${r.locale}.${v.field}`))
    return {
      ok: false,
      error: `Η αποστολή έγινε δεκτή αλλά ο έλεγχος ανάγνωσης ΔΕΝ επιβεβαίωσε: ${fields.join(', ')}.`,
      reports,
    }
  }

  return {
    ok: true,
    message: `Επιβεβαιωμένο στο WooCommerce: ${reports.map(r => `${r.locale} #${r.wooId}`).join(', ')}.`,
    reports,
  }
}

/**
 * Reads the product back from WooCommerce and compares it with what is stored
 * here — without writing anything. This is the safe half of the verification
 * the operator asked for: it answers "is the store in sync?" with no risk.
 */
export async function verifyAgainstWoo(productId: string): Promise<PushResult> {
  await requirePermission('product.view')

  const preview = await previewProductPush(productId, {
    content: true, pricing: true, attributes: true, images: true,
  })
  if (!preview.plans.length) {
    return { ok: false, error: 'Καμία μετάφραση δεν έχει wooId — δεν υπάρχει τίποτα να ελεγχθεί.' }
  }

  const reports: PushReport[] = []
  for (const { locale, wooId, plan } of preview.plans) {
    try {
      const live = await readBack('products', wooId)
      const verdicts = verifyFields(plan.body, live)
      reports.push({ locale, wooId, verdicts, ok: verdicts.every(v => v.match) })
    } catch (err) {
      return { ok: false, error: `Απέτυχε η ανάγνωση #${wooId}: ${String(err)}`, reports }
    }
  }

  const drifted = reports.flatMap(r => r.verdicts.filter(v => !v.match).map(v => `${r.locale}.${v.field}`))
  return drifted.length
    ? { ok: false, error: `Διαφορές με το WooCommerce: ${drifted.join(', ')}.`, reports }
    : { ok: true, message: 'Το WooCommerce συμφωνεί με τα τοπικά δεδομένα σε όλα τα πεδία.', reports }
}
