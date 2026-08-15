import Image from 'next/image'
import Link from 'next/link'
import { CANVAS, HAIRLINE, INK, INK_MUTED, SURFACE, TEAL } from './tokens'

/** Shared storefront chrome. Same placement on every page — navigation must not move. */
export function StoreHeader({ cartCount }: { cartCount: number }) {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{ background: 'rgb(242 241 237 / 88%)', borderColor: HAIRLINE }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="mylens — αρχική" className="shrink-0">
          {/* Original logo: dark wordmark + brand teal, correct on a light ground. */}
          <Image src="/mylens-logo.svg" alt="mylens" width={64} height={36} priority />
        </Link>

        <nav aria-label="Κύρια πλοήγηση" className="hidden items-center gap-7 text-[13.5px] md:flex">
          <Link href="/proionta" className="transition-colors hover:text-black" style={{ color: INK_MUTED }}>Προϊόντα</Link>
          <Link href="/proionta#katigories" className="transition-colors hover:text-black" style={{ color: INK_MUTED }}>Κατηγορίες</Link>
          <Link href="/proionta#markes" className="transition-colors hover:text-black" style={{ color: INK_MUTED }}>Μάρκες</Link>
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/kalathi"
            className="flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] transition-colors hover:border-black/35"
            style={{ borderColor: HAIRLINE, color: INK, background: SURFACE }}
          >
            Καλάθι
            {cartCount > 0 && (
              <span
                className="rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                style={{ background: TEAL, color: INK }}
              >
                {cartCount}
              </span>
            )}
          </Link>
          <Link
            href="/login"
            className="flex h-10 items-center rounded-full px-4 text-[13px] font-semibold transition-transform motion-safe:hover:-translate-y-0.5"
            style={{ background: INK, color: CANVAS }}
          >
            Σύνδεση
          </Link>
        </div>
      </div>
    </header>
  )
}

export function StoreFooter() {
  return (
    <footer className="overflow-hidden border-t" style={{ borderColor: HAIRLINE }}>
      <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-[13px]" style={{ color: INK_MUTED }}>
          <span>© {new Date().getFullYear()} mylens.gr</span>
          <div className="flex items-center gap-6">
            <a href="https://www.mylens.gr" target="_blank" rel="noopener noreferrer"
               className="transition-colors hover:text-black">mylens.gr ↗</a>
            <Link href="/login" className="transition-colors hover:text-black">Διαχείριση</Link>
          </div>
        </div>
      </div>
      <p
        aria-hidden
        className="-mb-[2.2vw] select-none px-5 text-[19vw] font-extrabold uppercase leading-[0.72] tracking-[-0.055em] sm:px-8"
        style={{ color: 'rgb(20 24 26 / 6%)' }}
      >
        mylens
      </p>
    </footer>
  )
}
