'use client'

import { useMemo, useState } from 'react'
import { ProductCard } from '@/components/store/product-card'
import { QuickView } from '@/components/store/quick-view'
import { CREAM, HAIRLINE, INK, INK_FAINT, INK_MUTED, SURFACE, TEAL } from '@/components/store/tokens'
import type { StoreProduct } from '@/components/store/types'

type Facet = { name: string; count: number }

export function Catalog({
  products, categories, brands,
}: {
  products: StoreProduct[]
  categories: Facet[]
  brands: Facet[]
}) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [brand, setBrand] = useState<string | null>(null)
  const [sort, setSort] = useState<'popular' | 'price-asc' | 'price-desc' | 'name'>('popular')
  const [quick, setQuick] = useState<StoreProduct | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = products.filter(p => {
      if (cat && !p.categories.includes(cat)) return false
      if (brand && p.brand !== brand) return false
      if (q && !(`${p.name} ${p.nameEn ?? ''} ${p.sku ?? ''} ${p.brand ?? ''}`.toLowerCase().includes(q))) return false
      return true
    })
    const sorted = [...rows]
    if (sort === 'price-asc') sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    if (sort === 'price-desc') sorted.sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'el'))
    return sorted
  }, [products, query, cat, brand, sort])

  // The whole catalogue renders at once  ~208 cards is well inside what the
  // browser handles comfortably, and it means Cmd-F finds every product.
  const activeFilters = [cat, brand].filter(Boolean).length

  function reset() {
    setCat(null); setBrand(null); setQuery('')
  }

  return (
    <>
      {/* Toolbar */}
      <div
        className="sticky top-[72px] z-20 -mx-5 mb-6 border-b px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8"
        style={{ background: 'rgb(242 241 237 / 92%)', borderColor: HAIRLINE }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative flex-1 min-w-[200px]">
            <span className="sr-only">Αναζήτηση προϊόντων</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Αναζήτηση προϊόντος, μάρκας, SKU…"
              className="h-11 w-full rounded-full border px-5 text-sm outline-none transition-colors focus:border-black/40"
              style={{ borderColor: HAIRLINE, background: SURFACE, color: INK }}
            />
          </label>

          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            aria-label="Ταξινόμηση"
            className="h-11 cursor-pointer rounded-full border px-4 text-sm outline-none"
            style={{ borderColor: HAIRLINE, background: SURFACE, color: INK }}
          >
            <option value="popular">Δημοφιλή</option>
            <option value="price-asc">Τιμή: αύξουσα</option>
            <option value="price-desc">Τιμή: φθίνουσα</option>
            <option value="name">Αλφαβητικά</option>
          </select>

          {activeFilters > 0 && (
            <button
              onClick={reset}
              className="h-11 cursor-pointer rounded-full px-4 text-sm font-semibold"
              style={{ background: TEAL, color: INK }}
            >
              Καθαρισμός ({activeFilters})
            </button>
          )}

          <span className="ml-auto text-[13px] tabular-nums" style={{ color: INK_MUTED }}>
            {filtered.length} προϊόντα
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Facets */}
        <aside className="space-y-5 lg:sticky lg:top-[148px] lg:h-fit">
          <Facets id="katigories" title="Κατηγορίες" items={categories} active={cat}
                  onPick={setCat} />
          <Facets id="markes" title="Μάρκες" items={brands} active={brand}
                  onPick={setBrand} />
        </aside>

        {/* Grid */}
        <div>
          {filtered.length === 0 ? (
            <div
              className="grid place-items-center rounded-3xl px-6 py-24 text-center"
              style={{ background: CREAM }}
            >
              <p className="text-lg font-semibold" style={{ color: INK }}>Δεν βρέθηκαν προϊόντα.</p>
              <p className="mt-2 max-w-sm text-sm" style={{ color: INK_MUTED }}>
                Δοκίμασε διαφορετική αναζήτηση ή καθάρισε τα φίλτρα.
              </p>
              <button onClick={reset}
                      className="mt-6 cursor-pointer rounded-full px-6 py-3 text-sm font-semibold"
                      style={{ background: INK, color: '#fff' }}>
                Καθαρισμός φίλτρων
              </button>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p, i) => (
                  <li key={p.id}>
                    <ProductCard product={p} onQuickView={setQuick} priority={i < 4} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </>
  )
}

function Facets({
  id, title, items, active, onPick,
}: {
  id: string; title: string; items: Facet[]
  active: string | null; onPick: (v: string | null) => void
}) {
  return (
    <section id={id} className="rounded-3xl p-5" style={{ background: SURFACE }}>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: INK_MUTED }}>{title}</h2>
      <ul className="space-y-1">
        {items.map(f => {
          const on = active === f.name
          return (
            <li key={f.name}>
              <button
                onClick={() => onPick(on ? null : f.name)}
                aria-pressed={on}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition-colors"
                style={on
                  ? { background: TEAL, color: INK, fontWeight: 700 }
                  : { color: INK }}
              >
                <span className="truncate">{f.name}</span>
                <span className="ml-2 shrink-0 text-[11px] tabular-nums"
                      style={{ color: on ? INK : INK_FAINT, opacity: on ? 0.75 : 1 }}>
                  {f.count}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
