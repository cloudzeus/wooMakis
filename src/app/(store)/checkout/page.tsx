import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readCart } from '@/lib/cart'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import { ordersEnabled } from '@/lib/woo/orders'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import {
  CANVAS, INK, INK_MUTED,
} from '@/components/store/tokens'
import { CheckoutForm } from './checkout-form'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const { locale, t } = await getT()
  const cart = await readCart(locale)
  if (cart.lines.length === 0) redirect('/kalathi')

  const session = await getCustomerSession()

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
          <Link href="/kalathi" className="hover:text-black">{t('nav.cart')}</Link>
          <span className="mx-1.5">/</span>
          <span>{locale === 'el' ? 'Ολοκλήρωση' : 'Checkout'}</span>
        </nav>

        <h1 className="mb-2 font-store-display text-[32px] font-black leading-[1.05] tracking-[-0.02em] sm:text-[40px]">
          {locale === 'el' ? 'Ολοκλήρωση παραγγελίας' : 'Checkout'}
        </h1>
        <p className="mb-8 max-w-[60ch] text-sm" style={{ color: INK_MUTED }}>
          {locale === 'el'
            ? 'Συμπλήρωσε τα στοιχεία παράδοσης. Στο επόμενο βήμα θα μεταφερθείς στη σελίδα πληρωμής του mylens.gr για να επιλέξεις τρόπο πληρωμής.'
            : 'Fill in your delivery details. Next you will be taken to the mylens.gr payment page to choose how to pay.'}
        </p>

        <CheckoutForm
          ordersEnabled={ordersEnabled()}
          summary={{
            itemCount: cart.itemCount,
            subtotal: cart.subtotal,
            lines: cart.lines.map(l => ({
              name: l.name, quantity: l.quantity, lineTotal: l.lineTotal,
            })),
          }}
        />
      </main>

      <StoreFooter locale={locale} />
    </div>
  )
}
