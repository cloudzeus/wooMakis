import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readCartCount } from '@/lib/cart'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import { HomeShowcase } from './home-showcase'
import {
  CREAM, HAIRLINE, INK, INK_MUTED, PANEL, PANEL_HI,
  R_CARD, SURFACE_PRODUCT, TEAL, TEAL_DEEP,
} from '@/components/store/tokens'
import type { StoreProduct } from '@/components/store/types'

export const dynamic = 'force-dynamic'

type WooAttribute = { name?: string; options?: string[] }

export default async function HomePage() {
  const [rows, categories, productCount, cartCount, brands] = await Promise.all([
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
  ])

  const pick = <T extends { locale: string }>(t: T[]) => t.find(x => x.locale === 'el') ?? t[0]

  const products: StoreProduct[] = rows.map(p => {
    const el = pick(p.translations)
    const en = p.translations.find(t => t.locale === 'en')
    const attrs = Array.isArray(p.attributes) ? (p.attributes as WooAttribute[]) : []
    return {
      id: p.id,
      name: el?.name ?? '—',
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

  const hero = products[0]

  return (
    <div className="min-h-dvh font-store" style={{ background: INK }}>
      <StoreHeader cartCount={cartCount} />

      <main className="mx-auto max-w-[1440px] px-5 pb-24 pt-5 sm:px-8">
        {/* ── Hero bento: 7/5 split, staggered heights for rhythm ── */}
        <section className="grid gap-3 lg:grid-cols-12">
          <div
            className="flex flex-col justify-between p-8 sm:p-11 lg:col-span-7"
            style={{ background: CREAM, borderRadius: R_CARD }}
          >
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.15em]"
                style={{ background: INK, color: CREAM }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: TEAL }} />
                Επίσημος διανομέας
              </span>

              <h1
                className="mt-8 text-[clamp(44px,8vw,88px)] font-extrabold uppercase leading-[0.87] tracking-[-0.045em]"
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
                className="rounded-full px-8 py-4 text-sm font-bold transition-transform motion-safe:hover:-translate-y-0.5"
                style={{ background: INK, color: CREAM }}
              >
                Δες όλα τα προϊόντα
              </Link>
              <Link
                href="/proionta#katigories"
                className="rounded-full border px-8 py-4 text-sm font-semibold transition-colors hover:border-black/35"
                style={{ borderColor: HAIRLINE, color: INK }}
              >
                Κατηγορίες
              </Link>
            </div>
          </div>

          {/* Right column: hero product over stat strip */}
          <div className="grid gap-3 lg:col-span-5">
            {hero && (
              <Link
                href="/proionta"
                className="group relative block overflow-hidden"
                style={{ background: SURFACE_PRODUCT, borderRadius: R_CARD }}
              >
                {hero.images[0] && (
                  <div className="relative aspect-[4/3] w-full">
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

            <div className="grid grid-cols-3 gap-3">
              {[
                { n: productCount, l: 'Προϊόντα' },
                { n: brands.length, l: 'Μάρκες' },
                { n: categories.length, l: 'Κατηγορίες' },
              ].map(s => (
                <div key={s.l} className="px-3 py-7 text-center" style={{ background: PANEL, borderRadius: R_CARD }}>
                  <p className="text-[32px] font-extrabold leading-none tabular-nums text-white">{s.n}</p>
                  <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-white/40">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Products ── */}
        <HomeShowcase products={products} />

        {/* ── Editorial + categories ── */}
        <section className="mt-3 grid gap-3 lg:grid-cols-12">
          <div
            className="flex flex-col justify-between p-8 sm:p-11 lg:col-span-4"
            style={{ background: TEAL, borderRadius: R_CARD }}
          >
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em]" style={{ color: 'rgb(11 15 16 / 55%)' }}>
                Γιατί mylens
              </p>
              <h2
                className="mt-5 text-[clamp(30px,4vw,42px)] font-extrabold uppercase leading-[0.92] tracking-[-0.035em]"
                style={{ color: INK }}
              >
                Καθαρή<br />όραση,<br />κάθε μέρα
              </h2>
            </div>
            <ul className="mt-8 space-y-3 text-[14px]" style={{ color: 'rgb(11 15 16 / 78%)' }}>
              {['Γνήσια προϊόντα από επίσημους διανομείς',
                'Αποστολή σε όλη την Ελλάδα',
                'Υποστήριξη από οπτικούς'].map(t => (
                <li key={t} className="flex gap-2.5">
                  <span aria-hidden style={{ color: INK }}>—</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-8 sm:p-11 lg:col-span-8" style={{ background: PANEL, borderRadius: R_CARD }}>
            <div className="mb-7 flex items-end justify-between gap-4">
              <h2 className="text-[26px] font-extrabold tracking-[-0.025em] text-white">Κατηγορίες</h2>
              <Link href="/proionta" className="text-[13px] text-white/50 transition-colors hover:text-white">
                Όλα →
              </Link>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {categories.map(c => (
                <li key={c.id}>
                  <Link
                    href="/proionta#katigories"
                    className="flex items-center justify-between rounded-2xl px-5 py-4 transition-colors"
                    style={{ background: PANEL_HI }}
                  >
                    <span className="text-[14px] text-white/90">{pick(c.translations)?.name ?? '—'}</span>
                    <span className="text-[12px] tabular-nums text-white/35">{c._count.products}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Brands ── */}
        <section className="mt-3 p-8 sm:p-11" style={{ background: CREAM, borderRadius: R_CARD }}>
          <h2 className="mb-6 text-[26px] font-extrabold tracking-[-0.025em]" style={{ color: INK }}>
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
                  {pick(b.translations)?.name ?? '—'}
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
