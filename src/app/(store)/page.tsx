import { prisma } from '@/lib/prisma'
import { readCartCount } from '@/lib/cart'
import { pickTranslation } from '@/lib/i18n'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import { StoreMotion } from '@/components/store/motion'
import { ProductTabs, type TabProduct } from '@/components/store/product-tabs'
import {
  BrandMarquee, Categories, Hero, LifestylePanel, Newsletter, TrustStrip,
  type CategoryTile,
} from '@/components/store/home-sections'
import { GUTTER, INK, MAX_W, SURFACE } from '@/components/store/tokens'

export const dynamic = 'force-dynamic'

/**
 * Home page — "Mylens Redesign v3".
 *
 * The design ships with a hard-coded catalogue; this reads the real one. Three
 * things in the design are deliberately NOT reproduced, and each for the same
 * reason — the shop has no data behind them and inventing it would be a false
 * claim to a customer:
 *
 *  - the flash-sale countdown and VISION20 coupon (no such WooCommerce coupon)
 *  - "46 sold this week" and the low-stock bar (no such figures exist)
 *  - the three review quotes and "2.300+ κριτικές" (no reviews are stored)
 *
 * Fabricated urgency of that kind is also an unfair commercial practice under
 * the EU Omnibus Directive, which matters for a shop whose own terms page
 * cites consumer law. Each is replaced by something true: real availability,
 * real counts, and a real reason to make an account.
 */

/** Rough grouping for the product tabs, from the real category names. */
function groupOf(categories: string[]): string {
  const joined = categories.join(' ').toLowerCase()
  if (/υγρ|φροντ|solution|care|σταγόν|drop/.test(joined)) return 'care'
  if (/φακ|lens/.test(joined)) return 'lens'
  return 'other'
}

export default async function HomePage() {
  const { locale } = await getT()
  const [customer, cartCount] = await Promise.all([getCustomerSession(), readCartCount()])

  const [productRows, categoryRows, brandRows, productCount, slots] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'publish', images: { some: {} } },
      orderBy: [{ featured: 'desc' }, { totalSales: 'desc' }],
      take: 12,
      include: {
        translations: true,
        images: { include: { asset: true }, orderBy: { position: 'asc' }, take: 1 },
        categories: { include: { category: { include: { translations: true } } } },
        brands: { include: { brand: { include: { translations: true } } } },
      },
    }),
    prisma.category.findMany({
      where: { products: { some: {} } },
      orderBy: { count: 'desc' },
      take: 6,
      include: {
        translations: true,
        _count: { select: { products: true } },
        products: {
          take: 1,
          where: { product: { status: 'publish', images: { some: {} } } },
          include: { product: { include: { images: { include: { asset: true }, take: 1 } } } },
        },
      },
    }),
    prisma.brand.findMany({
      where: { products: { some: {} } },
      orderBy: { count: 'desc' },
      take: 12,
      include: { translations: true },
    }),
    prisma.product.count({ where: { status: 'publish' } }),
    prisma.mediaAsset.findMany({
      where: { slot: { not: null } },
      select: { slot: true, cdnUrl: true, altText: true },
    }),
  ])

  const slot = (name: string) => {
    const a = slots.find(s => s.slot === name)
    return a ? { url: a.cdnUrl, alt: a.altText ?? '' } : null
  }

  const products: TabProduct[] = productRows.map(p => {
    const t = pickTranslation(p.translations, locale)
    const categories = p.categories.map(pc =>
      pickTranslation(pc.category.translations, locale)?.name ?? '')
    return {
      id: p.id,
      slug: t?.slug ?? null,
      name: t?.name ?? '—',
      brand: pickTranslation(p.brands[0]?.brand.translations ?? [], locale)?.name ?? null,
      price: p.price?.toString() ?? null,
      regularPrice: p.regularPrice?.toString() ?? null,
      image: p.images[0]?.asset.cdnUrl ?? null,
      group: groupOf(categories),
      inStock: p.stockStatus === 'instock',
    }
  })

  const categories: CategoryTile[] = categoryRows.map(c => {
    const t = pickTranslation(c.translations, locale)
    const name = t?.name ?? '—'
    return {
      name,
      count: c._count.products,
      image: c.products[0]?.product.images[0]?.asset.cdnUrl ?? null,
      href: `/proionta?category=${encodeURIComponent(name)}`,
    }
  })

  // Deduped by display name: Polylang never linked some translation groups, so
  // the same brand can arrive twice under two ids.
  const brands = [...new Set(
    brandRows
      .map(b => pickTranslation(b.translations, locale)?.name)
      .filter((n): n is string => !!n),
  )]

  return (
    <div className="overflow-x-hidden font-store" style={{ background: SURFACE, color: INK }}>
      <StoreMotion />

      <StoreHeader cartCount={cartCount} locale={locale} customerName={customer?.name} />

      <Hero
        locale={locale}
        image={slot('hero-visual')}
        productCount={productCount}
        brandCount={brands.length}
      />

      <TrustStrip locale={locale} />

      <Categories locale={locale} items={categories} />

      <ProductTabs locale={locale} products={products} />

      <section
        className="grid grid-cols-[repeat(auto-fit,minmax(430px,1fr))] gap-6 pb-16 pt-12"
        style={{ maxWidth: MAX_W, marginInline: 'auto', paddingInline: GUTTER }}
      >
        <LifestylePanel
          image={slot('editorial-hero')}
          href="/proionta"
          eyebrow={locale === 'el' ? 'ΚΑΘΑΡΗ ΟΡΑΣΗ, ΚΑΘΕ ΜΕΡΑ' : 'CLEAR VISION, EVERY DAY'}
          title={locale === 'el'
            ? 'Ό,τι φοράς στα μάτια σου αξίζει προσοχή'
            : 'Whatever you wear on your eyes deserves care'}
          cta={locale === 'el' ? 'Δες τα προϊόντα' : 'Browse products'}
        />
        <LifestylePanel
          image={slot('trust-visual')}
          href="/syxnes-erotiseis"
          eyebrow={locale === 'el' ? 'ΡΩΤΗΣΕ ΜΑΣ' : 'ASK US'}
          title={locale === 'el'
            ? 'Δεν ξέρεις ποιο υγρό ταιριάζει στους φακούς σου;'
            : 'Not sure which solution suits your lenses?'}
          cta={locale === 'el' ? 'Συχνές ερωτήσεις' : 'Read the FAQ'}
        />
      </section>

      <BrandMarquee brands={brands} />

      <Newsletter locale={locale} />

      <StoreFooter locale={locale} />
    </div>
  )
}
