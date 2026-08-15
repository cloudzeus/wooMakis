import Image from 'next/image'
import Link from 'next/link'
import { readCart } from '@/lib/cart'
import { CartLines } from './cart-lines'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const cart = await readCart('el')

  return (
    <div className="min-h-screen bg-white font-store text-[#0f2429]">
      <header className="border-b border-black/5">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/">
            <Image src="/mylens-logo.svg" alt="mylens" width={70} height={40} priority />
          </Link>
          <Link href="/" className="text-sm hover:text-[#00cfc9]">← Συνέχεια αγορών</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="mb-8 text-3xl font-semibold tracking-tight">Καλάθι αγορών</h1>

        {cart.lines.length === 0 ? (
          <div className="rounded-2xl border border-black/8 px-6 py-16 text-center">
            <p className="text-lg">Το καλάθι σου είναι άδειο.</p>
            <p className="mt-2 text-sm text-[#0f2429]/60">
              Διάλεξε προϊόντα από τον κατάλογο για να ξεκινήσεις.
            </p>
            <Link
              href="/#proionta"
              className="mt-6 inline-block rounded-full bg-[#00cfc9] px-7 py-3 font-medium text-white"
            >
              Δες τα προϊόντα
            </Link>
          </div>
        ) : (
          <CartLines cart={cart} />
        )}
      </main>
    </div>
  )
}
