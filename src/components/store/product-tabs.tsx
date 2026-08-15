'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import type { Locale } from '@/lib/i18n'
import {
  CANVAS, GUTTER, HAIRLINE, HAIRLINE_SOFT, INK, INK_FAINT, INK_MUTED,
  MAX_W, PRIMARY, R_CARD, R_PILL, SALE, SURFACE, SURFACE_PRODUCT, TRACK,
} from './tokens'

export type TabProduct = {
  id: string
  slug: string | null
  name: string
  brand: string | null
  price: string | null
  regularPrice: string | null
  image: string | null
  /** 'lens' | 'care' | 'other', derived server-side from the real categories. */
  group: string
  inStock: boolean
}

/**
 * "Δημοφιλή προϊόντα" with the design's three tabs.
 *
 * Client-side only because the filter is instant and the whole set is already
 * on the page — eight products is not worth a round trip. The tab state does
 * not go in the URL: this is a home-page teaser, and the catalogue at
 * /proionta is the filterable, linkable view.
 *
 * The design's stock bar and "46 sold this week" are not reproduced. Neither
 * number exists in the data, and inventing scarcity is both dishonest and,
 * under the EU Omnibus Directive, an unfair commercial practice. The real
 * stock status is shown instead.
 */
export function ProductTabs({
  locale, products, title,
}: {
  locale: Locale
  products: TabProduct[]
  title: string
}) {
  const el = locale === 'el'
  const [tab, setTab] = useState<'all' | 'lens' | 'care'>('all')

  const tabs = [
    { key: 'all' as const, label: el ? 'Όλα' : 'All' },
    { key: 'lens' as const, label: el ? 'Φακοί' : 'Lenses' },
    { key: 'care' as const, label: el ? 'Υγρά & Φροντίδα' : 'Solutions & Care' },
  ]

  const shown = tab === 'all' ? products : products.filter(p => p.group === tab)

  return (
    <section
      id="products"
      className="border-y py-16"
      style={{ background: CANVAS, borderColor: HAIRLINE }}
    >
      <div
        className="mx-auto flex flex-col gap-7"
        style={{ maxWidth: MAX_W, paddingInline: GUTTER }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="ga m-0 text-[34px] font-extrabold" style={{ color: INK }}>
            {title}
          </h2>
          <div className="flex gap-2" role="group" aria-label={el ? 'Φίλτρο' : 'Filter'}>
            {tabs.map(x => {
              const on = tab === x.key
              return (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setTab(x.key)}
                  aria-pressed={on}
                  className="cursor-pointer px-5 py-2.5 text-[13.5px] font-bold transition-all duration-300"
                  style={{
                    borderRadius: R_PILL,
                    border: on ? 'none' : `1px solid ${HAIRLINE_SOFT}`,
                    background: on ? INK : SURFACE,
                    color: on ? SURFACE : INK_MUTED,
                  }}
                >
                  {x.label}
                </button>
              )
            })}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="py-12 text-center text-[14px]" style={{ color: INK_MUTED }}>
            {el ? 'Δεν υπάρχουν προϊόντα σε αυτή την κατηγορία.' : 'No products in this group.'}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[18px]">
            {shown.map(p => <Card key={p.id} p={p} locale={locale} />)}
          </div>
        )}
      </div>
    </section>
  )
}

function Card({ p, locale }: { p: TabProduct; locale: Locale }) {
  const el = locale === 'el'
  const price = p.price ? Number(p.price) : null
  const regular = p.regularPrice ? Number(p.regularPrice) : null
  const onSale = price != null && regular != null && regular > price

  const money = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

  return (
    <div
      className="ga relative flex flex-col overflow-hidden border transition-[transform,box-shadow] duration-[350ms] hover:-translate-y-1.5 hover:shadow-[0_22px_44px_-22px_rgb(16_27_20/30%)]"
      style={{ background: SURFACE, borderColor: HAIRLINE, borderRadius: R_CARD }}
    >
      <Link
        href={p.slug ? `/proionta/${p.slug}` : '/proionta'}
        className="flex h-[180px] items-center justify-center px-5 pb-1 pt-4"
        // Pure white behind every packshot — the images are cut out on white,
        // so any tint draws a visible rectangle around the bottle.
        style={{ background: SURFACE_PRODUCT }}
      >
        {p.image
          ? <Image src={p.image} alt={p.name} width={220} height={160}
                   className="max-h-full max-w-[74%] object-contain mix-blend-multiply" unoptimized />
          : <span className="text-[13px]" style={{ color: INK_FAINT }}>
              {el ? 'χωρίς εικόνα' : 'no image'}
            </span>}
      </Link>

      <div className="flex flex-col gap-1.5 px-[18px] pb-[18px] pt-1.5">
        {p.brand && (
          <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: PRIMARY }}>
            {p.brand}
          </span>
        )}

        <Link
          href={p.slug ? `/proionta/${p.slug}` : '/proionta'}
          className="min-h-[44px] text-[17px] font-bold leading-[1.25]"
          style={{ color: INK }}
        >
          {p.name}
        </Link>

        {/* Real availability, not an invented "only 3 left" bar. */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11.5px]">
            <span style={{ color: p.inStock ? PRIMARY : SALE, fontWeight: 700 }}>
              {p.inStock
                ? (el ? 'Διαθέσιμο' : 'In stock')
                : (el ? 'Εξαντλημένο' : 'Out of stock')}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full" style={{ background: TRACK }}>
            <div
              className="h-full rounded-full"
              style={{ width: p.inStock ? '100%' : '12%', background: p.inStock ? PRIMARY : SALE }}
            />
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-2.5 border-t pt-2.5"
          style={{ borderColor: TRACK }}
        >
          <span className="whitespace-nowrap">
            {onSale && (
              <s className="mr-2 text-[13px]" style={{ color: INK_FAINT }}>{money(regular!)}</s>
            )}
            <b className="text-[18px]" style={{ color: onSale ? SALE : INK }}>
              {price != null ? money(price) : '—'}
            </b>
          </span>
          <Link
            href={p.slug ? `/proionta/${p.slug}` : '/proionta'}
            className="whitespace-nowrap px-4 py-[9px] text-[12.5px] font-bold transition-colors hover:bg-[var(--hv)]"
            style={{ background: INK, color: SURFACE, borderRadius: R_PILL, ['--hv' as string]: PRIMARY }}
          >
            {el ? 'Δες το' : 'View'}
          </Link>
        </div>
      </div>
    </div>
  )
}
