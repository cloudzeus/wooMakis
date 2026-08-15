import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readCartCount } from '@/lib/cart'
import { AddToCart } from '@/components/add-to-cart'

export const dynamic = 'force-dynamic'

/**
 * Public storefront home. No auth — the proxy only guards the admin prefixes,
 * and staff sign in at /login.
 *
 * Art direction is the brand's own, not the admin's Steel & Frost: teal
 * #00cfc9 taken from the mylens wordmark, generous white, product photography
 * carrying the page.
 */
export default async function HomePage() {
  const [featured, categories, productCount, cartCount, brands] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'publish', images: { some: {} } },
      orderBy: [{ featured: 'desc' }, { totalSales: 'desc' }],
      take: 8,
      include: {
        translations: true,
        images: { include: { asset: true }, orderBy: { position: 'asc' }, take: 1 },
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
      take: 12,
      // All locales, not just el: two brands have no Greek translation and
      // would otherwise render as a dash.
      include: { translations: true },
    }),
  ])

  return (
    <div className="min-h-screen bg-white text-[#0f2429]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Image src="/mylens-logo.svg" alt="mylens" width={70} height={40} priority />
          <nav className="flex items-center gap-6 text-sm">
            <Link href="#katigories" className="hover:text-[#00cfc9]">Κατηγορίες</Link>
            <Link href="#markes" className="hover:text-[#00cfc9]">Μάρκες</Link>
            <Link href="#proionta" className="hover:text-[#00cfc9]">Προϊόντα</Link>
            <Link href="/kalathi" className="relative hover:text-[#00cfc9]">
              Καλάθι
              {cartCount > 0 && (
                <span className="ml-1 rounded-full bg-[#00cfc9] px-1.5 py-0.5 text-[11px] text-white tabular-nums">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[#0f2429] px-4 py-2 text-white transition-colors hover:bg-[#00cfc9]"
            >
              Σύνδεση
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#00cfc9]/15 blur-3xl"
        />
        <div className="mx-auto max-w-6xl px-5 py-24">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#00cfc9]">
            Φακοί επαφής &amp; οπτικά
          </p>
          <h1 className="max-w-3xl text-5xl leading-[1.1] font-semibold tracking-tight sm:text-6xl">
            Καθαρή όραση,<br />
            <span className="text-[#00cfc9]">κάθε μέρα.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[#0f2429]/70">
            {productCount} προϊόντα σε {categories.length} κατηγορίες — ημερήσιοι, μηνιαίοι
            και έγχρωμοι φακοί, υγρά και αξεσουάρ.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#proionta"
              className="rounded-full bg-[#00cfc9] px-7 py-3 font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              Δες τα προϊόντα
            </Link>
            <a
              href="https://www.mylens.gr"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-black/10 px-7 py-3 font-medium hover:border-[#00cfc9]"
            >
              Αγορά στο mylens.gr ↗
            </a>
          </div>
        </div>
      </section>

      <section id="katigories" className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Κατηγορίες</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(c => (
            <li key={c.id}>
              <div className="group flex items-center justify-between rounded-2xl border border-black/8 px-5 py-4 transition-colors hover:border-[#00cfc9]">
                <span className="font-medium">
                  {c.translations.find(t => t.locale === 'el')?.name ?? c.translations[0]?.name ?? '—'}
                </span>
                <span className="text-sm text-[#0f2429]/50 group-hover:text-[#00cfc9]">
                  {c._count.products}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="markes" className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Μάρκες</h2>
        <ul className="flex flex-wrap gap-2">
          {brands.map(b => (
            <li key={b.id}>
              <span className="inline-flex items-center gap-2 rounded-full border border-black/8 px-4 py-2 text-sm transition-colors hover:border-[#00cfc9]">
                {b.translations.find(t => t.locale === 'el')?.name ?? b.translations[0]?.name ?? '—'}
                <span className="text-xs text-[#0f2429]/40 tabular-nums">{b.count}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section id="proionta" className="mx-auto max-w-6xl px-5 pb-24">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Δημοφιλή προϊόντα</h2>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map(p => {
            const t = p.translations.find(x => x.locale === 'el') ?? p.translations[0]
            const img = p.images[0]?.asset
            return (
              <li key={p.id} className="group">
                <div className="overflow-hidden rounded-2xl bg-[#f5f8f8]">
                  {img && (
                    <Image
                      src={img.cdnUrl}
                      alt={t?.name ?? ''}
                      width={img.width ?? 400}
                      height={img.height ?? 400}
                      className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized
                    />
                  )}
                </div>
                <h3 className="mt-3 text-sm font-medium leading-snug">{t?.name ?? '—'}</h3>
                <p className="mt-1 text-sm">
                  {p.price && (
                    <span className="font-semibold tabular-nums">{Number(p.price).toFixed(2)} €</span>
                  )}
                  {p.onSale && p.regularPrice && (
                    <span className="ml-2 text-[#0f2429]/40 line-through tabular-nums">
                      {Number(p.regularPrice).toFixed(2)} €
                    </span>
                  )}
                </p>
                <AddToCart productId={p.id} disabled={p.stockStatus !== 'instock'} />
              </li>
            )
          })}
        </ul>
      </section>

      <footer className="border-t border-black/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-sm text-[#0f2429]/60">
          <span>© {new Date().getFullYear()} mylens.gr</span>
          <Link href="/login" className="hover:text-[#00cfc9]">Διαχείριση</Link>
        </div>
      </footer>
    </div>
  )
}
