import type { Metadata } from 'next'
import { Comfortaa, Manrope } from 'next/font/google'
import './globals.css'

const display = Comfortaa({ subsets: ['latin', 'greek'], variable: '--font-display', display: 'swap' })
const sans = Manrope({ subsets: ['latin', 'greek'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = { title: 'wooMakis', description: 'Διαχείριση καταλόγου' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
