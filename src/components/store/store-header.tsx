import Image from 'next/image'
import Link from 'next/link'
import { DEFAULT_LOCALE, translator, type Locale } from '@/lib/i18n'
import { CookieSettingsLink } from './cookie-settings-link'
import { LanguageSwitcher } from './language-switcher'
import {
  CANVAS, CREAM, GUTTER, HAIRLINE, INK, INK_FAINT, INK_MUTED, MAX_W,
  PRIMARY, PRIMARY_DEEP, R_PILL, SALE, SALE_PALE, SURFACE,
} from './tokens'

/**
 * Storefront chrome, from the v3 design.
 *
 * Rendered on every public page, not just the home page, so the ticker, the
 * nav and the four-column footer are the same everywhere. The ticker sits
 * above the nav and scrolls out of view; the nav itself is sticky.
 */

const TICKER_EL = [
  'ΔΩΡΕΑΝ ΑΠΟΣΤΟΛΗ ΑΝΩ ΤΩΝ 40 €',
  'ΓΝΗΣΙΑ ΠΡΟΪΟΝΤΑ ΑΠΟ ΕΠΙΣΗΜΟΥΣ ΔΙΑΝΟΜΕΙΣ',
  'ΑΠΟΣΤΟΛΗ ΣΕ 1-3 ΗΜΕΡΕΣ',
  'ΥΠΟΣΤΗΡΙΞΗ ΑΠΟ ΟΠΤΙΚΟΥΣ',
  'ΑΣΦΑΛΗΣ ΠΛΗΡΩΜΗ',
]
const TICKER_EN = [
  'FREE SHIPPING OVER 40 €',
  'GENUINE PRODUCTS FROM OFFICIAL DISTRIBUTORS',
  'DELIVERY IN 1-3 DAYS',
  'SUPPORT BY OPTICIANS',
  'SECURE PAYMENT',
]

/**
 * Scrolling promo bar.
 *
 * The list is duplicated and the track slides exactly -50%, which is what makes
 * the loop seamless — at the halfway point the second copy sits precisely where
 * the first started. `aria-hidden` on the duplicate keeps a screen reader from
 * reading every claim twice.
 */
