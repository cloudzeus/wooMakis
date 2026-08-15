import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readCart } from '@/lib/cart'
import { ordersEnabled } from '@/lib/woo/orders'
import { CheckoutForm } from './checkout-form'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const cart = await readCart('el')
  if (cart.lines.length === 0) redirect('/kalathi')

  return (
    <div className="min-h-screen bg-white text-[#0f2429]">
      <header className="border-b border-black/5">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/">
            <Image src="/mylens-logo.svg" alt="mylens" width={70} height={40} priority />
          </Link>
          <Link href="/kalathi" className="text-sm hover:text-[#00cfc9]">← Πίσω στο καλάθι</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">Ολοκλήρωση παραγγελίας</h1>
        <p className="mb-8 text-sm text-[#0f2429]/60">
          Συμπλήρωσε τα στοιχεία παράδοσης. Στο επόμενο βήμα θα μεταφερθείς στη
          σελίδα πληρωμής του mylens.gr για να επιλέξεις τρόπο πληρωμής.
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
    </div>
  )
}
