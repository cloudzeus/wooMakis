'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ProductCard } from '@/components/store/product-card'
import { QuickView } from '@/components/store/quick-view'
import {
  INK, INK_MUTED, R_CARD, SURFACE,
} from '@/components/store/tokens'
import type { StoreProduct } from '@/components/store/types'

/** Home product strip. Client-side only because quick view needs local state. */
export function HomeShowcase({ products }: { products: StoreProduct[] }) {
  const [quick, setQuick] = useState<StoreProduct | null>(null)

  return (
    <section className="mt-3 p-8 sm:p-11" style={{ background: SURFACE, borderRadius: R_CARD }}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <h2
          className="font-store-display font-black text-[clamp(28px,4vw,38px)] uppercase leading-[0.95] tracking-[-0.01em]"
          style={{ color: INK }}
        >
          Δημοφιλή<br />προϊόντα
        </h2>
        <div className="flex items-end gap-6">
          <p className="hidden max-w-xs text-[13.5px] leading-relaxed sm:block" style={{ color: INK_MUTED }}>
            Η πληρωμή ολοκληρώνεται με ασφάλεια στο mylens.gr  δεν αποθηκεύουμε
            στοιχεία κάρτας.
          </p>
          <Link
            href="/proionta"
            className="shrink-0 rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:border-black/40"
            style={{ borderColor: 'rgb(11 15 16 / 14%)', color: INK }}
          >
            Όλα →
          </Link>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {products.map((p, i) => (
          <li key={p.id}>
            <ProductCard product={p} onQuickView={setQuick} priority={i < 4} />
          </li>
        ))}
      </ul>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </section>
  )
}
