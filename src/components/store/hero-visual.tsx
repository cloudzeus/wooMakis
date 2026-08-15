import Image from 'next/image'
import {
  CREAM, INK, PRIMARY, R_CARD,
} from './tokens'

/**
 * Wide photographic band under the hero.
 *
 * A macro eye shot at 21:9 is the one place on this page where an image can
 * carry a whole band on its own, so the overlay stays to a single line and sits
 * on a gradient rather than a slab - the photograph is the content.
 *
 * Renders nothing when no asset is assigned, which is the honest fallback: an
 * empty grey rectangle would be worse than the band simply not existing.
 */
export function HeroVisual({
  imageUrl, alt,
}: {
  imageUrl: string | null
  alt: string
}) {
  if (!imageUrl) return null

  return (
    <section
      className="relative mt-3 overflow-hidden"
      style={{ borderRadius: R_CARD, background: CREAM }}
    >
      <div className="relative aspect-[21/9] w-full sm:aspect-[24/7]">
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes="(max-width: 1440px) 100vw, 1440px"
          className="object-cover"
          priority
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, rgb(20 24 26 / 72%) 0%, rgb(20 24 26 / 20%) 48%, transparent 70%)' }}
        />
      </div>

      <div className="absolute inset-y-0 left-0 flex max-w-[62%] flex-col justify-center px-8 sm:px-12">
        <p
          className="font-store-display font-black text-[clamp(20px,3.2vw,44px)] uppercase leading-[0.95] tracking-[-0.01em] text-white"
        >
          Ό,τι φοράς<br />
          <span style={{ color: PRIMARY }}>στα μάτια σου</span><br />
          αξίζει προσοχή
        </p>
      </div>
    </section>
  )
}

/**
 * Trust band. Photograph beside the reasons to buy here rather than elsewhere,
 * so the claims have something concrete next to them.
 */
export function TrustBand({
  imageUrl, alt,
}: {
  imageUrl: string | null
  alt: string
}) {
  const points = [
    'Γνήσια προϊόντα από επίσημους διανομείς',
    'Αποστολή σε όλη την Ελλάδα σε 1 έως 3 ημέρες',
    'Υποστήριξη από οπτικούς πριν και μετά την αγορά',
  ]

  return (
    <section className="mt-3 grid gap-3 lg:grid-cols-12">
      {imageUrl && (
        <div
          className="relative min-h-[260px] overflow-hidden lg:col-span-5"
          style={{ borderRadius: R_CARD }}
        >
          <Image src={imageUrl} alt={alt} fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" />
        </div>
      )}

      <div
        className={`flex flex-col justify-center p-8 sm:p-12 ${imageUrl ? 'lg:col-span-7' : 'lg:col-span-12'}`}
        style={{ background: PRIMARY, borderRadius: R_CARD }}
      >
        <h2
          className="font-store-display font-black text-[clamp(26px,3.6vw,40px)] uppercase leading-[0.94] tracking-[-0.01em]"
          style={{ color: INK }}
        >
          Γιατί mylens
        </h2>
        <ul className="mt-7 space-y-4">
          {points.map(t => (
            <li key={t} className="flex gap-3 text-[15px]" style={{ color: 'rgb(20 24 26 / 82%)' }}>
              <span aria-hidden className="mt-2 h-px w-3 shrink-0" style={{ background: INK }} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
