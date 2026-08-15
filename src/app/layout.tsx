import type { Metadata } from 'next'
import { Comfortaa, Manrope, Open_Sans } from 'next/font/google'
import './globals.css'

// Admin (Steel & Frost): Comfortaa for display, Manrope for UI and numerals.
const display = Comfortaa({ subsets: ['latin', 'greek'], variable: '--font-display', display: 'swap' })
const sans = Manrope({ subsets: ['latin', 'greek'], variable: '--font-sans', display: 'swap' })

// Storefront: Open Sans across the full weight range. It is a variable font, so
// 300–800 all come from one file — including the 800 the oversized display type
// relies on — and its Greek coverage is complete, which most condensed display
// faces lack.
const store = Open_Sans({
  subsets: ['latin', 'latin-ext', 'greek'],
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-store',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'mylens.gr — Φακοί επαφής & οπτικά',
  description: 'Φακοί επαφής, υγρά φροντίδας και γυαλιά ηλίου από επίσημους διανομείς.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el" className={`${display.variable} ${sans.variable} ${store.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
