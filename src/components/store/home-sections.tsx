import Image from 'next/image'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import {
  ACCENT, ACCENT_PALE, CANVAS, GUTTER, HAIRLINE, HAIRLINE_ON_DARK, HAIRLINE_SOFT,
  INK, INK_FAINT, INK_MUTED, INK_ON_DARK, INK_ON_DARK_FAINT, MAX_W,
  PRIMARY, PRIMARY_ON, R_CARD, R_PANEL, R_PILL, SALE, STAR,
  SUCCESS, SURFACE, SURFACE_PRODUCT, TINT,
} from './tokens'

/**
 * The v3 home page, section by section.
 *
 * Everything here is a server component fed from the database — the design's
 * hard-coded product list, category counts and brand names are replaced by the
 * real catalogue. The three claims the design invents and the shop cannot back
 * (a countdown, a discount code, review quotes) are NOT reproduced; see
 * page.tsx for what stands in their place.
 */

const section = { maxWidth: MAX_W, marginInline: 'auto', paddingInline: GUTTER } as const

// ── Hero ──────────────────────────────────────────────────

export function Hero({
  locale, image, title, body, ctaLabel, ctaHref, ctaLabelB, ctaHrefB,
  productCount, brandCount,
}: {
  locale: Locale
  image: { url: string; alt: string } | null
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
  ctaLabelB: string
  ctaHrefB: string
  productCount: number
  brandCount: number
}) {
  const el = locale === 'el'
  return (
    <header className="relative h-[440px] overflow-hidden" style={{ background: INK }}>
      {/* The parallax moves this WRAPPER, not the image. next/image with
          `fill` owns its own inset and height, so animating the <img> itself
          is a runtime error — and an oversized box is what makes the drift
          possible without exposing an edge. */}
      {image && (
        <div className="px absolute" data-speed="18" style={{ inset: '-12% 0', height: '124%' }}>
          <Image
            src={image.url}
            alt={image.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ opacity: 0.85 }}
            unoptimized
          />
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(9,14,11,.82) 0%, rgba(9,14,11,.45) 48%, transparent 75%)',
        }}
      />

      {/* Decorative lens diagram. aria-hidden: it carries no information a
          reader needs, and announcing "circle" four times helps nobody. */}
      <svg
        viewBox="0 0 200 200" aria-hidden
        className="px absolute right-[6%] top-1/2 -mt-[140px] size-[280px] opacity-45"
        data-speed="-10"
      >
        <circle cx="100" cy="100" r="96" fill="none" stroke={ACCENT_PALE} strokeWidth=".6" strokeDasharray="2 4" />
        <circle cx="100" cy="100" r="72" fill="none" stroke={ACCENT_PALE} strokeWidth=".5" />
        <circle cx="100" cy="100" r="46" fill="none" stroke={ACCENT_PALE} strokeWidth=".5" strokeDasharray="8 5" />
        <line x1="100" y1="0" x2="100" y2="26" stroke={ACCENT_PALE} strokeWidth=".6" />
        <line x1="100" y1="174" x2="100" y2="200" stroke={ACCENT_PALE} strokeWidth=".6" />
        <line x1="0" y1="100" x2="26" y2="100" stroke={ACCENT_PALE} strokeWidth=".6" />
        <line x1="174" y1="100" x2="200" y2="100" stroke={ACCENT_PALE} strokeWidth=".6" />
      </svg>

      <div className="relative z-[2] flex h-full flex-col justify-center gap-4" style={section}>
        <p className="ht flex items-center gap-3.5 text-[11.5px] font-bold uppercase tracking-[0.2em]"
           style={{ color: ACCENT_PALE }}>
          <span className="h-px w-[38px]" style={{ background: ACCENT_PALE }} />
          {el ? `Επίσημος διανομέας · ${brandCount} μάρκες` : `Official distributor · ${brandCount} brands`}
        </p>

        <h1
          className="ht m-0 max-w-[640px] font-extrabold leading-[1.06] tracking-[-0.02em]"
          style={{ fontSize: 'clamp(34px,3.8vw,54px)', color: SURFACE }}
        >
          {/* The last word carries the accent, which is what gives the
              headline its shape in the design. Splitting on the final space
              keeps that working for whatever the shop types. */}
          {title.split(' ').slice(0, -1).join(' ')}{' '}
          <em className="not-italic" style={{ color: ACCENT }}>
            {title.split(' ').slice(-1)}
          </em>
        </h1>

        <p className="ht m-0 max-w-[430px] text-[15px] leading-[1.6] text-pretty"
           style={{ color: INK_ON_DARK }}>
          {body}
        </p>

        <div className="ht flex items-center gap-3">
          {ctaLabel && (
            <Link
              href={ctaHref || '/proionta'}
              className="px-7 py-[13px] text-[14.5px] font-bold transition-colors hover:bg-[var(--hv)]"
              style={{ background: SURFACE, color: INK, borderRadius: R_PILL, ['--hv' as string]: ACCENT }}
            >
              {ctaLabel} →
            </Link>
          )}
          {ctaLabelB && (
            <Link
              href={ctaHrefB || '#katigories'}
              className="px-6 py-3 text-[14.5px] font-semibold"
              style={{ border: `1.5px solid rgb(255 255 255 / 60%)`, color: SURFACE, borderRadius: R_PILL }}
            >
              {ctaLabelB}
            </Link>
          )}
        </div>

        <p className="ht flex flex-wrap gap-6 text-[12.5px] font-medium" style={{ color: INK_ON_DARK_FAINT }}>
          <span>{productCount} {el ? 'προϊόντα' : 'products'}</span>
          <span>{brandCount} {el ? 'επίσημες μάρκες' : 'official brands'}</span>
          <span>{el ? 'Αποστολή σε 1-3 ημέρες' : 'Delivery in 1-3 days'}</span>
        </p>
      </div>
    </header>
  )
}

