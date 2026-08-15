import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readCartCount } from '@/lib/cart'
import { AddToCart } from '@/components/add-to-cart'

export const dynamic = 'force-dynamic'

/**
 * Public storefront. No auth — the proxy guards only the admin prefixes.
 *
 * Art direction follows the Lensora reference: a near-black canvas carrying an
 * asymmetric bento of light cards, oversized display type, small uppercase
 * micro-labels, and product photography on neutral grounds. The palette is ours
 * — teal #00cfc9 from the mylens wordmark is the only accent, used sparingly so
 * it still reads as one.
 *
 * Typeface is Open Sans (--font-store), which has full Greek coverage. The
 * admin keeps Comfortaa/Manrope; the two identities are deliberately separate.
 */

const INK = '#0E1213'
const CREAM = '#F4F1EC'
const TEAL = '#00cfc9'
const PANEL = '#1A2022'

export default async function HomePage() {
  const [featured, categories, productCount, cartCount, brands, hero] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'publish', images: { some: {} } },
      orderBy: [{ featured: 'desc' }, { totalSales: 'desc' }],
      take: 6,
      include: {
        translations: true,
        images: { include: { asset: true }, orderBy: { position: 'asc' }, take: 1 },
        brands: { include: { brand: { include: { translations: true } } }, take: 1 },
      },
    }),
    prisma.category.findMany({
      orderBy: { menuOrder: 'asc' },
      include: { translations: true, _count: { select: { products: true } } },
    }),
    prisma.product.count({ where: { status: 'publish' } }),
    readCartCount(),
    prisma.brand.findMany({
      where: { products: { some: {} } },
      orderBy: { count: 'desc' },
      take: 14,
      include: { translations: true },
    }),
    prisma.product.findFirst({
      where: { status: 'publish', images: { some: {} } },
      orderBy: { totalSales: 'desc' },
      include: {
        translations: true,
        images: { include: { asset: true }, orderBy: { position: 'asc' }, take: 1 },
      },
    }),
  ])

  /** Greek by preference, falling back to any locale that exists. */
  const el = <T extends { locale: string; name: string }>(rows: T[]) =>
    rows.find(r => r.locale === 'el') ?? rows[0]

  return (
    <div className="min-h-screen font-store" style={{ background: INK }}>
      {/* ── Nav ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b border-white/8 backdrop-blur"
        style={{ background: 'rgb(14 18 19 / 78%)' }}
      >
        <div className="mx-auto flex h-[68px] max-w-[1400px] items-center justify-between px-6">
          {/* Dark-background variant: an SVG served through next/image is an
              <img>, isolated from page CSS, so currentColor never resolves. */}
          <Link href="/" className="shrink-0">
            <Image
              src="/mylens-logo-dark.svg"
              alt="mylens"
              width={62}
              height={35}
              priority
            />
          </Link>

          <nav className="hidden items-center gap-8 text-[13px] text-white/70 md:flex">
            <a href="#proionta" className="transition-colors hover:text-white">Προϊόντα</a>
            <a href="#katigories" className="transition-colors hover:text-white">Κατηγορίες</a>
            <a href="#markes" className="transition-colors hover:text-white">Μάρκες</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/kalathi"
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/85 transition-colors hover:border-white/40"
            >
              Καλάθι
              {cartCount > 0 && (
                <span
                  className="rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
                  style={{ background: TEAL, color: INK }}
                >
                  {cartCount}
                </span>
              )}
            </Link>
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-[13px] font-semibold transition-transform hover:-translate-y-0.5"
              style={{ background: CREAM, color: INK }}
            >
              Σύνδεση
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 pb-24 pt-6">
        {/* ── Hero bento ───────────────────────────── */}
        <section className="grid gap-3 lg:grid-cols-12">
          <div
            className="rounded-[26px] p-9 lg:col-span-7 lg:row-span-2"
            style={{ background: CREAM }}
          >
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ background: INK, color: CREAM }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: TEAL }} />
              Φακοί επαφής &amp; οπτικά
            </span>

            <h1
              className="mt-7 text-[15vw] font-extrabold uppercase leading-[0.86] tracking-[-0.04em] sm:text-[62px] lg:text-[84px]"
              style={{ color: INK }}
            >
              Δες τη<br />
              <span style={{ color: TEAL }}>διαφορά</span>
            </h1>

            <p className="mt-7 max-w-md text-[15px] leading-relaxed" style={{ color: '#4B5457' }}>
              {productCount} προϊόντα σε {categories.length} κατηγορίες — ημερήσιοι, μηνιαίοι
              και έγχρωμοι φακοί, υγρά φροντίδας και γυαλιά ηλίου.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#proionta"
                className="rounded-full px-7 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: INK, color: CREAM }}
              >
                Δες τα προϊόντα
              </a>
              <a
                href="#katigories"
                className="rounded-full border px-7 py-3.5 text-sm font-semibold transition-colors"
                style={{ borderColor: 'rgb(14 18 19 / 18%)', color: INK }}
              >
                Κατηγορίες
              </a>
            </div>
          </div>

          {hero && (
            <div
              className="relative overflow-hidden rounded-[26px] lg:col-span-5"
              style={{ background: PANEL }}
            >
              {hero.images[0] && (
                <Image
                  src={hero.images[0].asset.cdnUrl}
                  alt={el(hero.translations)?.name ?? ''}
                  width={700}
                  height={520}
                  className="h-[290px] w-full object-cover"
                  unoptimized
                />
              )}
              <div
                className="absolute inset-x-0 bottom-0 p-6"
                style={{ background: 'linear-gradient(transparent, rgb(14 18 19 / 93%) 55%)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: TEAL }}>
                  Το πιο δημοφιλές
                </p>
                <p className="mt-1.5 text-lg font-semibold text-white">{el(hero.translations)?.name}</p>
                {hero.price && (
                  <p className="mt-0.5 text-sm tabular-nums text-white/70">
                    {Number(hero.price).toFixed(2)} €
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 lg:col-span-5">
            {[
              { n: productCount, l: 'Προϊόντα' },
              { n: brands.length, l: 'Μάρκες' },
              { n: categories.length, l: 'Κατηγορίες' },
            ].map(s => (
              <div key={s.l} className="rounded-[22px] px-4 py-6 text-center" style={{ background: PANEL }}>
                <p className="text-3xl font-extrabold tabular-nums text-white">{s.n}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-white/45">{s.l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Products ─────────────────────────────── */}
        <section id="proionta" className="mt-3">
          <div className="rounded-[26px] p-9" style={{ background: CREAM }}>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <h2
                className="text-[34px] font-extrabold leading-[0.95] tracking-[-0.03em]"
                style={{ color: INK }}
              >
                Δημοφιλή<br />προϊόντα
              </h2>
              <p className="max-w-xs text-[13px] leading-relaxed" style={{ color: '#6B7477' }}>
                Επιλεγμένα με βάση τις πωλήσεις. Η πληρωμή ολοκληρώνεται με ασφάλεια
                στο mylens.gr — δεν αποθηκεύουμε στοιχεία κάρτας.
              </p>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map(p => {
                const t = el(p.translations)
                const brand = p.brands[0] ? el(p.brands[0].brand.translations) : null
                return (
                  <li
                    key={p.id}
                    className="group rounded-[22px] bg-white p-4 transition-transform hover:-translate-y-1"
                  >
                    <div className="overflow-hidden rounded-[16px]" style={{ background: '#F0EDE7' }}>
                      {p.images[0] && (
                        <Image
                          src={p.images[0].asset.cdnUrl}
                          alt={t?.name ?? ''}
                          width={420}
                          height={420}
                          className="aspect-square w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                          unoptimized
                        />
                      )}
                    </div>
                    {brand && (
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#9AA2A4' }}>
                        {brand.name}
                      </p>
                    )}
                    <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug" style={{ color: INK }}>
                      {t?.name}
                    </h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      {p.price && (
                        <span className="text-base font-bold tabular-nums" style={{ color: INK }}>
                          {Number(p.price).toFixed(2)} €
                        </span>
                      )}
                      {p.onSale && p.regularPrice && (
                        <span className="text-xs tabular-nums line-through" style={{ color: '#A9B0B2' }}>
                          {Number(p.regularPrice).toFixed(2)} €
                        </span>
                      )}
                    </div>
                    <AddToCart productId={p.id} disabled={p.stockStatus !== 'instock'} />
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* ── Editorial + categories ───────────────── */}
        <section id="katigories" className="mt-3 grid gap-3 lg:grid-cols-12">
          <div className="rounded-[26px] p-9 lg:col-span-5" style={{ background: TEAL }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgb(14 18 19 / 55%)' }}>
              Γιατί mylens
            </p>
            <h2
              className="mt-4 text-[40px] font-extrabold uppercase leading-[0.9] tracking-[-0.03em]"
              style={{ color: INK }}
            >
              Καθαρή<br />όραση,<br />κάθε μέρα
            </h2>
            <p className="mt-6 text-sm leading-relaxed" style={{ color: 'rgb(14 18 19 / 72%)' }}>
              Γνήσια προϊόντα από επίσημους διανομείς, γρήγορη αποστολή σε όλη την
              Ελλάδα και υποστήριξη από οπτικούς.
            </p>
          </div>

          <div className="rounded-[26px] p-9 lg:col-span-7" style={{ background: PANEL }}>
            <h2 className="mb-6 text-[26px] font-extrabold tracking-[-0.02em] text-white">Κατηγορίες</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {categories.map(c => (
                <li key={c.id}>
                  <div className="flex items-center justify-between rounded-2xl border border-white/8 px-5 py-3.5 transition-colors hover:border-white/25">
                    <span className="text-sm text-white/90">{el(c.translations)?.name ?? '—'}</span>
                    <span className="text-xs tabular-nums text-white/35">{c._count.products}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Brands ───────────────────────────────── */}
        <section id="markes" className="mt-3 rounded-[26px] p-9" style={{ background: CREAM }}>
          <h2 className="mb-6 text-[26px] font-extrabold tracking-[-0.02em]" style={{ color: INK }}>
            Μάρκες
          </h2>
          <ul className="flex flex-wrap gap-2">
            {brands.map(b => (
              <li key={b.id}>
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors hover:border-[#00cfc9]"
                  style={{ borderColor: 'rgb(14 18 19 / 12%)', color: INK }}
                >
                  {el(b.translations)?.name ?? '—'}
                  <span className="text-[11px] tabular-nums" style={{ color: '#A9B0B2' }}>{b.count}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="overflow-hidden border-t border-white/8">
        <div className="mx-auto max-w-[1400px] px-6 py-12">
          <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] text-white/45">
            <span>© {new Date().getFullYear()} mylens.gr</span>
            <div className="flex items-center gap-6">
              <a
                href="https://www.mylens.gr"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                mylens.gr ↗
              </a>
              <Link href="/login" className="transition-colors hover:text-white">Διαχείριση</Link>
            </div>
          </div>
        </div>
        {/* Oversized cropped wordmark, as in the reference. Decorative only. */}
        <p
          aria-hidden
          className="-mb-[2.5vw] select-none px-6 text-[20vw] font-extrabold uppercase leading-[0.75] tracking-[-0.05em]"
          style={{ color: 'rgb(255 255 255 / 5%)' }}
        >
          mylens
        </p>
      </footer>
    </div>
  )
}
