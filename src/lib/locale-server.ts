import { cookies } from 'next/headers'
import { LOCALE_COOKIE, asLocale, translator, type Locale, type Translator } from '@/lib/i18n'

/**
 * Server-side locale access for the storefront.
 *
 * Kept out of lib/i18n.ts so that module stays importable from client
 * components: `next/headers` is server-only, and importing it into a shared
 * module breaks every client component that wants a translated string.
 */

export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  return asLocale(store.get(LOCALE_COOKIE)?.value)
}

export async function getT(): Promise<{ locale: Locale; t: Translator }> {
  const locale = await getLocale()
  return { locale, t: translator(locale) }
}
