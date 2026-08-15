import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readCart } from '@/lib/cart'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import {
  CANVAS, INK, INK_MUTED,
} from '@/components/store/tokens'
import { AuthForms } from './auth-forms'

export const dynamic = 'force-dynamic'

export default async function SignInPage() {
  const session = await getCustomerSession()
  if (session) redirect('/logariasmos')

  const { locale, t } = await getT()
  const cart = await readCart(locale)

  return (
    <div className="min-h-screen font-store" style={{ background: CANVAS, color: INK }}>
      <StoreHeader cartCount={cart.lines.reduce((n, l) => n + l.quantity, 0)} locale={locale} />

      <main className="mx-auto max-w-[1000px] px-5 py-10 sm:px-8">
        <nav className="mb-6 text-[12.5px]" style={{ color: INK_MUTED }}>
          <Link href="/" className="hover:text-black">{t('nav.home')}</Link>
          <span className="mx-1.5">/</span>
          <span>{t('auth.signIn')}</span>
        </nav>

        <h1 className="mb-8 font-store-display text-[32px] font-black leading-[1.05] tracking-[-0.02em] sm:text-[40px]">
          {t('nav.account')}
        </h1>

        <AuthForms locale={locale} />
      </main>

      <StoreFooter locale={locale} />
    </div>
  )
}
