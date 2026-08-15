'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { addToCart } from '@/app/(store)/kalathi/actions'
import { ICON_MD, ICON_SM, CheckCircle, Minus, Plus, WarningCircle, X, ArrowUpRight } from './icons'
import {
  CREAM, INK, INK_FAINT, INK_MUTED, PRIMARY, R_CARD, R_INNER, SURFACE, SURFACE_PRODUCT,
} from './tokens'
import type { StoreProduct } from './types'

/** Strips WooCommerce markup so descriptions read as plain text in the panel. */
function plain(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

export function QuickView({ product, onClose }: { product: StoreProduct | null; onClose: () => void }) {
  const [active, setActive] = useState(0)
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const closeRef = useRef<HTMLButtonElement>(null)

  // Reset per product, move focus in, restore scroll on close.
  useEffect(() => {
    if (!product) return
    setActive(0); setQty(1); setMsg(null)
    closeRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [product, onClose])

  if (!product) return null

  const img = product.images[active] ?? product.images[0]
  const out = product.stockStatus !== 'instock'
  const body = plain(product.shortDescription) || plain(product.description)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Λεπτομέρειες: ${product.name}`}
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
    >
      {/* Scrim strong enough to isolate the panel */}
      <button
        aria-label="Κλείσιμο"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgb(11 15 16 / 62%)', backdropFilter: 'blur(3px)' }}
      />

      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl motion-safe:animate-[qv_220ms_cubic-bezier(.2,.7,.3,1)]"
        style={{ borderRadius: `${R_CARD} ${R_CARD} 0 0`, }}
      >
        <style>{`
          @keyframes qv { from { opacity: 0; transform: translateY(18px) scale(.985) } to { opacity: 1; transform: none } }
          @media (min-width: 640px) { .qv-round { border-radius: ${R_CARD} } }
        `}</style>

        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Κλείσιμο"
          className="absolute right-4 top-4 z-10 grid h-11 w-11 cursor-pointer place-items-center rounded-full transition-colors hover:bg-black/5"
          style={{ color: INK, background: 'rgb(255 255 255 / 90%)' }}
        >
          <X size={ICON_MD} />
        </button>

        <div className="grid flex-1 overflow-y-auto sm:grid-cols-2">
          {/* Gallery  white ground, contain, never cropped */}
          <div className="p-5 sm:p-7">
            <div
              className="relative aspect-square w-full overflow-hidden"
              style={{ background: SURFACE_PRODUCT, borderRadius: R_INNER }}
            >
              {img && (
                <Image
                  src={img.url}
                  alt={img.alt ?? product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 45vw"
                  className="object-contain p-6"
                  unoptimized
                />
              )}
            </div>

            {product.images.length > 1 && (
              <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {product.images.map((im, i) => (
                  <li key={im.url}>
                    <button
                      onClick={() => setActive(i)}
                      aria-label={`Εικόνα ${i + 1}`}
                      aria-current={i === active}
                      className="relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-colors"
                      style={{
                        background: SURFACE_PRODUCT,
                        borderColor: i === active ? PRIMARY : 'rgb(11 15 16 / 10%)',
                      }}
                    >
                      <Image src={im.url} alt="" fill sizes="64px" className="object-contain p-1.5" unoptimized />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detail */}
          <div className="flex flex-col p-5 sm:p-7 sm:pl-0">
            {product.brand && (
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: PRIMARY }}>
                {product.brand}
              </p>
            )}
            <h2 className="mt-1.5 text-[22px] font-bold leading-tight" style={{ color: INK }}>
              {product.name}
            </h2>
            {product.nameEn && product.nameEn !== product.name && (
              <p className="mt-1 text-[13px]" style={{ color: INK_MUTED }}>{product.nameEn}</p>
            )}

            <div className="mt-4 flex items-baseline gap-3">
              {product.price !== null && (
                <span className="text-[26px] font-bold tabular-nums" style={{ color: INK }}>
                  {product.price.toFixed(2)} €
                </span>
              )}
              {product.onSale && product.regularPrice !== null && (
                <span className="text-sm tabular-nums line-through" style={{ color: '#A9B0B2' }}>
                  {product.regularPrice.toFixed(2)} €
                </span>
              )}
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-[13px]" style={{ color: out ? '#B45309' : '#15803D' }}>
              {out ? <WarningCircle size={ICON_SM} /> : <CheckCircle size={ICON_SM} />}
              {out ? 'Εξαντλημένο' : 'Διαθέσιμο'}
            </p>

            {body && (
              <p className="mt-4 line-clamp-6 text-[13.5px] leading-relaxed" style={{ color: INK_MUTED }}>
                {body}
              </p>
            )}

            {product.attributes.length > 0 && (
              <dl className="mt-4 space-y-2">
                {product.attributes.slice(0, 4).map(a => (
                  <div key={a.name}>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: INK_MUTED }}>
                      {a.name}
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {a.options.slice(0, 8).map(o => (
                        <span
                          key={o}
                          className="rounded-full px-2.5 py-1 text-[11.5px]"
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

            {msg && (
              <p
                role="status"
                className="mt-4 rounded-xl px-3 py-2 text-[13px]"
                style={
                  msg.ok
                    ? { background: 'rgb(21 128 61 / 10%)', color: '#15803D' }
                    : { background: 'rgb(185 28 28 / 8%)', color: '#B91C1C' }
                }
              >
                {msg.text}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-full border" style={{ borderColor: 'rgb(11 15 16 / 14%)' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Μείωση ποσότητας"
                        className="grid h-11 w-11 cursor-pointer place-items-center rounded-full hover:bg-black/5">
                  <Minus size={ICON_SM} />
                </button>
                <span className="w-8 text-center text-sm tabular-nums">{qty}</span>
                <button onClick={() => setQty(q => Math.min(99, q + 1))} aria-label="Αύξηση ποσότητας"
                        className="grid h-11 w-11 cursor-pointer place-items-center rounded-full hover:bg-black/5">
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
                className="h-11 flex-1 cursor-pointer rounded-full text-sm font-semibold transition-transform disabled:opacity-40 motion-safe:hover:-translate-y-0.5"
                style={{ background: INK, color: '#fff' }}
              >
                {pending ? 'Προσθήκη…' : out ? 'Εξαντλημένο' : 'Προσθήκη στο καλάθι'}
              </button>
            </div>

            <Link
              href={`/proionta/${encodeURIComponent(product.slug)}`}
              onClick={onClose}
              className="mt-4 block rounded-full border py-3 text-center text-[13px] font-semibold"
              style={{ borderColor: 'rgb(20 24 26 / 14%)', color: INK }}
            >
              Πλήρη στοιχεία προϊόντος
            </Link>

            {product.permalink && (
              <a
                href={product.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1 text-[12.5px] underline underline-offset-2"
                style={{ color: INK_MUTED }}
              >
                Πλήρη στοιχεία στο mylens.gr
                <ArrowUpRight size={ICON_SM} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
