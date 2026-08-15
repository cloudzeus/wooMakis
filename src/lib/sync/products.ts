import { prisma } from '@/lib/prisma'
import { listProducts, listVariations } from '@/lib/woo/client'
import { decodeEntities, groupByTranslation } from '@/lib/woo/translation-groups'
import type { WooImage, WooProduct, WooProductAttribute } from '@/lib/woo/types'

/**
 * Woo's `sale_price` and `on_sale` cannot be read — requesting either returns
 * HTTP 500 from the source site (spec §2.1). Sale state is inferred instead.
 */
export function deriveOnSale(price: string, regularPrice: string): boolean {
  const p = Number.parseFloat(price)
  const r = Number.parseFloat(regularPrice)
  if (!Number.isFinite(p) || !Number.isFinite(r)) return false
  return p < r
}

/**
 * Woo is inconsistent about numeric scalars — `total_sales` arrives as the string
 * "0" on some posts and as a number on others, which Postgres rejects for an Int
 * column. Coerce rather than trusting the declared type.
 */
function toInt(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : 0
}

export type ProductTranslationUpsert = {
  locale: string
  wooId: number
  name: string
  slug: string
  description: string | null
  shortDescription: string | null
  permalink: string | null
  wooModifiedAt: Date | null
  wooSnapshot: WooProduct
}

export type ProductUpsert = {
  wooGroupKey: number
  sku: string | null
  type: string
  status: string
  featured: boolean
  price: string | null
  regularPrice: string | null
  onSale: boolean
  manageStock: boolean
  stockQuantity: number | null
  stockStatus: string
  menuOrder: number
  totalSales: number
  categoryWooIds: number[]
  brandWooIds: number[]
  attributes: WooProductAttribute[]
  images: WooImage[]
  variationWooIds: number[]
  translations: ProductTranslationUpsert[]
}

/** Pure: Woo posts → one upsert per logical product. */
export function toProductUpserts(posts: WooProduct[]): ProductUpsert[] {
  return groupByTranslation(posts).map(g => {
    const locales = Object.entries(g.byLocale)
    // Language-neutral fields are identical across translations; prefer Greek
    // as the canonical source, falling back to whatever locale exists.
    const canonical = g.byLocale.el ?? locales[0][1]

    const images: WooImage[] = []
    const seenSrc = new Set<string>()
    for (const [, post] of locales) {
      for (const img of post.images ?? []) {
        if (!seenSrc.has(img.src)) { seenSrc.add(img.src); images.push(img) }
      }
    }

    const categoryWooIds = [...new Set(locales.flatMap(([, p]) => (p.categories ?? []).map(c => c.id)))]
    const brandWooIds = [...new Set(locales.flatMap(([, p]) => (p.brands ?? []).map(b => b.id)))]
    const variationWooIds = [...new Set(locales.flatMap(([, p]) => p.variations ?? []))]

    return {
      wooGroupKey: g.groupKey,
      sku: canonical.sku || null,
      type: canonical.type,
      status: canonical.status,
      featured: canonical.featured,
      price: canonical.price || null,
      regularPrice: canonical.regular_price || null,
      onSale: deriveOnSale(canonical.price, canonical.regular_price),
      manageStock: canonical.manage_stock,
      stockQuantity: canonical.stock_quantity == null ? null : toInt(canonical.stock_quantity),
      stockStatus: canonical.stock_status,
      menuOrder: toInt(canonical.menu_order),
      totalSales: toInt(canonical.total_sales),
      categoryWooIds,
      brandWooIds,
      // Language-neutral: option values are shared across translations.
      attributes: canonical.attributes ?? [],
      images,
      variationWooIds,
      translations: locales.map(([locale, post]) => ({
        locale,
        wooId: post.id,
        name: decodeEntities(post.name),
        slug: post.slug,
        description: post.description || null,
        shortDescription: post.short_description || null,
        permalink: post.permalink || null,
        wooModifiedAt: post.date_modified ? new Date(post.date_modified) : null,
        wooSnapshot: post,
      })),
    }
  })
}

export type ProductPullResult = {
  created: number
  updated: number
  imageUrls: string[]
  /**
   * productId → its image source urls, in Woo's own order. Kept because the
   * MediaAsset rows do not exist until mirroring has run, so the product↔asset
   * links can only be written afterwards (see linkProductImages).
   */
  imagesByProduct: Map<string, { src: string; alt: string | null }[]>
}

