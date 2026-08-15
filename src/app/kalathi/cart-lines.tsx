'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTransition } from 'react'
import type { CartView } from '@/lib/cart'
import { removeFromCart, setQuantity } from './actions'
import { EYE_LABEL, EYE_SHORT } from '@/lib/lens-attributes'

export function CartLines({ cart }: { cart: CartView }) {
  const [pending, start] = useTransition()

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <ul className="space-y-4">
        {cart.lines.map(line => (
          <li
            key={line.lineKey}
            className="flex gap-4 rounded-2xl border border-black/8 p-4"
          >
            <div className="w-24 shrink-0 overflow-hidden rounded-xl bg-[#f5f8f8]">
              {line.imageUrl && (
                <Image
                  src={line.imageUrl}
                  alt={line.name}
                  width={96}
                  height={96}
                  className="aspect-square w-full object-cover"
                  unoptimized
                />
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between">
              <div>
                <h2 className="font-medium leading-snug">{line.name}</h2>
                {line.eye !== 'BOTH' && (
                  <p className="mt-0.5 text-xs font-semibold" style={{ color: '#007D79' }}>
                    {EYE_LABEL[line.eye]} ({EYE_SHORT[line.eye]})
                  </p>
                )}
                {Object.keys(line.selections).length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#0f2429]/60">
                    {Object.entries(line.selections).map(([k, v]) => (
                      <li key={k}>
                        {k.replace(/^Ιδιότητα\s*[-–]\s*/, '')}: <strong className="tabular-nums">{v}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-0.5 text-sm">
                  <span className="tabular-nums">{line.unitPrice.toFixed(2)} €</span>
                  {line.onSale && line.regularPrice && (
                    <span className="ml-2 text-[#0f2429]/40 line-through tabular-nums">
                      {line.regularPrice.toFixed(2)} €
                    </span>
                  )}
                </p>
                {line.stockStatus !== 'instock' && (
                  <p className="mt-1 text-xs text-amber-600">⚠ Εξαντλημένο</p>
                )}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center rounded-full border border-black/10">
                  <button
                    onClick={() => start(async () => { await setQuantity(line.lineKey, line.quantity - 1) })}
                    disabled={pending}
                    aria-label="Μείωση ποσότητας"
                    className="h-8 w-8 cursor-pointer rounded-full hover:bg-black/5 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-9 text-center text-sm tabular-nums">{line.quantity}</span>
                  <button
                    onClick={() => start(async () => { await setQuantity(line.lineKey, line.quantity + 1) })}
                    disabled={pending}
                    aria-label="Αύξηση ποσότητας"
                    className="h-8 w-8 cursor-pointer rounded-full hover:bg-black/5 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => start(async () => { await removeFromCart(line.lineKey) })}
                  disabled={pending}
                  className="cursor-pointer text-sm text-[#0f2429]/50 hover:text-red-600 disabled:opacity-40"
                >
                  Αφαίρεση
                </button>

                <span className="ml-auto font-semibold tabular-nums">
                  {line.lineTotal.toFixed(2)} €
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-2xl border border-black/8 p-6">
        <h2 className="mb-4 text-lg font-semibold">Σύνοψη</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Προϊόντα ({cart.itemCount})</dt>
            <dd className="tabular-nums">{cart.subtotal.toFixed(2)} €</dd>
          </div>
          <div className="flex justify-between text-[#0f2429]/60">
            <dt>Μεταφορικά</dt>
            <dd>υπολογίζονται στην πληρωμή</dd>
          </div>
        </dl>
        <div className="mt-4 flex justify-between border-t border-black/8 pt-4 text-base font-semibold">
          <span>Σύνολο</span>
          <span className="tabular-nums">{cart.subtotal.toFixed(2)} €</span>
        </div>

        <Link
          href="/checkout"
          className="mt-6 block rounded-full bg-[#0f2429] px-6 py-3 text-center font-medium text-white transition-colors hover:bg-[#00cfc9]"
        >
          Ολοκλήρωση παραγγελίας
        </Link>

        <p className="mt-3 text-center text-xs text-[#0f2429]/50">
          Η πληρωμή γίνεται με ασφάλεια στο mylens.gr.<br />
          Δεν αποθηκεύουμε στοιχεία κάρτας.
        </p>
      </aside>
    </div>
  )
}
