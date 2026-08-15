import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { readCartCount } from '@/lib/cart'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import {
  CANVAS, INK, INK_MUTED, PRIMARY,
} from '@/components/store/tokens'
import type { StoreProduct } from '@/components/store/types'
import { Catalog } from './catalog'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Προϊόντα  mylens.gr',
  description: 'Όλα τα προϊόντα: φακοί επαφής, υγρά φροντίδας, γυαλιά ηλίου και αξεσουάρ.',
}

type WooAttribute = { name?: string; options?: string[] }

export default async function ProductsPage() {
  const { locale } = await getT()
  const customer = await getCustomerSession()

  const [rows, cartCount] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'publish' },
      orderBy: [{ featured: 'desc' }, { totalSales: 'desc' }],
      include: {
        translations: true,
        images: { include: { asset: true }, orderBy: { position: 'asc' } },
        categories: { include: { category: { include: { translations: true } } } },
        brands: { include: { brand: { include: { translations: true } } } },
        _count: { select: { variations: true } },
      },
    }),
    readCartCount(),
  ])

  const pick = <T extends { locale: string }>(t: T[]) => t.find(x => x.locale === 'el') ?? t[0]

  const products: StoreProduct[] = rows.map(p => {
    const el = pick(p.translations)
    const en = p.translations.find(t => t.locale === 'en')
    const attrs = Array.isArray(p.attributes) ? (p.attributes as WooAttribute[]) : []
    return {
      id: p.id,
      name: el?.name ?? '',
      nameEn: en?.name ?? null,
      slug: el?.slug ?? '',
      sku: p.sku,
      brand: p.brands[0] ? pick(p.brands[0].brand.translations)?.name ?? null : null,
      categories: p.categories.map(pc => pick(pc.category.translations)?.name ?? '').filter(Boolean),
      price: p.price ? Number(p.price) : null,
      regularPrice: p.regularPrice ? Number(p.regularPrice) : null,
      onSale: p.onSale,
      stockStatus: p.stockStatus,
      type: p.type,
      shortDescription: el?.shortDescription ?? null,
      description: el?.description ?? null,
      permalink: el?.permalink ?? null,
      images: p.images.map(pi => ({ url: pi.asset.cdnUrl, alt: pi.alt })),
      attributes: attrs
        .filter(a => a.name && a.options?.length)
        .map(a => ({ name: a.name!, options: a.options! })),
      variationCount: p._count.variations,
    }
  })

  // Facets counted from the filtered set, so a count never promises zero results.
  const tally = (values: string[]) => {
    const m = new Map<string, number>()
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }

  const categories = tally(products.flatMap(p => p.categories))
  const brands = tally(products.map(p => p.brand).filter((b): b is string => !!b))

  return (
    <div className="min-h-dvh font-store" style={{ background: CANVAS }}>
      <StoreHeader cartCount={cartCount} locale={locale} customerName={customer?.name} />

      <main className="mx-auto max-w-[1440px] px-5 pb-24 pt-10 sm:px-8">
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: PRIMARY }}>
            Κατάλογος
          </p>
          <h1 className="mt-2 font-store-display font-black text-[40px] uppercase leading-[0.95] tracking-[-0.01em] sm:text-[56px]" style={{ color: INK }}>
            Όλα τα προϊόντα
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed" style={{ color: INK_MUTED }}>
            {products.length} προϊόντα σε {categories.length} κατηγορίες από {brands.length} μάρκες.
            Πάτα «Γρήγορη προβολή» για λεπτομέρειες χωρίς να φύγεις από τη λίστα.
          </p>
        </div>

        <Catalog products={products} categories={categories} brands={brands} />
      </main>

      <StoreFooter locale={locale} />
    </div>
  )
}
