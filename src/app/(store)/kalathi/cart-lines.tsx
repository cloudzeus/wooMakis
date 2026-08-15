'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useTransition } from 'react'
import type { CartLineView, CartView } from '@/lib/cart'
import { removeFromCart, setQuantity } from './actions'

/**
 * Cart display.
 *
 * A pair of lenses is one product and one line, carrying both eyes' powers in
 * its selections. Grouping by product is kept because a customer can still hold
 * two different pairs of the same lens, e.g. one for each of two prescriptions.
 */
type Group = {
  productId: string
  name: string
  imageUrl: string | null
  slug: string
  stockStatus: string
  lines: CartLineView[]
  total: number
}

function groupByProduct(lines: CartLineView[]): Group[] {
  const map = new Map<string, Group>()
  for (const l of lines) {
    const g = map.get(l.productId)
    if (g) {
      g.lines.push(l)
      g.total = Math.round((g.total + l.lineTotal) * 100) / 100
    } else {
      map.set(l.productId, {
        productId: l.productId,
        name: l.name,
        imageUrl: l.imageUrl,
        slug: l.slug,
        stockStatus: l.stockStatus,
        lines: [l],
        total: l.lineTotal,
      })
    }
  }
  // Right before left, so the card reads the way a prescription does.
  const order = { RIGHT: 0, LEFT: 1, BOTH: 2 } as const
  for (const g of map.values()) g.lines.sort((a, b) => order[a.eye] - order[b.eye])
  return [...map.values()]
}

function attrLabel(name: string): string {
  return name.replace(/^Ιδιότητα\s*[-–]\s*/, '')
}

export function CartLines({ cart }: { cart: CartView }) {
  const [pending, start] = useTransition()
  const groups = useMemo(() => groupByProduct(cart.lines), [cart.lines])

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <ul className="space-y-4">
        {groups.map(g => (
          <li key={g.productId} className="rounded-2xl border border-black/8 p-4">
            <div className="flex gap-4">
              <Link
                href={`/proionta/${encodeURIComponent(g.slug)}`}
                className="w-24 shrink-0 overflow-hidden rounded-xl bg-white"
              >
                {g.imageUrl && (
                  <Image
                    src={g.imageUrl}
                    alt={g.name}
                    width={96}
                    height={96}
                    className="aspect-square w-full object-contain p-1.5"
                    unoptimized
                  />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-medium leading-snug">
                    <Link href={`/proionta/${encodeURIComponent(g.slug)}`} className="hover:underline">
                      {g.name}
                    </Link>
                  </h2>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {g.total.toFixed(2)} €
                  </span>
                </div>

                {g.stockStatus !== 'instock' && (
                  <p className="mt-1 text-xs text-amber-600">Εξαντλημένο</p>
                )}

                {/* One row per distinct selection of this product */}
                <ul className="mt-3 divide-y divide-black/5">
                  {g.lines.map(line => (
                    <li key={line.lineKey} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                      <div className="min-w-[9rem] flex-1">
                        {Object.keys(line.selections).length > 0 ? (
                          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                            {Object.entries(line.selections).map(([k, v]) => (
                              <div key={k} className="flex items-baseline gap-1.5">
                                <dt className="text-[#0f2429]/55">{attrLabel(k)}</dt>
                                <dd className="font-semibold tabular-nums" style={{ color: '#007D79' }}>{v}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="text-[13px] text-[#0f2429]/60">Ποσότητα</p>
                        )}
                      </div>

                      <div className="flex items-center rounded-full border border-black/10">
                        <button
                          onClick={() => start(async () => { await setQuantity(line.lineKey, line.quantity - 1) })}
                          disabled={pending}
                          aria-label="Μείωση ποσότητας"
                          className="h-8 w-8 cursor-pointer rounded-full hover:bg-black/5 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                        <button
                          onClick={() => start(async () => { await setQuantity(line.lineKey, line.quantity + 1) })}
                          disabled={pending}
                          aria-label="Αύξηση ποσότητας"
                          className="h-8 w-8 cursor-pointer rounded-full hover:bg-black/5 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>

                      <span className="w-20 text-right text-sm tabular-nums text-[#0f2429]/70">
                        {line.lineTotal.toFixed(2)} €
                      </span>

                      <button
                        onClick={() => start(async () => { await removeFromCart(line.lineKey) })}
                        disabled={pending}
                        aria-label={`Αφαίρεση ${g.name}`}
                        className="cursor-pointer text-sm text-[#0f2429]/45 hover:text-red-600 disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-2xl border border-black/8 p-6">
        <h2 className="mb-4 text-lg font-semibold">Σύνοψη</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Προϊόντα ({groups.length})</dt>
            <dd className="tabular-nums">{cart.subtotal.toFixed(2)} €</dd>
          </div>
          <div className="flex justify-between text-[#0f2429]/60">
            <dt>Κουτιά</dt>
            <dd className="tabular-nums">{cart.itemCount}</dd>
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
