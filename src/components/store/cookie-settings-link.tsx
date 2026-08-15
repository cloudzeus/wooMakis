'use client'

import { translator, type Locale } from '@/lib/i18n'
import { openCookieSettings } from './cookie-consent'
import {
  INK_MUTED,
} from './tokens'

/**
 * Reopens the consent dialog.
 *
 * Consent that cannot be withdrawn is not consent, so this link exists on
 * every page of the storefront via the footer.
 */
export function CookieSettingsLink({ locale }: { locale: Locale }) {
  const t = translator(locale)
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="cursor-pointer text-[13px] underline transition-colors hover:text-black hover:no-underline"
      style={{ color: INK_MUTED }}
    >
      {t('cookies.customise')}
    </button>
  )
}
