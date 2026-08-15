import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readCartCount } from '@/lib/cart'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import { HomeShowcase } from './home-showcase'
import { HeroMotion } from '@/components/store/hero-motion'
import { Marquee } from '@/components/store/marquee'
import { PromoBanners, type BannerCat } from '@/components/store/promo-banners'
import { EditorialBand } from '@/components/store/editorial-band'
import { ArrowRight, ICON_MD, ICON_SM, Sparkle } from '@/components/store/icons'
import { Reveal } from '@/components/store/reveal'
import {
  CANVAS, CREAM, HAIRLINE, INK, INK_FAINT, INK_MUTED,
  R_CARD, SURFACE, SURFACE_PRODUCT, TEAL, TEAL_DEEP,
} from '@/components/store/tokens'
import type { StoreProduct } from '@/components/store/types'

export const dynamic = 'force-dynamic'

type WooAttribute = { name?: string; options?: string[] }

export default async function HomePage() {
  const [rows, categories, productCount, cartCount, brands, bannerRows] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'publish', images: { some: {} } },
      orderBy: [{ featured: 'desc' }, { totalSales: 'desc' }],
      take: 8,
      include: {
        translations: true,
        images: { include: { asset: true }, orderBy: { position: 'asc' } },
        categories: { include: { category: { include: { translations: true } } } },
        brands: { include: { brand: { include: { translations: true } } } },
        _count: { select: { variations: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: { count: 'desc' },
      include: { translations: true, _count: { select: { products: true } } },
    }),
    prisma.product.count({ where: { status: 'publish' } }),
    readCartCount(),
    prisma.brand.findMany({
      where: { products: { some: {} } },
      orderBy: { count: 'desc' },
      take: 16,
      include: { translations: true },
    }),
    // One representative product image per category, for the banner band.
    prisma.category.findMany({
      orderBy: { count: 'desc' },
      take: 6,
      include: {
        translations: true,
        _count: { select: { products: true } },
        products: {
          take: 1,
          where: { product: { images: { some: {} }, status: 'publish' } },
          include: { product: { include: { images: { include: { asset: true }, take: 1 } } } },
        },
      },
    }),
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
      attributes: attrs.filter(a => a.name && a.options?.length).map(a => ({ name: a.name!, options: a.options! })),
      variationCount: p._count.variations,
    }
  })

  const bannerCats: BannerCat[] = bannerRows.map(c => ({
    name: pick(c.translations)?.name ?? '',
    count: c._count.products,
    imageUrl: c.products[0]?.product.images[0]?.asset.cdnUrl ?? null,
  }))

  const hero = products[0]

  return (
    <div className="min-h-dvh font-store" style={{ background: CANVAS }}>
      <StoreHeader cartCount={cartCount} />

      <main className="mx-auto max-w-[1440px] px-5 pb-24 pt-5 sm:px-8">
        {/* ── Hero bento: 7/5 split, staggered heights for rhythm ── */}
        <HeroMotion>
        <section className="grid gap-3 lg:grid-cols-12">
          <div
            data-hero="1"
            className="flex flex-col justify-between p-8 sm:p-11 lg:col-span-7"
            style={{ background: SURFACE, borderRadius: R_CARD }}
          >
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.15em]"
                style={{ background: INK, color: SURFACE }}
              >
                <Sparkle size={ICON_SM} weight="fill" />
                Επίσημος διανομέας
              </span>

              <h1
                className="mt-8 font-store-display font-black text-[clamp(48px,8.4vw,92px)] uppercase leading-[0.86] tracking-[-0.005em]"
                style={{ color: INK }}
              >
                Δες τη<br />
                <span style={{ color: TEAL_DEEP }}>διαφορά</span>
              </h1>

              <p className="mt-7 max-w-md text-[15.5px] leading-[1.65]" style={{ color: INK_MUTED }}>
                Φακοί επαφής, υγρά φροντίδας και γυαλιά ηλίου από {brands.length} μάρκες.
                Γνήσια προϊόντα, γρήγορη αποστολή σε όλη την Ελλάδα.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/proionta"
                className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold transition-transform motion-safe:hover:-translate-y-0.5"
                style={{ background: INK, color: SURFACE }}
              >
                Δες όλα τα προϊόντα
                <ArrowRight size={ICON_MD} weight="bold" />
              </Link>
            </div>
          </div>

          {/* Right column: hero product over stat strip */}
          <div className="lg:col-span-5">
            {hero && (
              <Link
                href="/proionta"
                data-hero="2"
                className="group relative block overflow-hidden"
                style={{ background: SURFACE_PRODUCT, borderRadius: R_CARD }}
              >
                {hero.images[0] && (
                  <div className="relative aspect-square w-full">
                    <Image
                      src={hero.images[0].url}
                      alt={hero.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      priority
                      className="object-contain p-10 transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]"
                      unoptimized
                    />
                  </div>
                )}
                <div className="absolute left-5 top-5">
                  <span
                    className="rounded-full px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.13em]"
                    style={{ background: TEAL, color: INK }}
                  >
                    Το πιο δημοφιλές
                  </span>
                </div>
                <div className="px-6 pb-6">
                  {hero.brand && (
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: TEAL_DEEP }}>
                      {hero.brand}
                    </p>
                  )}
                  <p className="mt-1 text-[17px] font-bold leading-snug" style={{ color: INK }}>{hero.name}</p>
                  {hero.price !== null && (
                    <p className="mt-1 text-[15px] font-bold tabular-nums" style={{ color: INK }}>
                      {hero.price.toFixed(2)} €
                    </p>
                  )}
                </div>
              </Link>
            )}

          </div>
        </section>
        </HeroMotion>

        {/* ── Promo ticker ── */}
        <Marquee
          className="mt-3 py-4"
          speed={34}
          itemClassName="shrink-0"
          items={[
            'Δωρεάν αποστολή άνω των 40 €',
            'Γνήσια προϊόντα',
            'Επίσημος διανομέας',
            'Αποστολή σε 1-3 ημέρες',
            'Υποστήριξη από οπτικούς',
            'Ασφαλής πληρωμή',
          ].map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-3 whitespace-nowrap rounded-full px-6 py-3 text-[13px] font-semibold"
              style={{ background: SURFACE, color: INK, border: `1px solid ${HAIRLINE}` }}
            >
              <span aria-hidden style={{ color: TEAL_DEEP }}>✦</span>
              {t}
            </span>
          ))}
        />

        {/* ── Category banners ── */}
        <PromoBanners cats={bannerCats} />

        {/* ── Products ── */}
        <HomeShowcase products={products} />

        {/* One deliberate dark band. See editorial-band.tsx for why. */}
        <EditorialBand imageUrl="https://picsum.photos/seed/mylens-eyewear-portrait/1200/1400" />

        {/* Categories */}
        <Reveal className="mt-3 p-8 sm:p-11" as="section" stagger={0.05}>
          <div style={{ background: SURFACE, borderRadius: R_CARD }} className="p-8 sm:p-11">
            <h2 className="mb-7 font-store-display font-black text-[32px] uppercase tracking-[-0.005em]" style={{ color: INK }}>
              Κατηγορίες
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(c => (
                <li key={c.id}>
                  <Link
                    href="/proionta#katigories"
                    className="flex items-center justify-between rounded-2xl px-5 py-4 transition-colors"
                    style={{ background: CANVAS }}
                  >
                    <span className="text-[14px]" style={{ color: INK }}>{pick(c.translations)?.name ?? 'Χωρίς όνομα'}</span>
                    <span className="text-[12px] tabular-nums" style={{ color: INK_FAINT }}>{c._count.products}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* ── Brands ── */}
        <section className="mt-3 p-8 sm:p-11" style={{ background: SURFACE, borderRadius: R_CARD }}>
          <h2 className="mb-6 font-store-display font-black text-[32px] uppercase tracking-[-0.005em]" style={{ color: INK }}>
            Μάρκες
          </h2>
          <ul className="flex flex-wrap gap-2">
            {brands.map(b => (
              <li key={b.id}>
                <Link
                  href="/proionta#markes"
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13.5px] transition-colors hover:border-black/40"
                  style={{ borderColor: HAIRLINE, color: INK }}
                >
                  {pick(b.translations)?.name ?? ''}
                  <span className="text-[11px] tabular-nums" style={{ color: '#A9B0B2' }}>{b.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <StoreFooter />
    </div>
  )
}