export async function pullProducts(): Promise<ProductPullResult> {
  const posts = await listProducts()
  const upserts = toProductUpserts(posts)
  let created = 0
  let updated = 0
  const imageUrls: string[] = []
  const imagesByProduct = new Map<string, { src: string; alt: string | null }[]>()

  for (const row of upserts) {
    const existing = await prisma.product.findUnique({ where: { wooGroupKey: row.wooGroupKey } })
    const product = await prisma.product.upsert({
      where: { wooGroupKey: row.wooGroupKey },
      update: {
        sku: row.sku, type: row.type, status: row.status, featured: row.featured,
        price: row.price, regularPrice: row.regularPrice, onSale: row.onSale,
        manageStock: row.manageStock, stockQuantity: row.stockQuantity,
        stockStatus: row.stockStatus, menuOrder: row.menuOrder, totalSales: row.totalSales,
        attributes: row.attributes as object,
      },
      create: {
        wooGroupKey: row.wooGroupKey,
        attributes: row.attributes as object,
        sku: row.sku, type: row.type, status: row.status, featured: row.featured,
        price: row.price, regularPrice: row.regularPrice, onSale: row.onSale,
        manageStock: row.manageStock, stockQuantity: row.stockQuantity,
        stockStatus: row.stockStatus, menuOrder: row.menuOrder, totalSales: row.totalSales,
      },
    })
    if (existing) updated++
    else created++

    for (const t of row.translations) {
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale: t.locale } },
        update: {
          wooId: t.wooId, name: t.name, slug: t.slug, description: t.description,
          shortDescription: t.shortDescription, permalink: t.permalink,
          wooModifiedAt: t.wooModifiedAt, wooSnapshot: t.wooSnapshot as object,
        },
        create: {
          productId: product.id, locale: t.locale, wooId: t.wooId,
          name: t.name, slug: t.slug, description: t.description,
          shortDescription: t.shortDescription, permalink: t.permalink,
          wooModifiedAt: t.wooModifiedAt, wooSnapshot: t.wooSnapshot as object,
        },
      })
    }

    // Category links — replace wholesale, the set is small.
    const categories = await prisma.category.findMany({
      where: { translations: { some: { wooId: { in: row.categoryWooIds } } } },
      select: { id: true },
    })
    await prisma.productCategory.deleteMany({ where: { productId: product.id } })
    if (categories.length) {
      await prisma.productCategory.createMany({
        data: categories.map(c => ({ productId: product.id, categoryId: c.id })),
        skipDuplicates: true,
      })
    }

    // Brand links — same replace-wholesale approach as categories.
    if (row.brandWooIds.length) {
      const brands = await prisma.brand.findMany({
        where: { translations: { some: { wooId: { in: row.brandWooIds } } } },
        select: { id: true },
      })
      await prisma.productBrand.deleteMany({ where: { productId: product.id } })
      if (brands.length) {
        await prisma.productBrand.createMany({
          data: brands.map(b => ({ productId: product.id, brandId: b.id })),
          skipDuplicates: true,
        })
      }
    }

    // Variations. Fetched per product because Woo has no bulk endpoint for
    // them; only variable products have any, so simple products cost nothing.
    //
    // Variations hang off a specific POST, not off the translation group, so the
    // parent id is a translation's wooId — Greek by preference, since that is
    // the language the catalogue is authored in.
    const variationParentWooId =
      row.translations.find(t => t.locale === 'el')?.wooId ?? row.translations[0]?.wooId
    if (row.variationWooIds.length && variationParentWooId) {
      const variations = await listVariations(variationParentWooId)
      for (const v of variations) {
        await prisma.productVariation.upsert({
          where: { wooId: v.id },
          update: {
            productId: product.id, sku: v.sku || null,
            price: v.price || null, regularPrice: v.regular_price || null,
            stockQuantity: v.stock_quantity, stockStatus: v.stock_status,
            menuOrder: v.menu_order, attributes: (v.attributes ?? []) as object,
          },
          create: {
            productId: product.id, wooId: v.id, sku: v.sku || null,
            price: v.price || null, regularPrice: v.regular_price || null,
            stockQuantity: v.stock_quantity, stockStatus: v.stock_status,
            menuOrder: v.menu_order, attributes: (v.attributes ?? []) as object,
          },
        })
      }
    }

    imageUrls.push(...row.images.map(i => i.src))
    imagesByProduct.set(product.id, row.images.map(i => ({ src: i.src, alt: i.alt || null })))
  }

  return { created, updated, imageUrls: [...new Set(imageUrls)], imagesByProduct }
}

/**
 * Writes the ProductImage join rows. Must run AFTER mirrorImages, because it
 * resolves each Woo source url to the MediaAsset created during mirroring.
 * Images that failed to mirror are simply skipped — the product keeps whatever
 * links it already had rather than losing them.
 */
export async function linkProductImages(
  imagesByProduct: Map<string, { src: string; alt: string | null }[]>,
): Promise<{ linked: number; unresolved: number }> {
  const allSrcs = [...new Set([...imagesByProduct.values()].flat().map(i => i.src))]
  const assets = await prisma.mediaAsset.findMany({
    where: { sourceUrl: { in: allSrcs } },
    select: { id: true, sourceUrl: true },
  })
  const assetIdBySrc = new Map(assets.map(a => [a.sourceUrl, a.id]))

  let linked = 0
  let unresolved = 0

  for (const [productId, images] of imagesByProduct) {
    const rows = images
      .map((img, position) => {
        const assetId = assetIdBySrc.get(img.src)
        if (!assetId) { unresolved++; return null }
        return { productId, assetId, position, alt: img.alt }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (!rows.length) continue

    await prisma.productImage.deleteMany({ where: { productId } })
    await prisma.productImage.createMany({ data: rows, skipDuplicates: true })
    linked += rows.length
  }

  return { linked, unresolved }
}
