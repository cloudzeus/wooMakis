'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { translator, type Locale } from '@/lib/i18n'
import {
  HAIRLINE, INK, INK_MUTED, PRIMARY, SURFACE,
} from '@/components/store/tokens'
import { lookupOrder, registerCustomer, signInCustomer } from './actions'

type Mode = 'signIn' | 'register'

export function AuthForms({ locale }: { locale: Locale }) {
  const t = translator(locale)
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signIn')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      // Success redirects from the server action, so anything returned here is
      // a failure.
      const r = mode === 'signIn'
        ? await signInCustomer({ email: form.email, password: form.password })
        : await registerCustomer(form)
      if (r && !r.ok) setError(r.error)
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        className="rounded-3xl p-6 sm:p-8"
        style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
      >
        <div className="mb-5 flex gap-1 rounded-full p-1" style={{ background: 'rgb(20 24 26 / 5%)' }}>
          {(['signIn', 'register'] as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null) }}
              aria-pressed={mode === m}
              className="h-10 flex-1 cursor-pointer rounded-full text-[13.5px] font-bold transition-colors"
              style={mode === m
                ? { background: INK, color: SURFACE }
                : { color: INK_MUTED, background: 'transparent' }}
            >
              {m === 'signIn' ? t('auth.signIn') : t('auth.register')}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <Field
              label={t('auth.name')}
              value={form.name}
              autoComplete="name"
              onChange={v => setForm({ ...form, name: v })}
            />
          )}
          <Field
            label={t('auth.email')}
            type="email"
            value={form.email}
            autoComplete="email"
            onChange={v => setForm({ ...form, email: v })}
          />
          <Field
            label={t('auth.password')}
            type="password"
            value={form.password}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            help={mode === 'register'
              ? (locale === 'el'
                  ? 'Τουλάχιστον 8 χαρακτήρες, γράμματα και αριθμοί.'
                  : 'At least 8 characters, letters and numbers.')
              : undefined}
            onChange={v => setForm({ ...form, password: v })}
          />

          {error && (
            <p role="alert" className="rounded-xl px-3 py-2 text-[13px]"
               style={{ background: 'rgb(185 28 28 / 8%)', color: '#B91C1C' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="h-12 w-full cursor-pointer rounded-full text-[14px] font-bold disabled:opacity-50"
            style={{ background: INK, color: SURFACE }}
          >
            {pending ? t('common.loading') : mode === 'signIn' ? t('auth.signIn') : t('auth.register')}
          </button>
        </form>

        <p className="mt-4 text-[13px]" style={{ color: INK_MUTED }}>
          {locale === 'el'
            ? 'Ο λογαριασμός είναι για αυτό το κατάστημα. Αν έχεις ξαναγοράσει με το ίδιο email, '
              + 'οι παραγγελίες σου εμφανίζονται αυτόματα.'
            : 'The account is for this store. If you have ordered before with the same email, '
              + 'your orders appear automatically.'}
        </p>
      </section>

      <OrderLookup locale={locale} onFound={id => router.push(`/parangelia/${id}`)} />
    </div>
  )
}

/**
 * Guest lookup.
 *
 * Most people who have bought here never had an account: 436 of the 466
 * customers exist only as the billing block on a guest order. Without this
 * they would have no way to see anything at all.
 */
function OrderLookup({ locale, onFound }: { locale: Locale; onFound: (id: string) => void }) {
  const t = translator(locale)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', number: '' })

  return (
    <section
      className="h-fit rounded-3xl p-6 sm:p-8"
      style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
    >
      <h2 className="text-[17px] font-bold">{t('auth.lookupTitle')}</h2>
      <p className="mb-4 mt-1 text-[13.5px]" style={{ color: INK_MUTED }}>
        {t('auth.lookupHelp')}
      </p>

      <form
        onSubmit={e => {
          e.preventDefault()
          setError(null)
          start(async () => {
            const r = await lookupOrder(form)
            if (r.ok) onFound(r.orderId)
            else setError(r.error)
          })
        }}
        className="space-y-3"
      >
        <Field
          label={t('auth.email')}
          type="email"
          value={form.email}
          autoComplete="email"
          onChange={v => setForm({ ...form, email: v })}
        />
        <Field
          label={t('auth.orderNumber')}
          value={form.number}
          onChange={v => setForm({ ...form, number: v })}
        />

        {error && (
          <p role="alert" className="rounded-xl px-3 py-2 text-[13px]"
             style={{ background: 'rgb(185 28 28 / 8%)', color: '#B91C1C' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full cursor-pointer rounded-full border text-[14px] font-bold disabled:opacity-50"
          style={{ borderColor: INK, color: INK, background: SURFACE }}
        >
          {pending ? t('common.loading') : t('auth.lookup')}
        </button>
      </form>

      <p className="mt-4 text-[12.5px]" style={{ color: PRIMARY }}>
        {locale === 'el'
          ? 'Ο αριθμός παραγγελίας είναι στο email επιβεβαίωσης που έλαβες.'
          : 'The order number is in the confirmation email you received.'}
      </p>
    </section>
  )
}

function Field({
  label, value, onChange, type = 'text', help, autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  help?: string
  autoComplete?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: INK_MUTED }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        className="h-12 w-full rounded-full border px-5 text-[14px] outline-none focus:ring-2"
        style={{ borderColor: HAIRLINE, background: SURFACE, color: INK }}
      />
      {help && <span className="block px-2 text-[11.5px]" style={{ color: INK_MUTED }}>{help}</span>}
    </label>
  )
}
