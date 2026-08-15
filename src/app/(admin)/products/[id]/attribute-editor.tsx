'use client'

import { useState } from 'react'
import type { WooAttribute } from '@/lib/woo/attributes'

/**
 * Attribute editing.
 *
 * Options are edited as one-per-line text rather than as a tag widget: the lens
 * power lists on this catalog run to 30+ values, and pasting a column out of a
 * spreadsheet is how they actually get maintained.
 */
export function AttributeEditor({
  value, disabled, onChange,
}: {
  value: WooAttribute[]
  disabled?: boolean
  onChange: (next: WooAttribute[]) => void
}) {
  const [items, setItems] = useState<WooAttribute[]>(value)

  function update(next: WooAttribute[]) {
    const renumbered = next.map((a, i) => ({ ...a, position: i }))
    setItems(renumbered)
    onChange(renumbered)
  }

  function patch(i: number, fields: Partial<WooAttribute>) {
    const next = [...items]
    next[i] = { ...next[i], ...fields }
    update(next)
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Το προϊόν δεν έχει χαρακτηριστικά.
        </p>
      )}

      {items.map((a, i) => (
        <div key={`${a.id}-${i}`} className="rounded-xl border border-border p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              value={a.name}
              disabled={disabled || a.id > 0}
              onChange={e => patch(i, { name: e.target.value })}
              aria-label={`Όνομα χαρακτηριστικού ${i + 1}`}
              className="h-9 flex-1 rounded-full border border-border bg-card px-4 text-sm disabled:opacity-70"
            />
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                a.id > 0 ? 'bg-[var(--info)]/12 text-[var(--info)]' : 'bg-muted text-muted-foreground'
              }`}
              title={a.id > 0
                ? 'Καθολικό χαρακτηριστικό (taxonomy) — το όνομα ορίζεται κεντρικά στο WooCommerce'
                : 'Τοπικό χαρακτηριστικό αυτού του προϊόντος — ελεύθερο κείμενο'}
            >
              {a.id > 0 ? `καθολικό #${a.id}` : 'τοπικό'}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => update(items.filter((_, j) => j !== i))}
                className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                Διαγραφή
              </button>
            )}
          </div>

          <div className="mb-2 flex flex-wrap gap-4 text-xs">
            <Toggle
              label="Ορατό στη σελίδα"
              checked={a.visible}
              disabled={disabled}
              onChange={v => patch(i, { visible: v })}
            />
            <Toggle
              label="Χρησιμοποιείται για παραλλαγές"
              checked={a.variation}
              disabled={disabled}
              onChange={v => patch(i, { variation: v })}
            />
            <span className="text-muted-foreground">{a.options.length} τιμές</span>
          </div>

          <label className="block space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Τιμές — μία ανά γραμμή
            </span>
            <textarea
              value={a.options.join('\n')}
              disabled={disabled}
              rows={Math.min(10, Math.max(3, a.options.length))}
              onChange={e => patch(i, { options: e.target.value.split('\n').map(s => s.trim()) })}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </label>

          {a.id > 0 && (
            <p className="mt-2 text-[11px] text-[var(--warning)]">
              ⚠ Καθολικό χαρακτηριστικό: το WooCommerce δέχεται μόνο τιμές που υπάρχουν
              ήδη ως όροι. Νέες τιμές αγνοούνται χωρίς σφάλμα.
            </p>
          )}
        </div>
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={() =>
            update([...items, {
              id: 0, name: 'Νέο χαρακτηριστικό', position: items.length,
              visible: true, variation: false, options: [],
            }])
          }
          className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          + Προσθήκη χαρακτηριστικού
        </button>
      )}
    </div>
  )
}

function Toggle({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="size-4 cursor-pointer accent-[var(--navy)]"
      />
      <span>{label}</span>
    </label>
  )
}
