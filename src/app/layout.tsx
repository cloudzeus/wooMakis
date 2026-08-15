import type { Metadata } from 'next'
import { Comfortaa, Inter, Manrope } from 'next/font/google'
import './globals.css'

// Admin (Steel & Frost): Comfortaa for display, Manrope for UI and numerals.
const display = Comfortaa({ subsets: ['latin', 'greek'], variable: '--font-display', display: 'swap' })
const sans = Manrope({ subsets: ['latin', 'greek'], variable: '--font-sans', display: 'swap' })

// Storefront. The v3 design specifies Inter throughout, at 400-900. It carries
// a full Greek subset, which is the constraint that ruled out Anton, Oswald and
// Playfair on this project.
const store = Inter({
  subsets: ['latin', 'latin-ext', 'greek'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-store',
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
      className={`${display.variable} ${sans.variable} ${store.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
