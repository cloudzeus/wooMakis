'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { createLocalProduct, type NewProductInput } from './actions'

export type Option = { id: string; name: string }

export function NewProductForm({
  categories, brands, writesLocked,
}: {
  categories: Option[]
  brands: Option[]
  writesLocked: boolean
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<NewProductInput>({
    nameEl: '',
    nameEn: '',
    sku: '',
    type: 'simple',
    // Draft by default: a new product should not appear in the storefront the
    // instant someone saves a half-filled form.
    status: 'draft',
    price: '',
    regularPrice: '',
    stockStatus: 'instock',
    shortDescriptionEl: '',
    categoryIds: [],
    brandIds: [],
  })

  const set = <K extends keyof NewProductInput>(k: K) => (v: NewProductInput[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  function toggle(list: 'categoryIds' | 'brandIds', id: string) {
    setForm(f => ({
      ...f,
      [list]: f[list].includes(id) ? f[list].filter(x => x !== id) : [...f[list], id],
    }))
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        setError(null)
        // Success redirects from the action, so anything returned is a failure.
        start(async () => {
          const r = await createLocalProduct(form)
          if (r && !r.ok) setError(r.error)
        })
      }}
      className="space-y-4"
    >
      <p className="rounded-2xl bg-muted px-4 py-3 text-[13px] text-muted-foreground">
        Το προϊόν δημιουργείται <strong>τοπικά</strong>. Δεν εμφανίζεται στο mylens.gr μέχρι
        να το στείλεις ρητά, από τη σελίδα του προϊόντος, με τον ίδιο ελεγχόμενο τρόπο
        που στέλνεται κάθε άλλη αλλαγή.
        {writesLocked && ' Αυτή τη στιγμή οι εγγραφές προς το WooCommerce είναι κλειδωμένες.'}
      </p>

      {error && (
        <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          ⚠ {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Ονομασία</h2>
          <div className="space-y-3">
            <Field
              label="Όνομα (ελληνικά)"
              value={form.nameEl}
              onChange={set('nameEl')}
              help="Υποχρεωτικό. Από αυτό παράγεται και το slug."
            />
            <Field
              label="Όνομα (αγγλικά)"
              value={form.nameEn}
              onChange={set('nameEn')}
              help="Προαιρετικό — μπορεί να συμπληρωθεί αργότερα με DeepSeek."
            />
            <label className="block space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Σύντομη περιγραφή (ελληνικά)
              </span>
              <textarea
                value={form.shortDescriptionEl}
                onChange={e => set('shortDescriptionEl')(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Στοιχεία</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="SKU" value={form.sku} onChange={set('sku')} />
            <Select
              label="Τύπος"
              value={form.type}
              onChange={set('type')}
              options={[['simple', 'Απλό'], ['variable', 'Με παραλλαγές']]}
            />
            <Select
              label="Κατάσταση"
              value={form.status}
              onChange={set('status')}
              options={[['draft', 'Πρόχειρο'], ['publish', 'Δημοσιευμένο'], ['private', 'Ιδιωτικό']]}
            />
            <Select
              label="Απόθεμα"
              value={form.stockStatus}
              onChange={set('stockStatus')}
              options={[
                ['instock', 'Διαθέσιμο'],
                ['outofstock', 'Εξαντλημένο'],
                ['onbackorder', 'Κατόπιν παραγγελίας'],
              ]}
            />
            <Field label="Τιμή (€)" value={form.price} onChange={set('price')} />
            <Field
              label="Κανονική τιμή (€)"
              value={form.regularPrice}
              onChange={set('regularPrice')}
              help="Αν είναι μεγαλύτερη από την τιμή, το προϊόν μαρκάρεται σε προσφορά."
            />
          </div>
        </section>

        <Picker
          title="Κατηγορίες"
          options={categories}
          selected={form.categoryIds}
          onToggle={id => toggle('categoryIds', id)}
        />
        <Picker
          title="Μάρκες"
          options={brands}
          selected={form.brandIds}
          onToggle={id => toggle('brandIds', id)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !form.nameEl.trim()}
          className="h-11 cursor-pointer rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Δημιουργία…' : 'Δημιουργία προϊόντος'}
        </button>
        <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground">
          Άκυρο
        </Link>
      </div>
    </form>
  )
}

function Picker({
  title, options, selected, onToggle,
}: {
  title: string
  options: Option[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter(o => o.name.toLowerCase().includes(q)) : options

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold">
          {title} <span className="text-muted-foreground">({selected.length})</span>
        </h2>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Φίλτρο…"
          aria-label={`Φίλτρο ${title.toLowerCase()}`}
          className="h-8 w-40 rounded-full border border-border bg-card px-3 text-xs"
        />
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
        {shown.map(o => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-accent">
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={() => onToggle(o.id)}
              className="size-4 cursor-pointer accent-[var(--navy)]"
            />
            {o.name}
          </label>
        ))}
        {shown.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">Κανένα αποτέλεσμα.</p>
        )}
      </div>
    </section>
  )
}

function Field({
  label, value, onChange, help,
}: {
  label: string; value: string; onChange: (v: string) => void; help?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {help && <span className="block px-2 text-[11px] text-muted-foreground">{help}</span>}
    </label>
  )
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][]
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer rounded-full border border-border bg-card px-4 text-sm"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}
