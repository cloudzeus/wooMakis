'use client'

import { useState, useTransition } from 'react'
import { placeOrder, type CheckoutForm as FormShape } from './actions'

type Summary = {
  itemCount: number
  subtotal: number
  lines: { name: string; quantity: number; lineTotal: number }[]
}

const EMPTY: FormShape = {
  firstName: '', lastName: '', email: '', phone: '',
  address1: '', address2: '', city: '', postcode: '', country: 'GR', note: '',
}

export function CheckoutForm({ summary, ordersEnabled }: { summary: Summary; ordersEnabled: boolean }) {
  const [form, setForm] = useState<FormShape>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const set = (k: keyof FormShape) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await placeOrder(form)
      if (!r.ok) { setError(r.error); return }
      // Leaving for WooCommerce's payment page — a full navigation, not a
      // client-side route change, because the destination is another origin.
      window.location.href = r.paymentUrl
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <fieldset className="space-y-4 rounded-2xl border border-black/8 p-6">
          <legend className="px-2 text-sm font-semibold">Στοιχεία επικοινωνίας</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Όνομα" required value={form.firstName} onChange={set('firstName')} autoComplete="given-name" />
            <Input label="Επώνυμο" required value={form.lastName} onChange={set('lastName')} autoComplete="family-name" />
            <Input label="Email" required type="email" value={form.email} onChange={set('email')} autoComplete="email"
              help="Θα λάβεις εδώ την επιβεβαίωση της παραγγελίας." />
            <Input label="Τηλέφωνο" required value={form.phone} onChange={set('phone')} autoComplete="tel"
              help="Χρειάζεται για την παράδοση." />
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-2xl border border-black/8 p-6">
          <legend className="px-2 text-sm font-semibold">Διεύθυνση παράδοσης</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Οδός και αριθμός" required value={form.address1} onChange={set('address1')} autoComplete="address-line1" />
            </div>
            <div className="sm:col-span-2">
              <Input label="Όροφος, διαμέρισμα (προαιρετικό)" value={form.address2} onChange={set('address2')} autoComplete="address-line2" />
            </div>
            <Input label="Πόλη" required value={form.city} onChange={set('city')} autoComplete="address-level2" />
            <Input label="Τ.Κ." required value={form.postcode} onChange={set('postcode')} autoComplete="postal-code" />
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-black/8 p-6">
          <legend className="px-2 text-sm font-semibold">Σημείωση (προαιρετικό)</legend>
          <textarea
            value={form.note}
            onChange={e => set('note')(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-[#00cfc9]"
            placeholder="Οδηγίες παράδοσης, ώρες που είσαι σπίτι…"
          />
        </fieldset>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            ⚠ {error}
          </p>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-black/8 p-6">
        <h2 className="mb-4 text-lg font-semibold">Η παραγγελία σου</h2>
        <ul className="space-y-2 text-sm">
          {summary.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-[#0f2429]/70">{l.quantity}× {l.name}</span>
              <span className="shrink-0 tabular-nums">{l.lineTotal.toFixed(2)} €</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-black/8 pt-4 font-semibold">
          <span>Σύνολο</span>
          <span className="tabular-nums">{summary.subtotal.toFixed(2)} €</span>
        </div>

        <button
          type="submit"
          disabled={pending || !ordersEnabled}
          className="mt-6 w-full cursor-pointer rounded-full bg-[#0f2429] px-6 py-3 font-medium text-white transition-colors hover:bg-[#00cfc9] disabled:opacity-40"
        >
          {pending ? 'Δημιουργία παραγγελίας…' : 'Συνέχεια στην πληρωμή →'}
        </button>

        {!ordersEnabled && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Οι παραγγελίες είναι απενεργοποιημένες. Χρειάζεται
            <code className="mx-1">WOO_ALLOW_ORDERS=true</code> στο .env.
          </p>
        )}

        <p className="mt-3 text-xs text-[#0f2429]/50">
          Η πληρωμή ολοκληρώνεται στη σελίδα του mylens.gr, με Eurobank, PayPal ή
          αντικαταβολή. <strong>Δεν συλλέγουμε και δεν αποθηκεύουμε στοιχεία κάρτας.</strong>
        </p>
      </aside>
    </form>
  )
}

function Input({
  label, value, onChange, required, type = 'text', autoComplete, help,
}: {
  label: string; value: string; onChange: (v: string) => void
  required?: boolean; type?: string; autoComplete?: string; help?: string
}) {
  return (
    <label className="block">
      {/* Labels are always visible, never placeholder-only. */}
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#0f2429]/60">
        {label}{required && <span className="ml-0.5 text-[#00cfc9]">*</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        className="h-11 w-full rounded-full border border-black/10 px-4 text-sm outline-none focus:border-[#00cfc9]"
      />
      {help && <span className="mt-1 block text-xs text-[#0f2429]/50">{help}</span>}
    </label>
  )
}