// ── Trust strip ───────────────────────────────────────────

export function TrustStrip({ locale }: { locale: Locale }) {
  const el = locale === 'el'
  const items = el
    ? [
        { big: '40€+', text: 'Δωρεάν αποστολή για παραγγελίες άνω των 40 €' },
        { big: '1-3', text: 'Ημέρες παράδοση σε όλη την Ελλάδα' },
        { big: '100%', text: 'Γνήσια προϊόντα από επίσημους διανομείς' },
        { big: '24/7', text: 'Υποστήριξη από πραγματικούς οπτικούς' },
      ]
    : [
        { big: '40€+', text: 'Free shipping on orders over 40 €' },
        { big: '1-3', text: 'Day delivery across Greece' },
        { big: '100%', text: 'Genuine products from official distributors' },
        { big: '24/7', text: 'Support by real opticians' },
      ]

  return (
    <div className="border-b" style={{ background: SURFACE, borderColor: HAIRLINE }}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))]" style={section}>
        {items.map((i, n) => (
          <div
            key={i.big}
            className="ga flex items-center gap-3 px-4 py-[18px] text-[13.5px]"
            style={{ borderRight: n < items.length - 1 ? `1px solid ${HAIRLINE}` : undefined }}
          >
            <span
              className="whitespace-nowrap text-[24px] font-extrabold leading-none"
              style={{ color: PRIMARY }}
            >
              {i.big}
            </span>
            <span className="leading-[1.35]" style={{ color: INK_MUTED }}>{i.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Categories ────────────────────────────────────────────

export type CategoryTile = { name: string; count: number; image: string | null; href: string }

export function Categories({
  locale, items, title, ctaLabel, ctaHref,
}: {
  locale: Locale
  items: CategoryTile[]
  title: string
  ctaLabel: string
  ctaHref: string
}) {
  const el = locale === 'el'
  return (
    <section id="katigories" className="pb-16 pt-14" style={section}>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="ga m-0 text-[34px] font-extrabold" style={{ color: INK }}>
          {title}
        </h2>
        <Link
          href={ctaHref || '/proionta'}
          className="border-b text-[14px] font-bold transition-colors hover:text-[var(--hv)] hover:border-[var(--hv)]"
          style={{ color: INK, borderColor: INK, ['--hv' as string]: SALE }}
        >
          {ctaLabel} →
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        {items.map(c => (
          <Link
            key={c.href}
            href={c.href}
            className="ga flex flex-col items-center gap-3 border px-3 pb-5 pt-[26px] transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-[var(--hv)] hover:shadow-[0_16px_30px_-18px_rgb(16_27_20/30%)]"
            style={{ borderColor: HAIRLINE, borderRadius: R_CARD, color: INK, ['--hv' as string]: PRIMARY }}
          >
            <span
              className="flex size-24 items-center justify-center overflow-hidden rounded-full"
              style={{ background: TINT }}
            >
              {c.image
                ? <Image src={c.image} alt="" width={96} height={96}
                         className="size-[72%] object-contain mix-blend-multiply" unoptimized />
                : <span className="text-[22px] font-extrabold" style={{ color: PRIMARY }}>{c.name.slice(0, 1)}</span>}
            </span>
            <span className="text-center text-[14px] font-bold leading-[1.3]">{c.name}</span>
            <span className="text-[12px]" style={{ color: INK_FAINT }}>
              {c.count} {el ? 'προϊόντα' : 'products'}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Brand marquee ─────────────────────────────────────────

export function BrandMarquee({ brands }: { brands: string[] }) {
  if (brands.length === 0) return null
  return (
    // mt-4 so the band does not butt against whatever sits above it — with the
    // panels directly before, the two read as one glued block otherwise.
    <div className="mt-4 overflow-hidden border-y py-5" style={{ background: CANVAS, borderColor: HAIRLINE }}>
      <div className="marquee-track items-baseline whitespace-nowrap" style={{ animationDuration: '38s' }}>
        {[0, 1].map(copy => (
          <span key={copy} className="flex items-baseline" aria-hidden={copy === 1 || undefined}>
            {brands.map(b => (
              <span key={b} className="inline-flex items-baseline">
                <span className="text-[24px] font-bold" style={{ color: INK }}>{b}</span>
                <span className="mx-8 text-[13px]" style={{ color: SALE }}>✦</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Editorial / lifestyle panel ───────────────────────────

export function LifestylePanel({
  image, href, eyebrow, title, cta,
}: {
  image: { url: string; alt: string } | null
  href: string
  eyebrow: string
  title: string
  cta: string
}) {
  return (
    <div
      className="ga relative flex min-h-[440px] items-end overflow-hidden"
      style={{ borderRadius: R_PANEL, background: INK }}
    >
      {image && (
        <div className="px absolute" data-speed="12" style={{ inset: '-12% 0', height: '124%' }}>
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      {/* Two layers, because one was not enough. The design's single 55% ramp
          left the headline sitting on a bright cheek in one of these photos and
          unreadable. A stronger ramp carries the text, and a faint overall
          wash keeps the eyebrow legible wherever the crop lands. */}
      <div className="absolute inset-0" style={{ background: 'rgb(9 14 11 / 18%)' }} />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(0deg, rgba(9,14,11,.9) 0%, rgba(9,14,11,.55) 34%, transparent 68%)' }}
      />
      <div className="relative z-[2] flex flex-col gap-2.5 px-9 py-[34px]" style={{ color: SURFACE }}>
        <span
          className="text-[11.5px] font-extrabold uppercase tracking-[0.18em]"
          style={{ color: ACCENT_PALE, textShadow: '0 1px 12px rgb(9 14 11 / 65%)' }}
        >
          {eyebrow}
        </span>
        <h3
          className="m-0 max-w-[380px] text-[30px] font-extrabold leading-[1.2]"
          style={{ color: SURFACE, textShadow: '0 1px 18px rgb(9 14 11 / 55%)' }}
        >
          {title}
        </h3>
        <Link
          href={href}
          className="mt-1.5 self-start px-6 py-3 text-[14px] font-bold transition-colors hover:bg-[var(--hv)]"
          style={{ background: SURFACE, color: INK, borderRadius: R_PILL, ['--hv' as string]: ACCENT }}
        >
          {cta} →
        </Link>
      </div>
    </div>
  )
}

// ── Newsletter ────────────────────────────────────────────

export function Newsletter({
  eyebrow, title, body, ctaLabel, ctaHref,
}: {
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
}) {
  return (
    <section className="pb-20" style={section}>
      <div
        className="ga relative flex flex-col items-center gap-4 overflow-hidden px-12 py-14 text-center"
        style={{ background: INK, borderRadius: R_PANEL, color: SURFACE }}
      >
        <span aria-hidden className="ring-spin absolute -left-[90px] top-1/2 size-[280px] -translate-y-1/2 rounded-full"
              style={{ border: `1px dashed ${HAIRLINE_ON_DARK}` }} />
        <span aria-hidden className="ring-spin-slow absolute -right-[70px] -top-[70px] size-[240px] rounded-full"
              style={{ border: `1px dashed ${HAIRLINE_ON_DARK}` }} />

        <span className="relative z-[1] text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
          {eyebrow}
        </span>
        <h2
          className="relative z-[1] m-0 max-w-[680px] font-extrabold leading-[1.15]"
          style={{ fontSize: 'clamp(30px,3.4vw,44px)', color: SURFACE }}
        >
          {title}
        </h2>
        <p className="relative z-[1] m-0 max-w-[520px] text-[15px]" style={{ color: INK_ON_DARK_FAINT }}>
          {body}
        </p>

        {/* Deliberately a link, not an input: there is no mailing-list backend
            wired up, and a form that silently discards an address is worse
            than no form. */}
        <Link
          href={ctaHref || '/sindesi'}
          className="relative z-[1] mt-2 px-8 py-[15px] text-[14px] font-extrabold tracking-[0.04em] transition-colors hover:bg-[var(--hv)]"
          style={{ background: SURFACE, color: INK, borderRadius: R_PILL, ['--hv' as string]: ACCENT }}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  )
}

// ── Shared bits ───────────────────────────────────────────

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="ga m-0 text-[34px] font-extrabold">{children}</h2>
}

export { section as sectionStyle, ACCENT, HAIRLINE_SOFT, PRIMARY_ON, STAR, SUCCESS, SURFACE_PRODUCT }
