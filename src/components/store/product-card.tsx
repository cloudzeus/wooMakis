'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ICON_SM, WarningCircle } from './icons'
import {
  INK, INK_FAINT, INK_MUTED, PRIMARY, R_CARD, SURFACE, SURFACE_PRODUCT,
} from './tokens'
import type { StoreProduct } from './types'

/**
 * Product card.
 *
 * The photo sits on PURE WHITE with padding. The packshots are already cut out
 * on white, so a tinted tile behind one just draws a visible rectangle.
 * Separation comes from the card against the canvas, not from a box around the
 * image.
 */
export function ProductCard({
  product,
  onQuickView,
  priority,
}: {
  product: StoreProduct
  onQuickView: (p: StoreProduct) => void
  priority?: boolean
}) {
  const img = product.images[0]
  const out = product.stockStatus !== 'instock'
  const discount =
    product.onSale && product.regularPrice && product.price
      ? Math.round((1 - product.price / product.regularPrice) * 100)
      : null

  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden transition-transform duration-300 ease-out motion-safe:hover:-translate-y-1"
      style={{ background: SURFACE, borderRadius: R_CARD }}
    >
      <Link
        href={`/proionta/${encodeURIComponent(product.slug)}`}
        aria-label={product.name}
        className="relative block aspect-square w-full overflow-hidden"
        style={{ background: SURFACE_PRODUCT }}
      >
        {img ? (
          <Image
            src={img.url}
            alt={img.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            className="object-contain p-6 transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]"
            unoptimized
          />
        ) : (
          <div className="grid h-full place-items-center text-xs" style={{ color: INK_FAINT }}>
            χωρίς εικόνα
          </div>
        )}

        {discount !== null && (
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums"
            style={{ background: INK, color: SURFACE }}
          >
            -{discount}%
          </span>
        )}
        {out && (
          <span
            className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: 'rgb(20 24 26 / 8%)', color: INK_MUTED }}
          >
            <WarningCircle size={ICON_SM} />
            Εξαντλημένο
          </span>
        )}

        {/* Focus-visible as well as hover, so keyboard users can reach it.
            preventDefault stops the surrounding link firing at the same time. */}
        <button
          type="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); onQuickView(product) }}
          className="absolute inset-x-3 bottom-3 h-11 cursor-pointer rounded-full text-[13px] font-semibold opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100 motion-reduce:opacity-100"
          style={{ background: INK, color: SURFACE }}
        >
          Γρήγορη προβολή
        </button>
      </Link>

      <div className="flex flex-1 flex-col p-4 pt-3.5">
        {product.brand && (
          <Link
            href={`/proionta?brand=${encodeURIComponent(product.brand)}`}
            className="text-[10px] font-bold uppercase tracking-[0.14em] hover:underline"
            style={{ color: PRIMARY }}
          >
            {product.brand}
          </Link>
        )}
        <h3 className="mt-1 text-[13.5px] font-semibold leading-snug" style={{ color: INK }}>
          <Link href={`/proionta/${encodeURIComponent(product.slug)}`} className="line-clamp-2 hover:underline">
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-baseline gap-2 pt-3">
          {product.price !== null && (
            <span className="text-[17px] font-bold tabular-nums" style={{ color: INK }}>
              {product.price.toFixed(2)} €
            </span>
          )}
          {product.onSale && product.regularPrice !== null && (
            <span className="text-xs tabular-nums line-through" style={{ color: INK_FAINT }}>
              {product.regularPrice.toFixed(2)} €
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
