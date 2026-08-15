'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { translator, type Locale } from '@/lib/i18n'
import {
  HAIRLINE, INK, INK_MUTED, PRIMARY, SURFACE,
} from './tokens'

/**
 * Cookie consent.
 *
 * Three rules drive the design, and all three are things consent banners are
 * routinely built to avoid:
 *
 *  1. Refusing is exactly as easy as accepting. "Μόνο τα απαραίτητα" is a
 *     button of equal weight sitting next to "Αποδοχή όλων", not a link buried
 *     behind a settings panel.
 *  2. Nothing non-essential runs before a choice is made. The stored value
 *     starts as all-false and the page reads it before loading anything.
 *  3. The choice is revisitable. A footer link reopens this, because consent
 *     that cannot be withdrawn is not consent.
 *
 * The banner blocks the page with a backdrop but does not trap the reader out
 * of the legal text — the cookie policy link inside works while it is open.
 */

export const CONSENT_COOKIE = 'WOOMAKIS_CONSENT'
const CONSENT_VERSION = 1

export type Consent = {
  version: number
  necessary: true
  analytics: boolean
  marketing: boolean
  at: string
}

function read(): Consent | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie
    .split('; ')
    .find(c => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.split('=')
    .slice(1)
    .join('=')
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Consent
    // A bumped version means the categories changed, so the old answer no
    // longer covers what is being asked.
    return parsed.version === CONSENT_VERSION ? parsed : null
  } catch {
    return null
  }
}

function write(consent: Omit<Consent, 'version' | 'at' | 'necessary'>) {
  const value: Consent = {
    version: CONSENT_VERSION,
    necessary: true,
    ...consent,
    at: new Date().toISOString(),
  }
  const maxAge = 60 * 60 * 24 * 180 // six months, then ask again
  document.cookie =
    `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=${maxAge}; samesite=lax`
  window.dispatchEvent(new CustomEvent('woomakis:consent', { detail: value }))
}

/** Lets the footer link reopen the dialog. */
export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent('woomakis:consent-open'))
}

export function CookieConsent({ locale }: { locale: Locale }) {
  const t = translator(locale)
  const [open, setOpen] = useState(false)
  const [detailed, setDetailed] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const existing = read()
    if (!existing) setOpen(true)
    else { setAnalytics(existing.analytics); setMarketing(existing.marketing) }

    function reopen() {
      const c = read()
      setAnalytics(c?.analytics ?? false)
      setMarketing(c?.marketing ?? false)
      setDetailed(true)
      setOpen(true)
    }
    window.addEventListener('woomakis:consent-open', reopen)
    return () => window.removeEventListener('woomakis:consent-open', reopen)
  }, [])

  useEffect(() => {
    if (open) dialogRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [open])

  if (!open) return null

  function decide(a: boolean, m: boolean) {
    write({ analytics: a, marketing: m })
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-6"
      style={{ background: 'rgb(17 17 17 / 45%)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-title"
        className="w-full max-w-lg rounded-3xl p-6 shadow-2xl"
        style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
      >
        <h2 id="cookie-title" className="text-[19px] font-bold" style={{ color: INK }}>
          {t('cookies.title')}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: INK_MUTED }}>
          {t('cookies.body')}
        </p>

        {detailed && (
          <div className="mt-4 space-y-2">
            <Category
              label={t('cookies.necessary')}
              help={t('cookies.necessaryHelp')}
              checked
              locked
            />
            <Category
              label={t('cookies.analytics')}
              help={t('cookies.analyticsHelp')}
              checked={analytics}
              onChange={setAnalytics}
            />
            <Category
              label={t('cookies.marketing')}
              help={t('cookies.marketingHelp')}
              checked={marketing}
              onChange={setMarketing}
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {detailed ? (
            <button
              type="button"
              onClick={() => decide(analytics, marketing)}
              className="h-11 flex-1 cursor-pointer rounded-full px-5 text-[13.5px] font-bold"
              style={{ background: INK, color: SURFACE }}
            >
              {t('cookies.save')}
            </button>
          ) : (
            <>
              {/* Equal weight, deliberately. Accept and reject are the same
                  size, the same shape and next to each other. */}
              <button
                type="button"
                onClick={() => decide(false, false)}
                className="h-11 flex-1 cursor-pointer rounded-full border px-5 text-[13.5px] font-bold"
                style={{ borderColor: INK, color: INK, background: SURFACE }}
              >
                {t('cookies.rejectAll')}
              </button>
              <button
                type="button"
                onClick={() => decide(true, true)}
                className="h-11 flex-1 cursor-pointer rounded-full px-5 text-[13.5px] font-bold"
                style={{ background: INK, color: SURFACE }}
              >
                {t('cookies.acceptAll')}
              </button>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
          {!detailed && (
            <button
              type="button"
              onClick={() => setDetailed(true)}
              className="cursor-pointer underline hover:no-underline"
              style={{ color: INK_MUTED }}
            >
              {t('cookies.customise')}
            </button>
          )}
          <Link
            href="/cookies"
            className="underline hover:no-underline"
            style={{ color: PRIMARY }}
          >
            {t('cookies.more')}
          </Link>
        </div>
      </div>
    </div>
  )
}

function Category({
  label, help, checked, locked, onChange,
}: {
  label: string
  help: string
  checked: boolean
  locked?: boolean
  onChange?: (v: boolean) => void
}) {
  return (
    <label
      className={`flex gap-3 rounded-2xl p-3 ${locked ? '' : 'cursor-pointer'}`}
      style={{ border: `1px solid ${HAIRLINE}` }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={e => onChange?.(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[#111]"
      />
      <span>
        <span className="block text-[13.5px] font-semibold" style={{ color: INK }}>
          {label}
        </span>
        <span className="block text-[12px]" style={{ color: INK_MUTED }}>{help}</span>
      </span>
    </label>
  )
}
