import Image from 'next/image'
import Link from 'next/link'
import { DEFAULT_LOCALE, translator, type Locale } from '@/lib/i18n'
import { CookieSettingsLink } from './cookie-settings-link'
import { ICON_MD, ShoppingBagOpen, SignIn } from './icons'
import { LanguageSwitcher } from './language-switcher'
import { HAIRLINE, INK, INK_MUTED, SURFACE } from './tokens'

/** Shared chrome. Single line at desktop, 72px tall (cap is 80). */
export function StoreHeader({
  cartCount, locale = DEFAULT_LOCALE, customerName,
}: {
  cartCount: number
  locale?: Locale
  /** Set when a customer is signed in; switches the button to the account. */
  customerName?: string | null
}) {
  const t = translator(locale)

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{ background: 'rgb(242 241 237 / 88%)', borderColor: HAIRLINE }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label={`mylens, ${t('nav.home')}`} className="shrink-0">
          <Image src="/mylens-logo.svg" alt="mylens" width={64} height={36} priority />
        </Link>

        <nav aria-label={t('nav.products')} className="hidden items-center gap-7 text-[13.5px] md:flex">
          <Link href="/proionta" className="transition-colors hover:text-black" style={{ color: INK_MUTED }}>{t('nav.products')}</Link>
          <Link href="/proionta#katigories" className="transition-colors hover:text-black" style={{ color: INK_MUTED }}>{t('nav.categories')}</Link>
          <Link href="/proionta#markes" className="transition-colors hover:text-black" style={{ color: INK_MUTED }}>{t('nav.brands')}</Link>
          <Link href="/syxnes-erotiseis" className="transition-colors hover:text-black" style={{ color: INK_MUTED }}>{t('nav.faq')}</Link>
        </nav>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block">
            <LanguageSwitcher current={locale} />
          </div>

          <Link
            href="/kalathi"
            aria-label={cartCount > 0 ? `${t('nav.cart')}, ${cartCount}` : t('nav.cart')}
            className="flex h-11 items-center gap-2 rounded-full border px-4 text-[13px] transition-colors hover:border-black/35"
            style={{ borderColor: HAIRLINE, color: INK, background: SURFACE }}
          >
            <ShoppingBagOpen size={ICON_MD} />
            <span className="hidden sm:inline">{t('nav.cart')}</span>
            {cartCount > 0 && (
              <span
                className="rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                style={{ background: INK, color: SURFACE }}
              >
                {cartCount}
              </span>
            )}
          </Link>

          <Link
            href={customerName ? '/logariasmos' : '/sindesi'}
            className="flex h-11 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-transform motion-safe:hover:-translate-y-0.5"
            style={{ background: INK, color: SURFACE }}
          >
            <SignIn size={ICON_MD} />
            <span className="hidden sm:inline">
              {customerName
                // First name only: a full name blows the header width out on
                // the Greek names in this customer base.
                ? customerName.split(' ')[0]
                : t('nav.signIn')}
            </span>
          </Link>
        </div>
      </div>
    </header>
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
    <footer className="overflow-hidden border-t" style={{ borderColor: HAIRLINE }}>
      <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Image src="/mylens-logo.svg" alt="mylens" width={64} height={36} />
            <p className="mt-3 max-w-[28ch] text-[13px]" style={{ color: INK_MUTED }}>
              {locale === 'el'
                ? 'Φακοί επαφής, υγρά φροντίδας και γυαλιά από επίσημους διανομείς.'
                : 'Contact lenses, care solutions and eyewear from official distributors.'}
            </p>
          </div>

          <FooterColumn title={t('footer.legal')} links={legal} />
          <FooterColumn title={t('footer.help')} links={help} />

          <div>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: INK_MUTED }}>
              {t('nav.language')}
            </h2>
            <LanguageSwitcher current={locale} />
            <div className="mt-4">
              <CookieSettingsLink locale={locale} />
            </div>
          </div>
        </div>

        <div
          className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-[13px]"
          style={{ color: INK_MUTED, borderColor: HAIRLINE }}
        >
          <span>© {new Date().getFullYear()} mylens.gr</span>
          <div className="flex items-center gap-6">
            <a href="https://www.mylens.gr" target="_blank" rel="noopener noreferrer"
               className="transition-colors hover:text-black">mylens.gr</a>
            <Link href="/login" className="transition-colors hover:text-black">
              {locale === 'el' ? 'Διαχείριση' : 'Admin'}
            </Link>
          </div>
        </div>
      </div>

      <p
        aria-hidden
        className="-mb-[2.2vw] select-none px-5 font-store-display font-black text-[19vw] uppercase leading-[0.72] tracking-[-0.02em] sm:px-8"
        style={{ color: 'rgb(20 24 26 / 6%)' }}
      >
        mylens
      </p>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: INK_MUTED }}>
        {title}
      </h2>
      <ul className="space-y-1.5 text-[13px]">
        {links.map(l => (
          <li key={l.href}>
            <Link href={l.href} className="transition-colors hover:text-black" style={{ color: INK_MUTED }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
