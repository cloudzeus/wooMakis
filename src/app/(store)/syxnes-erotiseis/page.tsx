import Link from 'next/link'
import { readCart } from '@/lib/cart'
import { getFaq } from '@/lib/content'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import { CANVAS, INK, INK_MUTED } from '@/components/store/tokens'
import { FaqList } from './faq-list'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const { locale } = await getT()
  return {
    title: locale === 'el' ? 'Συχνές ερωτήσεις | mylens.gr' : 'FAQ | mylens.gr',
  }
}

export default async function FaqPage() {
  const { locale, t } = await getT()
  const [groups, cart, session] = await Promise.all([
    getFaq(locale),
    readCart(locale),
    getCustomerSession(),
  ])

  return (
    <div className="min-h-screen font-store" style={{ background: CANVAS, color: INK }}>
      <StoreHeader
        cartCount={cart.lines.reduce((n, l) => n + l.quantity, 0)}
        locale={locale}
        customerName={session?.name}
      />

      <main className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8">
        <nav className="mb-6 text-[12.5px]" style={{ color: INK_MUTED }}>
          <Link href="/" className="hover:text-black">{t('nav.home')}</Link>
          <span className="mx-1.5">/</span>
          <span>{t('nav.faq')}</span>
        </nav>

        <div className="mx-auto max-w-[72ch]">
          <h1 className="font-store-display text-[34px] font-black leading-[1.05] tracking-[-0.02em] sm:text-[44px]">
            {t('nav.faq')}
          </h1>
          <p className="mb-8 mt-3 text-[15px] leading-relaxed" style={{ color: INK_MUTED }}>
            {locale === 'el'
              ? 'Αν δεν βρεις αυτό που ψάχνεις, γράψε μας και θα σου απαντήσουμε.'
              : 'If you cannot find what you are looking for, write to us and we will answer.'}
          </p>

          {groups.length === 0 ? (
            <p
              className="rounded-2xl border border-dashed px-6 py-12 text-center text-[14px]"
              style={{ borderColor: 'rgb(20 24 26 / 18%)', color: INK_MUTED }}
            >
              {locale === 'el'
                ? 'Δεν έχουν καταχωρηθεί ερωτήσεις ακόμα.'
                : 'No questions have been added yet.'}
            </p>
          ) : (
            <FaqList
              groups={groups}
              searchLabel={locale === 'el' ? 'Αναζήτηση στις ερωτήσεις…' : 'Search the questions…'}
              emptyLabel={locale === 'el' ? 'Καμία ερώτηση δεν ταιριάζει.' : 'No question matches.'}
            />
          )}
        </div>
      </main>

      <StoreFooter locale={locale} />
    </div>
  )
}
