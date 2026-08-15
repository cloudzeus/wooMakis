'use client'

import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import {
  previewImagePush, pushImagesToWoo, removeProductImage,
  saveProductFields, uploadProductImage, type PushPreview,
} from './actions'

type Img = {
  assetId: string; cdnUrl: string; mimeType: string; bytes: number
  width: number | null; height: number | null; position: number; alt: string | null
}
type Tr = { locale: string; wooId: number; name: string; shortDescription: string; permalink: string | null }
type Product = {
  id: string; wooGroupKey: number; sku: string; type: string; status: string
  price: string; regularPrice: string; onSale: boolean
  stockStatus: string; stockQuantity: number | null
  categories: string[]; translations: Tr[]; images: Img[]
}

export function ProductEditor({
  product, canEdit, canUpload, canDelete, canPush, gate,
}: {
  product: Product
  canEdit: boolean; canUpload: boolean; canDelete: boolean; canPush: boolean
  gate: { allowWrites: boolean; dryRun: boolean; environment: string }
}) {
  const [pending, start] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<PushPreview | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    sku: product.sku,
    status: product.status,
    price: product.price,
    regularPrice: product.regularPrice,
    stockStatus: product.stockStatus,
    translations: product.translations.map(t => ({
      locale: t.locale, name: t.name, shortDescription: t.shortDescription,
    })),
  })

  const writesBlocked = !gate.allowWrites || gate.dryRun
  const requiredPhrase = 'confirm production push'

  function onSave() {
    start(async () => {
      const r = await saveProductFields(product.id, form)
      setToast(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
    })
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    start(async () => {
      const r = await uploadProductImage(product.id, fd)
      setToast(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">
            {product.translations.find(t => t.locale === 'el')?.name ?? '—'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Woo group #{product.wooGroupKey} · {product.type} · {product.categories.join(', ') || 'χωρίς κατηγορία'}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={onSave}
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

      {/* ── Images ───────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">
            Εικόνες <span className="text-muted-foreground">({product.images.length})</span>
          </h2>
          {canUpload && (
            <label className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm hover:bg-accent">
              + Προσθήκη εικόνας
              <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
            </label>
          )}
        </div>

        {product.images.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Το προϊόν δεν έχει εικόνες. Πρόσθεσε μία — θα μετατραπεί αυτόματα σε WebP.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {product.images.map(img => (
              <li key={img.assetId} className="group relative">
                <Image
                  src={img.cdnUrl}
                  alt={img.alt ?? ''}
                  width={img.width ?? 300}
                  height={img.height ?? 300}
                  className="aspect-square w-full rounded-[10px] border border-border object-cover"
                  unoptimized
                />
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {img.mimeType.replace('image/', '').toUpperCase()} · {Math.round(img.bytes / 1024)} KB
                  {img.width && img.height && <> · {img.width}×{img.height}</>}
                </div>
                {canDelete && (
                  <button
                    onClick={() =>
                      start(async () => {
                        const r = await removeProductImage(product.id, img.assetId)
                        setToast(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                      })
                    }
                    className="absolute right-1 top-1 cursor-pointer rounded-full bg-card/90 px-2 py-0.5 text-xs opacity-0 shadow group-hover:opacity-100"
                    aria-label="Αφαίρεση εικόνας"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Fields ───────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Στοιχεία</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="SKU" value={form.sku} disabled={!canEdit}
              onChange={v => setForm({ ...form, sku: v })} />
            <Select label="Κατάσταση" value={form.status} disabled={!canEdit}
              onChange={v => setForm({ ...form, status: v })}
              options={[['publish', 'Δημοσιευμένο'], ['draft', 'Πρόχειρο'], ['private', 'Ιδιωτικό']]} />
            <Field label="Τιμή (€)" value={form.price} disabled={!canEdit}
              onChange={v => setForm({ ...form, price: v })} />
            <Field label="Κανονική τιμή (€)" value={form.regularPrice} disabled={!canEdit}
              onChange={v => setForm({ ...form, regularPrice: v })} />
            <Select label="Απόθεμα" value={form.stockStatus} disabled={!canEdit}
              onChange={v => setForm({ ...form, stockStatus: v })}
              options={[['instock', 'Διαθέσιμο'], ['outofstock', 'Εξαντλημένο'], ['onbackorder', 'Κατόπιν παραγγελίας']]} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Μεταφράσεις</h2>
          <div className="space-y-4">
            {form.translations.map((t, i) => {
              const meta = product.translations.find(x => x.locale === t.locale)
              return (
                <div key={t.locale} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--navy)]/10 px-2 py-0.5 text-[11px] uppercase text-[var(--navy)]">
                      {t.locale}
                    </span>
                    <span className="text-xs text-muted-foreground">Woo #{meta?.wooId}</span>
                  </div>
                  <Field label="Όνομα" value={t.name} disabled={!canEdit}
                    onChange={v => {
                      const next = [...form.translations]; next[i] = { ...t, name: v }
                      setForm({ ...form, translations: next })
                    }} />
                  <Field label="Σύντομη περιγραφή" value={t.shortDescription} disabled={!canEdit}
                    onChange={v => {
                      const next = [...form.translations]; next[i] = { ...t, shortDescription: v }
                      setForm({ ...form, translations: next })
                    }} />
                </div>
              )
            })}
            {form.translations.length < 2 && (
              <p className="text-xs text-[var(--warning)]">
                ⚠ Λείπει μετάφραση. Η δημιουργία νέας γλώσσας στο WooCommerce δεν υποστηρίζεται ακόμα.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Push to WooCommerce ──────────────────── */}
      {canPush && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 font-display text-base font-semibold">Αποστολή εικόνων στο WooCommerce</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Το WordPress κατεβάζει τις εικόνες από το Bunny CDN (sideload). Το WooCommerce
            <strong> αντικαθιστά ολόκληρη τη συλλογή</strong>, γι&apos; αυτό στέλνονται πάντα όλες.
          </p>

          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Gate ok={gate.allowWrites} label={`WOO_ALLOW_WRITES=${gate.allowWrites}`} />
            <Gate ok={!gate.dryRun} label={`WOO_DRY_RUN=${gate.dryRun}`} />
            <Gate ok={gate.environment !== 'production'} label={`env=${gate.environment}`} warn />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => start(async () => setPreview(await previewImagePush(product.id)))}
              disabled={pending}
              className="h-9 cursor-pointer rounded-full border border-border px-4 text-sm hover:bg-accent"
            >
              Προεπισκόπηση payload
            </button>

            {!writesBlocked && (
              <>
                <input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={requiredPhrase}
                  aria-label="Φράση επιβεβαίωσης"
                  className="h-9 w-64 rounded-full border border-border bg-card px-4 text-sm"
                />
                <button
                  onClick={() =>
                    start(async () => {
                      const r = await pushImagesToWoo(product.id, true)
                      setToast(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                    })
                  }
                  disabled={pending || confirmText !== requiredPhrase}
                  className="h-9 cursor-pointer rounded-full bg-destructive px-4 text-sm font-medium text-white disabled:opacity-40"
                >
                  Αποστολή στο WooCommerce
                </button>
              </>
            )}
          </div>

          {writesBlocked && (
            <p className="mt-3 rounded-xl bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
              ⚠ Οι εγγραφές είναι κλειδωμένες. Για πραγματική αποστολή χρειάζεται
              <code className="mx-1">WOO_ALLOW_WRITES=true</code> και
              <code className="mx-1">WOO_DRY_RUN=false</code> στο .env.
            </p>
          )}

          {preview && (
            <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-muted p-3 text-[11px]">
{JSON.stringify(preview.plans.map(p => ({ locale: p.locale, wooId: p.wooId, url: p.plan.url, body: p.plan.body })), null, 2)}
            </pre>
          )}
        </section>
      )}
    </div>
  )
}

function Gate({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  const cls = ok
    ? 'bg-[var(--success)]/12 text-[var(--success)]'
    : warn ? 'bg-[var(--warning)]/12 text-[var(--warning)]' : 'bg-muted text-muted-foreground'
  return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{ok ? '✓' : '●'} {label}</span>
}

function Field({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="h-9 w-full rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
    </label>
  )
}

function Select({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void
  options: [string, string][]; disabled?: boolean
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer rounded-full border border-border bg-card px-4 text-sm disabled:opacity-60"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}
