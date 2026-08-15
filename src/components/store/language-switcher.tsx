'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, type Locale } from '@/lib/i18n'
import { HAIRLINE, INK, INK_MUTED, SURFACE } from './tokens'

/**
 * Language toggle.
 *
 * Two languages, so this is a pair of buttons rather than a dropdown: a select
 * for two options costs a click to discover what the other one is.
 *
 * The cookie is written client-side and the route is then refreshed, which
 * re-renders the server components with the new locale. A server action would
 * be the tidier way to set the cookie, but it would also mean a round trip
 * before the page can even start re-rendering.
 */
export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function choose(locale: Locale) {
    if (locale === current) return
    // A year: the visitor's language is not something to ask about repeatedly.
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    start(() => router.refresh())
  }

  return (
    <div
      className="flex items-center rounded-full p-0.5"
      style={{ border: `1px solid ${HAIRLINE}`, background: SURFACE }}
      role="group"
      aria-label={current === 'el' ? 'Γλώσσα' : 'Language'}
    >
      {LOCALES.map(l => {
        const active = l === current
        return (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            disabled={pending}
            aria-pressed={active}
            title={LOCALE_NAMES[l]}
            className="h-9 cursor-pointer rounded-full px-2.5 text-[12px] font-bold uppercase transition-colors disabled:opacity-60"
            style={active
              ? { background: INK, color: SURFACE }
              : { color: INK_MUTED, background: 'transparent' }}
          >
            {l}
            <span className="sr-only"> — {LOCALE_NAMES[l]}</span>
          </button>
        )
      })}
    </div>
  )
}
