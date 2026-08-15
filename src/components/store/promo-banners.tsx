'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Reveal } from './reveal'
import { CREAM, HAIRLINE, INK, INK_MUTED, R_CARD, SURFACE_PRODUCT, TEAL, TEAL_DEEP } from './tokens'

export type BannerCat = {
  name: string
  count: number
  imageUrl: string | null
}

/**
 * Category banners: two wide cards over a row of smaller ones, so the band has
 * its own rhythm rather than repeating the uniform grid above it. Imagery is a
 * real product from each category, on white  never a tinted tile.
 */
export function PromoBanners({ cats }: { cats: BannerCat[] }) {
  const [lead, second, ...rest] = cats
  if (!lead) return null

  return (
    <div className="mt-3 space-y-3">
      <Reveal className="grid gap-3 lg:grid-cols-2" stagger={0.09}>
        <BigBanner cat={lead} tone="teal" />
        {second && <BigBanner cat={second} tone="cream" />}
      </Reveal>

      {rest.length > 0 && (
        <Reveal className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06} as="ul">
          {rest.slice(0, 4).map(c => (
            <SmallBanner key={c.name} cat={c} />
          ))}
        </Reveal>
      )}
    </div>
  )
}

function BigBanner({ cat, tone }: { cat: BannerCat; tone: 'teal' | 'cream' }) {
  const teal = tone === 'teal'
  return (
    <Link
      href="/proionta#katigories"
      className="group relative flex items-center justify-between gap-6 overflow-hidden p-8 sm:p-10"
      style={{ background: teal ? TEAL : CREAM, borderRadius: R_CARD }}
    >
      <div className="relative z-10 max-w-[58%]">
        <p
          className="text-[10.5px] font-bold uppercase tracking-[0.16em]"
          style={{ color: teal ? 'rgb(20 24 26 / 60%)' : TEAL_DEEP }}
        >
          Κατηγορία
        </p>
        <h3
          className="mt-3 font-store-display font-black text-[clamp(26px,3.4vw,38px)] uppercase leading-[0.92] tracking-[-0.01em]"
          style={{ color: INK }}
        >
          {cat.name}
        </h3>
        <p className="mt-3 text-[14px]" style={{ color: teal ? 'rgb(20 24 26 / 70%)' : INK_MUTED }}>
          {cat.count} προϊόντα
        </p>
        <span
          className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-bold transition-transform motion-safe:group-hover:translate-x-1"
          style={{ background: INK, color: '#fff' }}
        >
          Δες τα <span aria-hidden>→</span>
        </span>
      </div>

      {cat.imageUrl && (
        <div
          className="relative aspect-square w-[38%] max-w-[220px] shrink-0 overflow-hidden"
          style={{ background: SURFACE_PRODUCT, borderRadius: '18px' }}
        >
          <Image
            src={cat.imageUrl}
            alt=""
            fill
            sizes="220px"
            className="object-contain p-5 transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.06]"
            unoptimized
          />
        </div>
      )}
    </Link>
  )
}

function SmallBanner({ cat }: { cat: BannerCat }) {
  return (
    <li>
      <Link
        href="/proionta#katigories"
        className="group flex items-center gap-4 p-4 transition-colors"
        style={{ background: '#fff', borderRadius: R_CARD, border: `1px solid ${HAIRLINE}` }}
      >
        <div
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl"
          style={{ background: SURFACE_PRODUCT }}
        >
          {cat.imageUrl && (
            <Image
              src={cat.imageUrl}
              alt=""
              fill
              sizes="64px"
              className="object-contain p-2 transition-transform duration-500 motion-safe:group-hover:scale-110"
              unoptimized
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold" style={{ color: INK }}>{cat.name}</p>
          <p className="text-[12px] tabular-nums" style={{ color: INK_MUTED }}>{cat.count} προϊόντα</p>
        </div>
      </Link>
    </li>
  )
}
