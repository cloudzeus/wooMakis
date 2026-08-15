import { prisma } from '@/lib/prisma'
import { readCartCount } from '@/lib/cart'
import { pickTranslation } from '@/lib/i18n'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import { getHomeSections } from '@/lib/home-sections'
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
  const [customer, cartCount, sections] = await Promise.all([
    getCustomerSession(), readCartCount(), getHomeSections(locale),
  ])

  // Enabled bands only, in the order the admin set. A missing kind simply does
  // not render — the page composes from this list rather than from a fixed
  // sequence of JSX.
  const band = (kind: string) => sections.find(s => s.kind === kind)
  const limitOf = (kind: string, fallback: number) => band(kind)?.itemLimit || fallback

  const [productRows, categoryRows, brandRows, productCount, slots] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'publish', images: { some: {} } },
      orderBy: [{ featured: 'desc' }, { totalSales: 'desc' }],
      take: 24,
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
      take: 12,
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
      take: 24,
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

  /**
   * The second panel's copy is packed into the PANELS `body` field as
   * "EYEBROW|TITLE". One band, two panels, and inventing a second set of
   * translation columns for a single case was the worse trade.
   */
  const panelB = (body: string) => {
    const [eyebrow, ...rest] = body.split('|')
    return { eyebrow: eyebrow.trim(), title: rest.join('|').trim() }
  }

  const render = (kind: string) => {
    const s = band(kind)
    if (!s) return null

    switch (kind) {
      case 'HERO':
        return (
          <Hero
            key={kind}
            locale={locale}
            image={slot(s.imageSlot ?? '')}
            title={s.copy.title}
            body={s.copy.body}
            ctaLabel={s.copy.ctaLabel} ctaHref={s.copy.ctaHref}
            ctaLabelB={s.copy.ctaLabelB} ctaHrefB={s.copy.ctaHrefB}
            productCount={productCount}
            brandCount={brands.length}
          />
        )
      case 'TRUST':
        return <TrustStrip key={kind} locale={locale} />
      case 'CATEGORIES':
        return (
          <Categories
            key={kind}
            locale={locale}
            title={s.copy.title}
            ctaLabel={s.copy.ctaLabel}
            ctaHref={s.copy.ctaHref}
            items={categories.slice(0, limitOf(kind, 6))}
          />
        )
      case 'PRODUCTS':
        return (
          <ProductTabs
            key={kind}
            locale={locale}
            title={s.copy.title}
            products={products.slice(0, limitOf(kind, 12))}
          />
        )
      case 'PANELS': {
        const b = panelB(s.copy.body)
        return (
          <section
            key={kind}
            className="grid grid-cols-[repeat(auto-fit,minmax(430px,1fr))] gap-6 pb-16 pt-12"
            style={{ maxWidth: MAX_W, marginInline: 'auto', paddingInline: GUTTER }}
          >
            <LifestylePanel
              image={slot(s.imageSlot ?? '')}
              href={s.copy.ctaHref}
              eyebrow={s.copy.eyebrow}
              title={s.copy.title}
              cta={s.copy.ctaLabel}
            />
            <LifestylePanel
              image={slot(s.imageSlotB ?? '')}
              href={s.copy.ctaHrefB}
              eyebrow={b.eyebrow}
              title={b.title}
              cta={s.copy.ctaLabelB}
            />
          </section>
        )
      }
      case 'BRANDS':
        return <BrandMarquee key={kind} brands={brands.slice(0, limitOf(kind, 12))} />
      case 'NEWSLETTER':
        return (
          <Newsletter
            key={kind}
            eyebrow={s.copy.eyebrow}
            title={s.copy.title}
            body={s.copy.body}
            ctaLabel={s.copy.ctaLabel}
            ctaHref={s.copy.ctaHref}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="overflow-x-hidden font-store" style={{ background: SURFACE, color: INK }}>
      <StoreMotion />
      <StoreHeader cartCount={cartCount} locale={locale} customerName={customer?.name} />
      {sections.map(s => render(s.kind))}
      <StoreFooter locale={locale} />
    </div>
  )
}
