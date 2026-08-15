'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { slugify, uniqueSlug } from '@/lib/slug'

export type NewProductResult = { ok: false; error: string }

export type NewProductInput = {
  nameEl: string
  nameEn: string
  sku: string
  type: string
  status: string
  price: string
  regularPrice: string
  stockStatus: string
  shortDescriptionEl: string
  categoryIds: string[]
  brandIds: string[]
}

/**
 * Creates the product HERE only.
 *
 * Local-first on purpose. The alternative — POST straight to WooCommerce —
 * would mean product creation is unavailable whenever writes are locked, which
 * is the normal state of this deployment, and it would put a half-filled
 * product on a live store while someone is still typing. Instead the product
 * exists locally with no wooId, and publishing it upstream is the same
 * explicit, gated, verified push every other change goes through.
 *
 * wooGroupKey is negative for locally created products. The pull keys on the
 * positive ids WordPress assigns, so a negative one cannot collide with a real
 * group and is obvious in the database as "never been upstream".
 */
export async function createLocalProduct(input: NewProductInput): Promise<NewProductResult> {
  await requirePermission('product.edit')

  const nameEl = input.nameEl.trim()
  if (!nameEl) return { ok: false, error: 'Το ελληνικό όνομα είναι υποχρεωτικό.' }

  const price = input.price.trim()
  const regular = input.regularPrice.trim()
  if (price && Number.isNaN(Number(price))) return { ok: false, error: 'Η τιμή πρέπει να είναι αριθμός.' }
  if (regular && Number.isNaN(Number(regular))) return { ok: false, error: 'Η κανονική τιμή πρέπει να είναι αριθμός.' }

  const sku = input.sku.trim()
  if (sku) {
    const clash = await prisma.product.findFirst({ where: { sku }, include: { translations: true } })
    if (clash) {
      const name = clash.translations.find(t => t.locale === 'el')?.name ?? clash.id
      return { ok: false, error: `Το SKU «${sku}» χρησιμοποιείται ήδη από το «${name}».` }
    }
  }

  // Slugs are the storefront's lookup key, so they must be unique per locale
  // and must survive Greek input — see lib/slug.ts.
  const taken = (locale: string) => async (candidate: string) =>
    !!(await prisma.productTranslation.findFirst({ where: { locale, slug: candidate } }))

  const slugEl = await uniqueSlug(slugify(nameEl, 'proion'), taken('el'))
  const nameEn = input.nameEn.trim()
  const slugEn = nameEn ? await uniqueSlug(slugify(nameEn, 'product'), taken('en')) : null

  const lowest = await prisma.product.aggregate({ _min: { wooGroupKey: true } })
  const groupKey = Math.min(0, lowest._min.wooGroupKey ?? 0) - 1

  const product = await prisma.product.create({
    data: {
      wooGroupKey: groupKey,
      sku: sku || null,
      type: input.type,
      status: input.status,
      price: price || null,
      regularPrice: regular || null,
      onSale: !!price && !!regular && Number(price) < Number(regular),
      stockStatus: input.stockStatus,
      attributes: [],
      translations: {
        create: [
          {
            locale: 'el',
            // Null wooId marks it as not existing upstream, which is what the
            // push reads to decide between creating and updating.
            wooId: null,
            name: nameEl,
            slug: slugEl,
            shortDescription: input.shortDescriptionEl.trim() || null,
          },
          ...(nameEn && slugEn
            ? [{ locale: 'en', wooId: null, name: nameEn, slug: slugEn }]
            : []),
        ],
      },
      categories: {
        create: input.categoryIds.map(categoryId => ({ categoryId })),
      },
      brands: {
        create: input.brandIds.map(brandId => ({ brandId })),
      },
    },
  })

  revalidatePath('/products')
  redirect(`/products/${product.id}`)
}
