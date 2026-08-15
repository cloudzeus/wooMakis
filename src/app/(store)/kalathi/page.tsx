import Link from 'next/link'
import { readCart } from '@/lib/cart'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import {
  CANVAS, HAIRLINE, INK, INK_MUTED, SURFACE,
} from '@/components/store/tokens'
import { CartLines } from './cart-lines'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const { locale, t } = await getT()
  const [cart, session] = await Promise.all([readCart(locale), getCustomerSession()])

  return (
    <div className="min-h-screen font-store" style={{ background: CANVAS, color: INK }}>
      <StoreHeader
        cartCount={cart.lines.reduce((n, l) => n + l.quantity, 0)}
        locale={locale}
        customerName={session?.name}
      />

      <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
        <nav className="mb-6 text-[12.5px]" style={{ color: INK_MUTED }}>
          <Link href="/" className="hover:text-black">{t('nav.home')}</Link>
          <span className="mx-1.5">/</span>
          <span>{t('nav.cart')}</span>
        </nav>

        <h1 className="mb-8 font-store-display text-[32px] font-black leading-[1.05] tracking-[-0.02em] sm:text-[40px]">
          {locale === 'el' ? 'Καλάθι αγορών' : 'Shopping cart'}
        </h1>

        {cart.lines.length === 0 ? (
          <div
            className="rounded-3xl px-6 py-16 text-center"
            style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
          >
            <p className="text-lg">
              {locale === 'el' ? 'Το καλάθι σου είναι άδειο.' : 'Your cart is empty.'}
            </p>
            <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
              {locale === 'el'
                ? 'Διάλεξε προϊόντα από τον κατάλογο για να ξεκινήσεις.'
                : 'Pick something from the catalogue to get started.'}
            </p>
            <Link
              href="/proionta"
              className="mt-6 inline-block rounded-full px-7 py-3 text-[14px] font-bold"
              style={{ background: INK, color: SURFACE }}
            >
              {t('nav.products')}
            </Link>
          </div>
        ) : (
          <CartLines cart={cart} />
        )}
      </main>

      <StoreFooter locale={locale} />
    </div>
  )
}