export function PromoTicker({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const items = locale === 'el' ? TICKER_EL : TICKER_EN
  return (
    <div className="overflow-hidden py-2" style={{ background: INK }}>
      <div className="marquee-track items-center whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.14em]"
           style={{ color: SURFACE }}>
        {[0, 1].map(copy => (
          <span key={copy} className="flex items-center" aria-hidden={copy === 1 || undefined}>
            {items.map(text => (
              <span key={text} className="inline-flex items-center">
                {text}
                <span className="mx-7" style={{ color: SALE }}>◦ | ◦</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  )
}

export function StoreHeader({
  cartCount, locale = DEFAULT_LOCALE, customerName,
}: {
  cartCount: number
  locale?: Locale
  /** Set when a customer is signed in; switches the button to the account. */
  customerName?: string | null
}) {
  const t = translator(locale)

  const nav = [
    { href: '/proionta', label: t('nav.products') },
    { href: '/proionta#katigories', label: t('nav.categories') },
    { href: '/proionta#markes', label: t('nav.brands') },
    { href: '/syxnes-erotiseis', label: t('nav.faq') },
  ]

  return (
    <>
      <PromoTicker locale={locale} />

      <nav
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ background: 'rgb(255 255 255 / 94%)', borderColor: HAIRLINE }}
      >
        <div
          className="mx-auto flex flex-wrap items-center justify-between gap-2 py-3"
          style={{ maxWidth: MAX_W, paddingInline: GUTTER }}
        >
          <Link href="/" aria-label={`mylens, ${t('nav.home')}`} className="shrink-0">
            <Image src="/mylens-logo.svg" alt="mylens" width={54} height={30} priority />
          </Link>

          <div className="flex flex-wrap items-center gap-1">
            {nav.map(n => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-full px-[15px] py-[9px] text-[14px] font-semibold transition-colors hover:bg-[var(--nav-hover)]"
                style={{ color: INK, ['--nav-hover' as string]: CREAM }}
              >
                {n.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher current={locale} />

            <Link
              href={customerName ? '/logariasmos' : '/sindesi'}
              className="text-[14px] font-semibold transition-colors hover:text-[var(--hv)]"
              style={{ color: INK, ['--hv' as string]: PRIMARY }}
            >
              {customerName
                // First name only: a full Greek name blows out the header width.
                ? customerName.split(' ')[0]
                : t('nav.signIn')}
            </Link>

            <Link
              href="/kalathi"
              aria-label={cartCount > 0 ? `${t('nav.cart')}, ${cartCount}` : t('nav.cart')}
              className="flex items-center gap-2 px-5 py-2.5 text-[13.5px] font-bold transition-colors hover:bg-[var(--hv)]"
              style={{
                background: PRIMARY, color: SURFACE,
                borderRadius: R_PILL, ['--hv' as string]: PRIMARY_DEEP,
              }}
            >
              {t('nav.cart')}
              <span
                className="inline-flex size-[19px] items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums"
                style={{ background: SURFACE, color: PRIMARY }}
              >
                {cartCount}
              </span>
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}

/**
 * The sale pill from the design.
 *
 * Only rendered where a real, named offer exists — it takes its label and
 * target as props rather than hard-coding a discount, so nothing advertises a
 * percentage the shop is not actually running.
 */
export function SalePill({ label, href = '#deals' }: { label: string; href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-[9px] text-[13px] font-extrabold tracking-[0.04em] transition-colors"
      style={{ background: SALE_PALE, color: SALE, borderRadius: R_PILL }}
    >
      <span className="pulse-dot inline-block size-[7px] rounded-full" style={{ background: SALE }} />
      {label}
    </Link>
  )
}

export function StoreFooter({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const t = translator(locale)

  const legal = [
    { href: '/oroi-chrisis', label: t('footer.terms') },
    { href: '/aporrito', label: t('footer.privacy') },
    { href: '/cookies', label: t('footer.cookies') },
  ]
  const help = [
    { href: '/syxnes-erotiseis', label: t('nav.faq') },
    { href: '/apostoles', label: t('footer.shipping') },
    { href: '/epistrofes', label: t('footer.returns') },
  ]

  return (
    <footer className="border-t pb-9 pt-14" style={{ background: CANVAS, borderColor: HAIRLINE, paddingInline: GUTTER }}>
      <div
        className="mx-auto grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
        style={{ maxWidth: MAX_W }}
      >
        <div className="flex flex-col gap-4">
          <Image src="/mylens-logo.svg" alt="mylens" width={54} height={30} className="self-start" />
          <p className="max-w-[280px] text-[14px] leading-[1.65]" style={{ color: INK_MUTED }}>
            {locale === 'el'
              ? 'Φακοί επαφής, υγρά φροντίδας και γυαλιά από επίσημους διανομείς.'
              : 'Contact lenses, care solutions and eyewear from official distributors.'}
          </p>
          <LanguageSwitcher current={locale} />
        </div>

        <FooterColumn title={t('footer.legal')} links={legal} />
        <FooterColumn title={t('footer.help')} links={help} />

        <div className="flex flex-col gap-[11px] text-[14px]">
          <b className="text-[12px] uppercase tracking-[0.16em]" style={{ color: INK_FAINT }}>
            {t('footer.contact')}
          </b>
          <a href="mailto:support@mylens.gr" style={{ color: INK }}>support@mylens.gr</a>
          <a href="tel:+302100000000" style={{ color: INK }}>210 000 0000</a>
          <div className="mt-1">
            <CookieSettingsLink locale={locale} />
          </div>
        </div>
      </div>

      <div
        className="mx-auto mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-[13px]"
        style={{ maxWidth: MAX_W, color: INK_FAINT, borderColor: HAIRLINE }}
      >
        <span>© {new Date().getFullYear()} mylens.gr</span>
        <div className="flex items-center gap-6">
          <Link href="/login" className="transition-colors hover:text-black">
            {locale === 'el' ? 'Διαχείριση' : 'Admin'}
          </Link>
          <span className="italic">
            {locale === 'el' ? 'Δες τη διαφορά, καθαρά.' : 'See the difference, clearly.'}
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-[11px] text-[14px]">
      <b className="text-[12px] uppercase tracking-[0.16em]" style={{ color: INK_FAINT }}>
        {title}
      </b>
      {links.map(l => (
        <Link
          key={l.href}
          href={l.href}
          className="transition-colors hover:text-[var(--hv)]"
          style={{ color: INK, ['--hv' as string]: PRIMARY }}
        >
          {l.label}
        </Link>
      ))}
    </div>
  )
}
