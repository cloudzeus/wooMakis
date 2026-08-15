'use client'

import { useState, useTransition } from 'react'
import { RowActions } from '@/components/admin/row-actions'
import { moveSection, resetSection, saveSection, setSectionEnabled, type SectionForm } from './actions'

export type SectionRow = {
  kind: string
  label: string
  help: string
  enabled: boolean
  imageSlot: string
  imageSlotB: string
  itemLimit: number
  /** Whether this band uses images / a list, so the form only shows what applies. */
  usesImage: boolean
  usesSecondImage: boolean
  usesLimit: boolean
  translations: SectionForm['translations']
  /** Shipped copy, shown as the placeholder so blanks are self-explanatory. */
  defaults: Record<string, SectionForm['translations'][number]>
}

const LOCALES = ['el', 'en'] as const

export function SectionsManager({ rows, slots }: { rows: SectionRow[]; slots: string[] }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const r = await fn()
      setMsg(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error! })
    })
  }

  return (
    <div className="space-y-3">
      {msg && (
        <p
          role="status"
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            msg.ok ? 'bg-[var(--success)]/12 text-[var(--success)]' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {msg.ok ? '✓ ' : '⚠ '}{msg.text}
        </p>
      )}

      <p className="rounded-2xl bg-muted px-4 py-2.5 text-[13px] text-muted-foreground">
        Η σειρά εδώ είναι η σειρά στην αρχική σελίδα. Άδειο πεδίο σημαίνει
        «χρησιμοποίησε το προεπιλεγμένο κείμενο» — δεν σημαίνει κενό στη σελίδα.
      </p>

      {rows.map((r, i) => (
        <section key={r.kind} className="rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>

            <button
              onClick={() => setOpen(open === r.kind ? null : r.kind)}
              aria-expanded={open === r.kind}
              className="cursor-pointer text-left text-sm font-medium hover:underline"
            >
              {open === r.kind ? '▾' : '▸'} {r.label}
            </button>

            <span className="text-xs text-muted-foreground">{r.help}</span>

            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
                r.enabled
                  ? 'bg-[var(--success)]/12 text-[var(--success)]'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {r.enabled ? '✓ Εμφανίζεται' : '○ Κρυφή'}
            </span>

            <RowActions
              label={`Ενέργειες για ${r.label}`}
              actions={[
                { label: '↑ Πιο πάνω', disabled: i === 0, onSelect: () => run(() => moveSection(r.kind, -1)) },
                { label: '↓ Πιο κάτω', disabled: i === rows.length - 1, onSelect: () => run(() => moveSection(r.kind, 1)) },
                {
                  label: r.enabled ? 'Απόκρυψη από την αρχική' : 'Εμφάνιση στην αρχική',
                  onSelect: () => run(() => setSectionEnabled(r.kind, !r.enabled)),
                },
                { label: 'Προβολή αρχικής', href: '/', external: true },
                {
                  label: 'Επαναφορά κειμένων',
                  danger: true,
                  hint: 'Διαγράφει τις αλλαγές σου και επαναφέρει τα αρχικά κείμενα',
                  onSelect: () => run(() => resetSection(r.kind)),
                },
              ]}
            />
          </div>

          {open === r.kind && (
            <Editor row={r} slots={slots} pending={pending} onSave={form => run(() => saveSection(r.kind, form))} />
          )}
        </section>
      ))}
    </div>
  )
}

