'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ICON_MD } from './icons'
import { Reveal } from './reveal'
import {
  CREAM, HAIRLINE, INK, INK_MUTED, PRIMARY, R_CARD, SURFACE, SURFACE_PRODUCT,
} from './tokens'

export type BannerCat = {
  name: string
  count: number
  imageUrl: string | null
}

/**
 * Category banners.
 *
 * One lead banner at full width over a row of three, rather than two equal
 * halves side by side. Two same-size cards read as a split rather than a
 * composition, and at the old 12px gap they crowded each other badly.
 *
 * Each links to the catalogue ALREADY FILTERED, not to an anchor that merely
 * scrolls to the facet list.
 */
export function PromoBanners({ cats }: { cats: BannerCat[] }) {
  const [lead, ...rest] = cats
  if (!lead) return null

  return (
    <div className="mt-4 space-y-4">
      <Reveal stagger={0.08}>
        <LeadBanner cat={lead} />
      </Reveal>

      {rest.length > 0 && (
        <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07} as="ul">
          {rest.slice(0, 3).map(c => (
            <TileBanner key={c.name} cat={c} />
          ))}
        </Reveal>
      )}
    </div>
  )
}

function href(name: string): string {
  return `/proionta?category=${encodeURIComponent(name)}`
}

function LeadBanner({ cat }: { cat: BannerCat }) {
  return (
    <Link
      href={href(cat.name)}
      className="group grid items-center gap-10 overflow-hidden p-10 sm:p-14 lg:grid-cols-2"
      style={{ background: PRIMARY, borderRadius: R_CARD }}
    >
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em]" style={{ color: 'rgb(20 24 26 / 58%)' }}>
          Κατηγορία
        </p>
        <h3
          className="mt-4 font-store-display font-black text-[clamp(32px,5vw,56px)] uppercase leading-[0.9] tracking-[-0.01em]"
          style={{ color: INK }}
        >
          {cat.name}
        </h3>
        <p className="mt-4 text-[15px]" style={{ color: 'rgb(20 24 26 / 70%)' }}>
          {cat.count} προϊόντα
        </p>
        <span
          className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[13.5px] font-bold transition-transform motion-safe:group-hover:translate-x-1"
          style={{ background: INK, color: SURFACE }}
        >
          Δες τα
          <ArrowRight size={ICON_MD} weight="bold" />
        </span>
      </div>

      {cat.imageUrl && (
        <div
          className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden lg:ml-auto lg:mr-0"
          style={{ background: SURFACE_PRODUCT, borderRadius: '20px' }}
        >
          <Image
            src={cat.imageUrl}
            alt=""
            fill
            sizes="320px"
            className="object-contain p-7 transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.06]"
            unoptimized
          />
        </div>
      )}
    </Link>
  )
}

function TileBanner({ cat }: { cat: BannerCat }) {
  return (
    <li>
      <Link
        href={href(cat.name)}
        className="group flex h-full flex-col justify-between gap-7 p-7 transition-colors"
        style={{ background: SURFACE, borderRadius: R_CARD, border: `1px solid ${HAIRLINE}` }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: PRIMARY }}>
            Κατηγορία
          </p>
          <h3
            className="mt-2.5 font-store-display font-black text-[clamp(20px,2.4vw,26px)] uppercase leading-[0.95] tracking-[-0.005em]"
            style={{ color: INK }}
          >
            {cat.name}
          </h3>
          <p className="mt-2 text-[13px]" style={{ color: INK_MUTED }}>{cat.count} προϊόντα</p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <span
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform motion-safe:group-hover:translate-x-1"
            style={{ color: INK }}
          >
            Δες τα
            <ArrowRight size={16} weight="bold" />
          </span>

          {cat.imageUrl && (
            <div
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl"
              style={{ background: CREAM }}
            >
              <Image
                src={cat.imageUrl}
                alt=""
                fill
                sizes="96px"
                className="object-contain p-2.5 transition-transform duration-500 motion-safe:group-hover:scale-110"
                unoptimized
              />
            </div>
          )}
        </div>
      </Link>
    </li>
  )
}
