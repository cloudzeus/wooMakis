'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { addToCart } from '@/app/(store)/kalathi/actions'
import { EyePicker } from '@/components/store/eye-picker'
import { needsSelection } from '@/lib/lens-attributes'
import { ProductCard } from '@/components/store/product-card'
import { QuickView } from '@/components/store/quick-view'
import {
  ArrowUpRight, CheckCircle, ICON_MD, ICON_SM, Minus, Plus, Truck, WarningCircle,
} from '@/components/store/icons'
import {
  CREAM, HAIRLINE, INK, INK_FAINT, INK_MUTED, R_CARD, R_INNER,
  SURFACE, SURFACE_PRODUCT, TEAL, TEAL_DEEP,
} from '@/components/store/tokens'
import type { StoreProduct } from '@/components/store/types'

/** WooCommerce descriptions carry markup; render as text rather than dangerously. */
function paragraphs(html: string | null): string[] {
  if (!html) return []
  return html
    .replace(/<\/(p|div|li|br)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export function ProductView({
  product, related,
}: {
  product: StoreProduct
  related: StoreProduct[]
}) {
  const [active, setActive] = useState(0)
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const [quick, setQuick] = useState<StoreProduct | null>(null)

  const img = product.images[active] ?? product.images[0]
  const out = product.stockStatus !== 'instock'
  const body = paragraphs(product.description) .length
    ? paragraphs(product.description)
    : paragraphs(product.shortDescription)

    // Any product with something to choose uses the picker, not just lenses:
  // a hat needs its size selected before it can be bought.
  const perEye = needsSelection(product.attributes)

  const discount =
    product.onSale && product.regularPrice && product.price
      ? Math.round((1 - product.price / product.regularPrice) * 100)
      : null

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Gallery */}
        <div className="lg:col-span-7">
          <div
            className="relative aspect-square w-full overflow-hidden"
            style={{ background: SURFACE_PRODUCT, borderRadius: R_CARD }}
          >
            {img && (
              <Image
                src={img.url}
                alt={img.alt ?? product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 55vw"
                priority
                className="object-contain p-10"
                unoptimized
              />
            )}
            {discount !== null && (
              <span
                className="absolute left-5 top-5 rounded-full px-3 py-1.5 text-[12px] font-bold tabular-nums"
                style={{ background: INK, color: SURFACE }}
              >
                -{discount}%
              </span>
            )}
          </div>

          {product.images.length > 1 && (
            <ul className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
              {product.images.map((im, i) => (
                <li key={im.url}>
                  <button
                    onClick={() => setActive(i)}
                    aria-label={`Εικόνα ${i + 1} από ${product.images.length}`}
                    aria-current={i === active}
                    className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-2xl border-2 transition-colors"
                    style={{
                      background: SURFACE_PRODUCT,
                      borderColor: i === active ? TEAL : HAIRLINE,
                    }}
                  >
                    <Image src={im.url} alt="" fill sizes="80px" className="object-contain p-2" unoptimized />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-5">
          <div className="p-7 sm:p-9" style={{ background: SURFACE, borderRadius: R_CARD }}>
            {product.brand && (
              <Link
                href={`/proionta?brand=${encodeURIComponent(product.brand)}`}
                className="text-[11px] font-bold uppercase tracking-[0.15em] hover:underline"
                style={{ color: TEAL_DEEP }}
              >
                {product.brand}
              </Link>
            )}

            <h1
              className="mt-2.5 font-store-display font-black text-[clamp(26px,3.4vw,38px)] leading-[1.02] tracking-[-0.01em]"
              style={{ color: INK }}
            >
              {product.name}
            </h1>

            {product.nameEn && product.nameEn !== product.name && (
              <p className="mt-1.5 text-[14px]" style={{ color: INK_MUTED }}>{product.nameEn}</p>
            )}

            <div className="mt-6 flex items-baseline gap-3">
              {product.price !== null && (
                <span className="text-[34px] font-bold tabular-nums" style={{ color: INK }}>
                  {product.price.toFixed(2)} €
                </span>
              )}
              {product.onSale && product.regularPrice !== null && (
                <span className="text-[16px] tabular-nums line-through" style={{ color: INK_FAINT }}>
                  {product.regularPrice.toFixed(2)} €
                </span>
              )}
            </div>

            <p
              className="mt-3 flex items-center gap-1.5 text-[13.5px]"
              style={{ color: out ? '#B45309' : '#15803D' }}
            >
              {out ? <WarningCircle size={ICON_SM} /> : <CheckCircle size={ICON_SM} />}
              {out ? 'Εξαντλημένο' : 'Διαθέσιμο'}
            </p>

            {product.sku && (
              <p className="mt-1 text-[12.5px]" style={{ color: INK_FAINT }}>SKU {product.sku}</p>
            )}

            {/* Buy */}
            {perEye ? (
              <div className="mt-7">
                <EyePicker product={product} />
              </div>
            ) : (
            <div className="mt-7 flex items-center gap-3">
              <div className="flex items-center rounded-full border" style={{ borderColor: HAIRLINE }}>
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  aria-label="Μείωση ποσότητας"
                  className="grid h-12 w-12 cursor-pointer place-items-center rounded-full hover:bg-black/5"
                >
                  <Minus size={ICON_SM} />
                </button>
                <span className="w-9 text-center text-[15px] tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty(q => Math.min(99, q + 1))}
                  aria-label="Αύξηση ποσότητας"
                  className="grid h-12 w-12 cursor-pointer place-items-center rounded-full hover:bg-black/5"
                >
                  <Plus size={ICON_SM} />
                </button>
              </div>

              <button
                disabled={pending || out}
                onClick={() =>
                  start(async () => {
                    const r = await addToCart(product.id, qty)
                    setMsg(r.ok
                      ? { ok: true, text: `Προστέθηκε στο καλάθι (${r.itemCount} προϊόντα).` }
                      : { ok: false, text: r.error })
                  })
                }
                className="h-12 flex-1 cursor-pointer rounded-full text-[14px] font-bold transition-transform disabled:opacity-40 motion-safe:hover:-translate-y-0.5"
                style={{ background: INK, color: SURFACE }}
              >
                {pending ? 'Προσθήκη…' : out ? 'Εξαντλημένο' : 'Προσθήκη στο καλάθι'}
              </button>
            </div>
            )}

            {!perEye && msg && (
              <p
                role="status"
                className="mt-4 rounded-xl px-3 py-2 text-[13px]"
                style={msg.ok
                  ? { background: 'rgb(21 128 61 / 10%)', color: '#15803D' }
                  : { background: 'rgb(185 28 28 / 8%)', color: '#B91C1C' }}
              >
                {msg.text}
              </p>
            )}

            <p
              className="mt-5 flex items-start gap-2 rounded-2xl p-3.5 text-[12.5px]"
              style={{ background: CREAM, color: INK_MUTED }}
            >
              <Truck size={ICON_MD} />
              <span>
                Αποστολή σε όλη την Ελλάδα σε 1 έως 3 ημέρες. Η πληρωμή ολοκληρώνεται
                με ασφάλεια στο mylens.gr, δεν αποθηκεύουμε στοιχεία κάρτας.
              </span>
            </p>

            {!perEye && product.attributes.length > 0 && (
              <dl className="mt-7 space-y-4 border-t pt-6" style={{ borderColor: HAIRLINE }}>
                {product.attributes.map(a => (
                  <div key={a.name}>
                    <dt className="text-[10.5px] font-bold uppercase tracking-[0.13em]" style={{ color: INK_MUTED }}>
                      {a.name}
                    </dt>
                    <dd className="mt-2 flex flex-wrap gap-1.5">
                      {a.options.map(o => (
                        <span
                          key={o}
                          className="rounded-full px-3 py-1.5 text-[12.5px]"
                          style={{ background: CREAM, color: INK }}
                        >
                          {o}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {product.permalink && (
              <a
                href={product.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex items-center justify-center gap-1.5 text-[12.5px] underline underline-offset-2"
                style={{ color: INK_MUTED }}
              >
                Δες το στο mylens.gr
                <ArrowUpRight size={ICON_SM} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {body.length > 0 && (
        <section className="mt-4 p-8 sm:p-11" style={{ background: SURFACE, borderRadius: R_CARD }}>
          <h2
            className="mb-5 font-store-display font-black text-[26px] uppercase tracking-[-0.005em]"
            style={{ color: INK }}
          >
            Περιγραφή
          </h2>
          <div className="max-w-[68ch] space-y-3.5">
            {body.map((para, i) => (
              <p key={i} className="text-[15px] leading-[1.7]" style={{ color: INK_MUTED }}>
                {para}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-4 p-8 sm:p-11" style={{ background: CREAM, borderRadius: R_CARD }}>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <h2
              className="font-store-display font-black text-[clamp(24px,3vw,32px)] uppercase leading-[0.95] tracking-[-0.005em]"
              style={{ color: INK }}
            >
              Σχετικά προϊόντα
            </h2>
            <Link
              href={product.brand
                ? `/proionta?brand=${encodeURIComponent(product.brand)}`
                : '/proionta'}
              className="rounded-full border px-5 py-2.5 text-[13px] font-semibold transition-colors hover:border-black/40"
              style={{ borderColor: HAIRLINE, color: INK }}
            >
              {product.brand ? `Όλα τα ${product.brand}` : 'Όλα τα προϊόντα'}
            </Link>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map(p => (
              <li key={p.id}>
                <ProductCard product={p} onQuickView={setQuick} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <QuickView product={quick} onClose={() => setQuick(null)} />
    </>
  )
}