function Editor({
  row, slots, pending, onSave,
}: {
  row: SectionRow
  slots: string[]
  pending: boolean
  onSave: (form: SectionForm) => void
}) {
  const [form, setForm] = useState<SectionForm>({
    imageSlot: row.imageSlot,
    imageSlotB: row.imageSlotB,
    itemLimit: row.itemLimit,
    translations: LOCALES.map(l =>
      row.translations.find(t => t.locale === l)
      ?? { locale: l, eyebrow: '', title: '', body: '', ctaLabel: '', ctaHref: '', ctaLabelB: '', ctaHrefB: '' }),
  })

  const patch = (locale: string, key: keyof SectionForm['translations'][number], v: string) =>
    setForm(f => ({
      ...f,
      translations: f.translations.map(t => (t.locale === locale ? { ...t, [key]: v } : t)),
    }))

  const hasCopy = row.kind !== 'TRUST' && row.kind !== 'BRANDS'

  return (
    <div className="space-y-4 border-t border-border px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {row.usesImage && (
          <SlotPicker
            label="Εικόνα"
            value={form.imageSlot}
            slots={slots}
            onChange={v => setForm({ ...form, imageSlot: v })}
          />
        )}
        {row.usesSecondImage && (
          <SlotPicker
            label="Δεύτερη εικόνα"
            value={form.imageSlotB}
            slots={slots}
            onChange={v => setForm({ ...form, imageSlotB: v })}
          />
        )}
        {row.usesLimit && (
          <label className="block space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Πόσα να δείχνει
            </span>
            <input
              type="number"
              min={1}
              max={24}
              value={form.itemLimit}
              onChange={e => setForm({ ...form, itemLimit: Number(e.target.value) })}
              className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm"
            />
          </label>
        )}
      </div>

      {hasCopy ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {form.translations.map(t => {
            const d = row.defaults[t.locale]
            return (
              <div key={t.locale} className="space-y-2">
                <span className="inline-block rounded-full bg-[var(--navy)]/10 px-2 py-0.5 text-[11px] uppercase text-[var(--navy)]">
                  {t.locale}
                </span>
                <Field label="Μικρή ετικέτα" value={t.eyebrow} placeholder={d?.eyebrow}
                       onChange={v => patch(t.locale, 'eyebrow', v)} />
                <Field label="Τίτλος" value={t.title} placeholder={d?.title}
                       onChange={v => patch(t.locale, 'title', v)} />
                <Field label="Κείμενο" value={t.body} placeholder={d?.body} multiline
                       onChange={v => patch(t.locale, 'body', v)} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Κουμπί" value={t.ctaLabel} placeholder={d?.ctaLabel}
                         onChange={v => patch(t.locale, 'ctaLabel', v)} />
                  <Field label="Σύνδεσμος" value={t.ctaHref} placeholder={d?.ctaHref}
                         onChange={v => patch(t.locale, 'ctaHref', v)} />
                  <Field label="2ο κουμπί" value={t.ctaLabelB} placeholder={d?.ctaLabelB}
                         onChange={v => patch(t.locale, 'ctaLabelB', v)} />
                  <Field label="2ος σύνδεσμος" value={t.ctaHrefB} placeholder={d?.ctaHrefB}
                         onChange={v => patch(t.locale, 'ctaHrefB', v)} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Αυτή η ενότητα δεν έχει δικά της κείμενα — παίρνει τα δεδομένα της από
          τον κατάλογο.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Οι σύνδεσμοι πρέπει να είναι εσωτερικοί: να ξεκινούν με <code>/</code> ή{' '}
        <code>#</code>. Εξωτερική διεύθυνση σε κουμπί της αρχικής δεν γίνεται δεκτή.
      </p>

      <button
        onClick={() => onSave(form)}
        disabled={pending}
        className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Αποθήκευση ενότητας
      </button>
    </div>
  )
}

function SlotPicker({
  label, value, slots, onChange,
}: {
  label: string; value: string; slots: string[]; onChange: (v: string) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer rounded-full border border-border bg-card px-4 text-sm"
      >
        <option value="">— καμία —</option>
        {slots.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <span className="block px-2 text-[11px] text-muted-foreground">
        Οι θέσεις ορίζονται στα Πολυμέσα.
      </span>
    </label>
  )
}

function Field({
  label, value, onChange, placeholder, multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const shared = 'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea value={value} rows={3} placeholder={placeholder}
                  onChange={e => onChange(e.target.value)} className={shared} />
      ) : (
        <input value={value} placeholder={placeholder}
               onChange={e => onChange(e.target.value)} className={`${shared} h-10 rounded-full px-4`} />
      )}
    </label>
  )
}
