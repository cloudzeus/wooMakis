'use client'

import { useState, useTransition } from 'react'
import { VerdictTable, WooPushPanel, type Gate, type Report } from '@/components/admin/woo-push'

export type TermTranslation = {
  locale: string
  wooId: number
  name: string
  slug: string
  description: string
}

export type TermActions = {
  save: (translations: { locale: string; name: string; description: string }[]) =>
    Promise<{ ok: boolean; message?: string; error?: string }>
  translate: (toLocale: string) => Promise<{ ok: boolean; message?: string; error?: string }>
  preview: () => Promise<{ plans: { locale: string; plan: { url: string; body: Record<string, unknown> } }[]; warnings: string[] }>
  push: () => Promise<{ ok: boolean; message?: string; error?: string; reports?: Report[] }>
  verify: () => Promise<{ ok: boolean; message?: string; error?: string; reports?: Report[] }>
}

const PUSH_OPTIONS = [{
  key: 'content' as const,
  label: 'Όνομα και περιγραφή',
  hint: 'Σε κάθε γλώσσα ξεχωριστά. Το slug δεν στέλνεται ποτέ.',
}]

/**
 * Category and brand editing. One component for both — they are the same
 * record shape upstream, and the only thing that differs is the wording.
 */
export function TermEditor({
  kind, subtitle, translations, actions, gate, canEdit, canPush, deepseekReady,
}: {
  kind: 'category' | 'brand'
  subtitle: string
  translations: TermTranslation[]
  actions: TermActions
  gate: Gate
  canEdit: boolean
  canPush: boolean
  deepseekReady: boolean
}) {
  const [pending, start] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [preview, setPreview] = useState<Awaited<ReturnType<TermActions['preview']>> | null>(null)
  const [form, setForm] = useState(
    translations.map(t => ({ locale: t.locale, name: t.name, description: t.description })),
  )

  function report(r: { ok: boolean; message?: string; error?: string }) {
    setToast(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error! })
  }

  const noun = kind === 'category' ? 'κατηγορίας' : 'μάρκας'

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">
            {translations.find(t => t.locale === 'el')?.name ?? translations[0]?.name ?? '—'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => start(async () => report(await actions.save(form)))}
            disabled={pending}
            className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? 'Αποθήκευση…' : 'Αποθήκευση αλλαγών'}
          </button>
        )}
      </header>

      {toast && (
        <p
          role="status"
          className={`rounded-2xl px-4 py-2 text-sm ${
            toast.ok ? 'bg-[var(--success)]/12 text-[var(--success)]' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {toast.ok ? '✓ ' : '⚠ '}{toast.text}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">Περιεχόμενο {noun}</h2>
          {canEdit && (
            <div className="flex items-center gap-1.5">
              {translations.map(t => (
                <button
                  key={t.locale}
                  onClick={() => start(async () => report(await actions.translate(t.locale)))}
                  disabled={pending || !deepseekReady || translations.length < 2}
                  title={
                    translations.length < 2
                      ? 'Χρειάζεται δεύτερη γλώσσα ως πηγή'
                      : deepseekReady ? `Μετάφραση στα ${t.locale} με DeepSeek` : 'Λείπει το DEEPSEEK_API_KEY'
                  }
                  className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
                >
                  ↻ {t.locale.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {!deepseekReady && (
          <p className="mb-3 rounded-xl bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
            ⚠ Η αυτόματη μετάφραση απαιτεί <code>DEEPSEEK_API_KEY</code> στο .env.
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {form.map((t, i) => {
            const meta = translations.find(x => x.locale === t.locale)!
            return (
              <div key={t.locale} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--navy)]/10 px-2 py-0.5 text-[11px] uppercase text-[var(--navy)]">
                    {t.locale}
                  </span>
                  <span className="text-xs text-muted-foreground">Woo #{meta.wooId}</span>
                  <code className="text-xs text-muted-foreground">/{meta.slug}</code>
                </div>

                <label className="block space-y-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Όνομα</span>
                  <input
                    value={t.name}
                    disabled={!canEdit}
                    onChange={e => {
                      const next = [...form]; next[i] = { ...t, name: e.target.value }; setForm(next)
                    }}
                    className="h-9 w-full rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Περιγραφή</span>
                  <textarea
                    value={t.description}
                    disabled={!canEdit}
                    rows={5}
                    onChange={e => {
                      const next = [...form]; next[i] = { ...t, description: e.target.value }; setForm(next)
                    }}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                  />
                </label>
              </div>
            )
          })}
        </div>

        {translations.length < 2 && (
          <p className="mt-3 rounded-xl bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
            ⚠ Υπάρχει μόνο μία γλώσσα. Η δεύτερη πρέπει να δημιουργηθεί ως όρος στο WordPress
            (Polylang) και να συνδεθεί στην ίδια ομάδα μετάφρασης πριν εμφανιστεί εδώ.
          </p>
        )}
      </section>

      <WooPushPanel
        title="Συγχρονισμός με το WooCommerce"
        description="Μετά την αποστολή ο όρος διαβάζεται ξανά από το κατάστημα και συγκρίνεται πεδίο προς πεδίο."
        gate={gate}
        options={PUSH_OPTIONS}
        warnings={preview?.warnings}
        canPush={canPush}
        pending={pending}
        onPreview={() => start(async () => { setPreview(await actions.preview()); setReports([]) })}
        onPush={() => start(async () => {
          const r = await actions.push(); setReports(r.reports ?? []); report(r)
        })}
        onVerify={() => start(async () => {
          const r = await actions.verify(); setReports(r.reports ?? []); report(r)
        })}
      />

      {reports.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-sm font-semibold">Έλεγχος ανάγνωσης από το WooCommerce</h3>
          <VerdictTable reports={reports} />
        </section>
      )}

      {preview && (
        <details className="rounded-2xl border border-border bg-card p-5">
          <summary className="cursor-pointer text-sm font-medium">
            Payload που θα σταλεί ({preview.plans.length} όροι)
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-muted p-3 text-[11px]">
{JSON.stringify(preview.plans.map(p => ({ locale: p.locale, url: p.plan.url, body: p.plan.body })), null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
