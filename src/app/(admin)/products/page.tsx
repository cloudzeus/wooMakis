import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { ProductsTable, type ProductRow } from './products-table'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  await requirePermission('product.view')

  const products = await prisma.product.findMany({
    orderBy: { menuOrder: 'asc' },
    include: {
      translations: true,
      categories: { include: { category: { include: { translations: true } } } },
      images: { include: { asset: true }, orderBy: { position: 'asc' } },
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
      price: p.price?.toString() ?? null,
      regularPrice: p.regularPrice?.toString() ?? null,
      onSale: p.onSale,
      stockStatus: p.stockStatus,
      stockQuantity: p.stockQuantity,
      totalSales: p.totalSales,
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
