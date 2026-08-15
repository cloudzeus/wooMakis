import { getLocale } from '@/lib/locale-server'
import { CookieConsent } from '@/components/store/cookie-consent'

/**
 * Storefront shell.
 *
 * Exists so the consent dialog is mounted exactly once for every public page
 * and never on the admin. Putting it in the root layout would show it to staff
 * inside the admin, where it is meaningless; putting it in the footer would
 * miss the cart and the checkout, which render their own chrome.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <>
      {children}
      <CookieConsent locale={locale} />
    </>
  )
}
