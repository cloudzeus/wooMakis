'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { saveCustomer, type CustomerForm } from './actions'

export type CustomerOrder = {
  id: string
  number: string
  status: string
  total: number
  dateCreated: string
}

export function CustomerEditor({
  id, source, wooCustomerId, initial, orders, canEdit,
}: {
  id: string
  source: 'WOO' | 'GUEST' | 'LOCAL'
  wooCustomerId: number | null
  initial: CustomerForm
  orders: CustomerOrder[]
  canEdit: boolean
}) {
  const [pending, start] = useTransition()
  const [form, setForm] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const set = (k: keyof CustomerForm) => (v: string) => setForm({ ...form, [k]: v })

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{form.NAME || 'Χωρίς όνομα'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {source === 'WOO' ? `Λογαριασμός WooCommerce #${wooCustomerId}` :
             source === 'GUEST' ? 'Αγόρασε ως επισκέπτης — δεν έχει λογαριασμό' :
             'Δημιουργήθηκε τοπικά'}
            {' · '}{orders.length} παραγγελίες
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => start(async () => {
              const r = await saveCustomer(id, form)
              setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
            })}
            disabled={pending}
            className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        )}
      </header>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Στοιχεία επικοινωνίας</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Επωνυμία / Ονοματεπώνυμο" value={form.NAME} onChange={set('NAME')} disabled={!canEdit} full />
            <Field label="Όνομα" value={form.firstName} onChange={set('firstName')} disabled={!canEdit} />
            <Field label="Επώνυμο" value={form.lastName} onChange={set('lastName')} disabled={!canEdit} />
            <Field label="Εταιρεία" value={form.company} onChange={set('company')} disabled={!canEdit} />
            <Field label="Email" type="email" value={form.EMAIL} onChange={set('EMAIL')} disabled={!canEdit} />
            <Field label="Τηλέφωνο" value={form.PHONE01} onChange={set('PHONE01')} disabled={!canEdit} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 font-display text-base font-semibold">Τιμολόγηση</h2>
          <p className="mb-3 text-[12.5px] text-muted-foreground">
            Δεν υπάρχουν στο WooCommerce — κρατιούνται μόνο εδώ, για τιμολόγια.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ΑΦΜ" value={form.AFM} onChange={set('AFM')} disabled={!canEdit} help="9 ψηφία" />
            <Field label="ΔΟΥ" value={form.IRSDATA} onChange={set('IRSDATA')} disabled={!canEdit} />
            <Field label="Επάγγελμα" value={form.JOBTYPETRD} onChange={set('JOBTYPETRD')} disabled={!canEdit} full />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Διεύθυνση</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Διεύθυνση" value={form.ADDRESS} onChange={set('ADDRESS')} disabled={!canEdit} full />
            <Field label="Τ.Κ." value={form.ZIP} onChange={set('ZIP')} disabled={!canEdit} />
            <Field label="Πόλη" value={form.CITY} onChange={set('CITY')} disabled={!canEdit} />
            <Field label="Νομός / Περιοχή" value={form.DISTRICT} onChange={set('DISTRICT')} disabled={!canEdit} />
            <Field label="Χώρα" value={form.COUNTRY} onChange={set('COUNTRY')} disabled={!canEdit} help="ISO-2, π.χ. GR" />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Εσωτερικά</h2>
          <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ISACTIVE}
              disabled={!canEdit}
              onChange={e => setForm({ ...form, ISACTIVE: e.target.checked })}
              className="size-4 cursor-pointer accent-[var(--navy)]"
            />
            Ενεργός πελάτης
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Σημειώσεις</span>
            <textarea
              value={form.REMARKS}
              disabled={!canEdit}
              rows={5}
              onChange={e => setForm({ ...form, REMARKS: e.target.value })}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </label>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-base font-semibold">
          Παραγγελίες <span className="text-muted-foreground">({orders.length})</span>
        </h2>
        {orders.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Καμία παραγγελία συνδεδεμένη με αυτόν τον πελάτη.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {orders.map(o => (
              <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-[13px]">
                <Link href={`/orders?q=${o.number}`} className="font-medium hover:underline">
                  #{o.number}
                </Link>
                <span className="text-muted-foreground">{o.status}</span>
                <span className="text-muted-foreground">
                  {new Date(o.dateCreated).toLocaleDateString('el-GR')}
                </span>
                <span className="font-medium tabular-nums">{o.total.toFixed(2)} €</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Field({
  label, value, onChange, disabled, type = 'text', help, full,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  type?: string
  help?: string
  full?: boolean
}) {
  return (
    <label className={`block space-y-1 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="h-9 w-full rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
      {help && <span className="block text-[11px] text-muted-foreground">{help}</span>}
    </label>
  )
}
