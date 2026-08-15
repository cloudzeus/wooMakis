'use client'

import { useRef, useState, useTransition } from 'react'
import type { WooAttribute } from '@/lib/woo/attributes'
import {
  VerdictTable, WooPushPanel, type Gate, type Report,
} from '@/components/admin/woo-push'
import { AttributeEditor } from './attribute-editor'
import { ImageSorter } from './image-sorter'
import {
  previewProductPush, pushProductToWoo, removeProductImage, reorderProductImages,
  saveProductAttributes, saveProductFields, translateProduct, uploadProductImage,
  verifyAgainstWoo, type PushPreview, type PushScope,
} from './actions'

type Img = {
  assetId: string; cdnUrl: string; mimeType: string; bytes: number
  width: number | null; height: number | null; position: number; alt: string | null
}
type Tr = { locale: string; wooId: number | null; name: string; shortDescription: string; permalink: string | null }
type Product = {
  id: string; wooGroupKey: number; sku: string; type: string; status: string
  price: string; regularPrice: string; onSale: boolean
  stockStatus: string; stockQuantity: number | null
  categories: string[]; translations: Tr[]; images: Img[]; attributes: WooAttribute[]
}

const PUSH_OPTIONS = [
  { key: 'content' as const, label: 'Ονόματα και περιγραφές',
    hint: 'Ξεχωριστά ανά γλώσσα — κάθε μετάφραση είναι δικό της post στο WordPress.' },
  { key: 'pricing' as const, label: 'SKU, τιμή, κατάσταση, απόθεμα',
    hint: 'Η τιμή πώλησης δεν στέλνεται: το Woo την υπολογίζει από την κανονική τιμή.' },
  { key: 'attributes' as const, label: 'Χαρακτηριστικά',
    hint: 'Το WooCommerce ΑΝΤΙΚΑΘΙΣΤΑ όλο το σύνολο — στέλνονται πάντα όλα.' },
  { key: 'images' as const, label: 'Εικόνες',
    hint: 'Το WordPress τις κατεβάζει από το Bunny. Αντικαθιστά όλη τη συλλογή.' },
]

export function ProductEditor({
  product, canEdit, canUpload, canDelete, canPush, gate, deepseekReady,
}: {
  product: Product
  canEdit: boolean; canUpload: boolean; canDelete: boolean; canPush: boolean
  gate: Gate
  deepseekReady: boolean
}) {
  const [pending, start] = useTransition()
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<PushPreview | null>(null)
  const [reports, setReports] = useState<Report[]>([])
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
  const [attributes, setAttributes] = useState<WooAttribute[]>(product.attributes)

  function report(r: { ok: boolean; message?: string; error?: string }) {
    setToast(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error! })
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    start(async () => {
      report(await uploadProductImage(product.id, fd))
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
            onClick={() => start(async () => report(await saveProductFields(product.id, form)))}
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

        <ImageSorter
          // Remount when the set changes so the sorter picks up added or
          // removed images instead of holding its initial copy.
          key={product.images.map(i => i.assetId).join(',')}
          images={product.images}
          disabled={!canEdit || pending}
          onReorder={ids => start(async () => report(await reorderProductImages(product.id, ids)))}
          onRemove={canDelete
            ? assetId => start(async () => report(await removeProductImage(product.id, assetId)))
            : undefined}
        />
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Μεταφράσεις</h2>
            {canEdit && (
              <div className="flex items-center gap-1.5">
                {(['el', 'en'] as const).map(loc => {
                  const exists = product.translations.some(t => t.locale === loc)
                  return (
                    <button
                      key={loc}
                      onClick={() => start(async () => report(await translateProduct(product.id, loc)))}
                      disabled={pending || !deepseekReady}
                      title={
                        deepseekReady
                          ? `${exists ? 'Επαναμετάφραση' : 'Δημιουργία μετάφρασης'} στα ${loc} με DeepSeek`
                          : 'Λείπει το DEEPSEEK_API_KEY'
                      }
                      className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
                    >
                      {exists ? '↻' : '+'} {loc.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {!deepseekReady && (
            <p className="mb-3 rounded-xl bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
              ⚠ Η αυτόματη μετάφραση απαιτεί <code>DEEPSEEK_API_KEY</code> στο .env.
            </p>
          )}
          <div className="space-y-4">
            {form.translations.map((t, i) => {
              const meta = product.translations.find(x => x.locale === t.locale)
              return (
                <div key={t.locale} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--navy)]/10 px-2 py-0.5 text-[11px] uppercase text-[var(--navy)]">
                      {t.locale}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {meta?.wooId ? `Woo #${meta.wooId}` : 'τοπική — δεν υπάρχει στο Woo'}
                    </span>
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

      {/* ── Attributes ───────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">
            Χαρακτηριστικά <span className="text-muted-foreground">({attributes.length})</span>
          </h2>
          {canEdit && (
            <button
              onClick={() => start(async () => report(await saveProductAttributes(product.id, attributes)))}
              disabled={pending}
              className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              Αποθήκευση χαρακτηριστικών
            </button>
          )}
        </div>
        <AttributeEditor value={attributes} disabled={!canEdit} onChange={setAttributes} />
      </section>

      {/* ── Push ─────────────────────────────────── */}
      <WooPushPanel
        title="Συγχρονισμός με το WooCommerce"
        description="Επίλεξε τι θα σταλεί. Μετά την αποστολή το προϊόν διαβάζεται ξανά από το κατάστημα και συγκρίνεται πεδίο προς πεδίο — η απάντηση του WooCommerce στο PUT απλώς επαναλαμβάνει ό,τι στάλθηκε και δεν αποδεικνύει τίποτα."
        gate={gate}
        options={PUSH_OPTIONS}
        warnings={preview?.warnings}
        canPush={canPush}
        pending={pending}
        onPreview={scope => start(async () => {
          const p = await previewProductPush(product.id, scope as PushScope)
          setPreview(p)
          setReports([])
        })}
        onPush={scope => start(async () => {
          const r = await pushProductToWoo(product.id, scope as PushScope, true)
          setReports(r.reports ?? [])
          report(r)
        })}
        onVerify={() => start(async () => {
          const r = await verifyAgainstWoo(product.id)
          setReports(r.reports ?? [])
          report(r)
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
            Payload που θα σταλεί ({preview.plans.length} posts)
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-muted p-3 text-[11px]">
{JSON.stringify(preview.plans.map(p => ({ locale: p.locale, url: p.plan.url, body: p.plan.body })), null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
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
