import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle, ICON_MD, ICON_SM, Truck } from './icons'
import {
  HAIRLINE_ON_DARK, INK, INK_ON_DARK, INK_ON_DARK_FAINT, PRIMARY, R_CARD,
} from './tokens'

/**
 * The page's single dark band.
 *
 * Section 4.11 locks the page to one theme; this is the documented exception -
 * one deliberate Color Block Story moment, used once, to give the light page a
 * spine and stop every section reading at the same value. It is not random
 * alternation, and no other section inverts.
 *
 * The photograph is what makes it work. A dark band of pure typography would
 * just be a dark rectangle.
 */
export function EditorialBand({
  imageUrl, alt, isPlaceholder,
}: {
  imageUrl: string
  alt: string
  /** True while no asset is assigned to the editorial slot in Πολυμέσα. */
  isPlaceholder?: boolean
}) {
  const points = [
    { icon: CheckCircle, text: 'Γνήσια προϊόντα από επίσημους διανομείς' },
    { icon: Truck, text: 'Αποστολή σε όλη την Ελλάδα σε 1 έως 3 ημέρες' },
  ]

  return (
    <section
      className="relative mt-3 grid overflow-hidden lg:grid-cols-2"
      style={{ background: INK, borderRadius: R_CARD }}
    >
      <div className="relative min-h-[320px] lg:min-h-[520px]">
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          unoptimized={isPlaceholder}
        />
      </div>

      <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
        <h2
          className="font-store-display font-black text-[clamp(38px,5.4vw,68px)] uppercase leading-[0.9] tracking-[-0.01em]"
          style={{ color: INK_ON_DARK }}
        >
          Καθαρή όραση,<br />
          <span style={{ color: PRIMARY }}>κάθε μέρα</span>
        </h2>

        <p className="mt-6 max-w-md text-[15px] leading-[1.7]" style={{ color: INK_ON_DARK_FAINT }}>
          Δουλεύουμε μόνο με επίσημους διανομείς, ώστε ό,τι φοράς στα μάτια σου
          να είναι ακριβώς αυτό που υπόσχεται η συσκευασία.
        </p>

        <div className="mt-10 border-t pt-8" style={{ borderColor: HAIRLINE_ON_DARK }}>
          <Link
            href="/proionta"
            className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-bold transition-transform motion-safe:hover:-translate-y-0.5"
            style={{ background: PRIMARY, color: INK }}
          >
            Δες όλα τα προϊόντα
            <ArrowRight size={ICON_MD} weight="bold" />
          </Link>
        </div>
      </div>
    </section>
  )
}
