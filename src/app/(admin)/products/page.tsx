import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { ProductsTable, type ProductRow } from './products-table'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  await requirePermission('product.view')

  const products = await prisma.product.findMany({
    orderBy: { menuOrder: 'asc' },
    include: {
      translations: { orderBy: { locale: 'asc' } },
      categories: { include: { category: { include: { translations: true } } } },
      images: { include: { asset: true }, orderBy: { position: 'asc' } },
      _count: { select: { variations: true } },
    },
  })

  const rows: ProductRow[] = products.map(p => {
    const el = p.translations.find(t => t.locale === 'el')
    const en = p.translations.find(t => t.locale === 'en')
    return {
      id: p.id,
      wooGroupKey: p.wooGroupKey,
      sku: p.sku,
      type: p.type,
      status: p.status,
      featured: p.featured,
      price: p.price?.toString() ?? null,
      regularPrice: p.regularPrice?.toString() ?? null,
      onSale: p.onSale,
      manageStock: p.manageStock,
      stockStatus: p.stockStatus,
      stockQuantity: p.stockQuantity,
      menuOrder: p.menuOrder,
      totalSales: p.totalSales,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      nameEl: el?.name ?? null,
      nameEn: en?.name ?? null,
      slugEl: el?.slug ?? null,
      permalinkEl: el?.permalink ?? null,
      locales: p.translations.map(t => t.locale).sort(),
      categories: p.categories
        .map(pc => pc.category.translations.find(t => t.locale === 'el')?.name
          ?? pc.category.translations[0]?.name ?? '')
        .filter(Boolean),
      thumbUrl: p.images[0]?.asset.cdnUrl ?? null,
      imageCount: p.images.length,
      images: p.images.map(pi => ({
        assetId: pi.asset.id,
        cdnUrl: pi.asset.cdnUrl,
        mimeType: pi.asset.mimeType,
        bytes: pi.asset.bytes,
        width: pi.asset.width,
        height: pi.asset.height,
      })),
      translations: p.translations.map(t => ({
        locale: t.locale,
        wooId: t.wooId,
        name: t.name,
        slug: t.slug,
        shortDescription: t.shortDescription,
        description: t.description,
        permalink: t.permalink,
        wooModifiedAt: t.wooModifiedAt?.toISOString() ?? null,
      })),
      variationCount: p._count.variations,
    }
  })

  const missingTranslation = rows.filter(r => r.locales.length < 2).length

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Προϊόντα</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} προϊόντα από το mylens.gr
            {missingTranslation > 0 && (
              <> · <span className="text-[var(--warning)]">
                ⚠ {missingTranslation} χωρίς πλήρη μετάφραση
              </span></>
            )}
          </p>
        </div>
      </header>

      <ProductsTable rows={rows} />
    </section>
  )
}
