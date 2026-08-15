import type { Metadata } from 'next'
import { Comfortaa, Manrope, Noto_Sans_Display, Open_Sans } from 'next/font/google'
import './globals.css'

// Admin (Steel & Frost): Comfortaa for display, Manrope for UI and numerals.
const display = Comfortaa({ subsets: ['latin', 'greek'], variable: '--font-display', display: 'swap' })
const sans = Manrope({ subsets: ['latin', 'greek'], variable: '--font-sans', display: 'swap' })

// Storefront body. Open Sans covers Greek fully across 300-800.
const store = Open_Sans({
  subsets: ['latin', 'latin-ext', 'greek'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-store',
  display: 'swap',
})

// Storefront display face.
//
// Verified with `?subset=greek`, which actually constrains the response:
// Anton, Oswald, Archivo Black, Bebas Neue and Playfair Display serve NO Greek
// subset. Noto Sans Display does, and unlike Open Sans it is drawn for display
// use - tighter apertures, a real 800/900, and a width axis. That is what the
// oversized headlines needed; a UI workhorse at 92px is why the hero read flat.
const displayStore = Noto_Sans_Display({
  subsets: ['latin', 'latin-ext', 'greek'],
  weight: ['700', '800', '900'],
  variable: '--font-store-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'mylens.gr | Φακοί επαφής & οπτικά',
  description: 'Φακοί επαφής, υγρά φροντίδας και γυαλιά ηλίου από επίσημους διανομείς.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="el"
      className={`${display.variable} ${sans.variable} ${store.variable} ${displayStore.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
