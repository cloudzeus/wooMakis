'use client'

import { useMemo, useState, useTransition } from 'react'
import { addLinesToCart } from '@/app/kalathi/actions'
import { CheckCircle, ICON_SM, Minus, Plus, WarningCircle } from './icons'
import { EYE_SHORT, attrLabel, eyeAttrKey, splitAttributes } from '@/lib/lens-attributes'
import { CREAM, HAIRLINE, INK, INK_FAINT, INK_MUTED, SURFACE, TEAL, TEAL_DEEP } from './tokens'
import type { StoreProduct } from './types'

/**
 * Lens selection for a pair.
 *
 * A pair is ONE product with two dimensions, one per eye, not two separately
 * charged items. So this produces a single cart line whose selections carry both
 * eyes, and the quantity counts pairs.
 *
 * The two powers usually match, so mirroring is the default; unticking it is
 * what makes a different power per eye possible.
 */
export function EyePicker({ product }: { product: StoreProduct }) {
  const { perEye, choices, clinical, fixed } = useMemo(
    () => splitAttributes(product.attributes),
    [product.attributes],
  )

  const [right, setRight] = useState<Record<string, string>>({})
  const [left, setLeft] = useState<Record<string, string>>({})
  /** Single selections for the whole product, e.g. hat size. */
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [mirror, setMirror] = useState(true)
  const [pairs, setPairs] = useState(1)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const out = product.stockStatus !== 'instock'

  function updateRight(attr: string, value: string) {
    const next = { ...right, [attr]: value }
    setRight(next)
    if (mirror) setLeft(next)
  }

  const complete =
    perEye.every(a => right[a.name] && left[a.name]) &&
    choices.every(a => picked[a.name])
  const canAdd = complete && !out

  function submit() {
    // One line. Both eyes live in its selections, keyed so the order shows
    // which power belongs to which eye.
    const selections: Record<string, string> = {}
    for (const a of perEye) {
      selections[eyeAttrKey(a.name, 'RIGHT')] = right[a.name]
      selections[eyeAttrKey(a.name, 'LEFT')] = left[a.name]
    }
    for (const a of choices) {
      selections[attrLabel(a.name)] = picked[a.name]
    }
    // Base curve and diameter identify the lens even when the product offers
    // only one of each. An order without them cannot be dispensed, so they go
    // on the line whether or not the customer had anything to pick.
    for (const a of clinical) {
      selections[attrLabel(a.name)] = a.options[0]
    }

    start(async () => {
      const r = await addLinesToCart(product.id, [
        { eye: 'BOTH', selections, quantity: pairs },
      ])
      setMsg(r.ok
        ? { ok: true, text: `Προστέθηκε στο καλάθι (${r.itemCount} στο σύνολο).` }
        : { ok: false, text: r.error })
    })
  }

  return (
    <div className="space-y-4">
      {perEye.length > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: INK_MUTED }}>
          Βαθμός ανά μάτι
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px]" style={{ color: INK_MUTED }}>
          <input
            type="checkbox"
            checked={mirror}
            onChange={e => {
              setMirror(e.target.checked)
              if (e.target.checked) setLeft(right)
            }}
          />
          Ίδιος και στα δύο μάτια
        </label>
      </div>
      )}

      {perEye.length > 0 && (
      <div className="grid gap-3 sm:grid-cols-2">
        <EyeColumn
          eye="RIGHT" label="Δεξί μάτι" values={right} attrs={perEye}
          disabled={out} onChange={updateRight}
        />
        <EyeColumn
          eye="LEFT" label="Αριστερό μάτι" values={left} attrs={perEye}
          disabled={out || mirror}
          hint={mirror ? 'Ακολουθεί το δεξί' : undefined}
          onChange={(attr, v) => setLeft(p => ({ ...p, [attr]: v }))}
        />
      </div>
      )}

      {/* Single selections for the whole product, e.g. hat size. */}
      {choices.map(a => (
        <label key={a.name} className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.13em]" style={{ color: INK_MUTED }}>
            {attrLabel(a.name)}
          </span>
          <select
            value={picked[a.name] ?? ''}
            disabled={out}
            onChange={e => setPicked(p => ({ ...p, [a.name]: e.target.value }))}
            className="h-12 w-full cursor-pointer rounded-full border px-5 text-[14px] outline-none disabled:cursor-not-allowed"
            style={{
              borderColor: picked[a.name] ? TEAL : HAIRLINE,
              background: SURFACE,
              color: INK,
            }}
          >
            <option value="">Επίλεξε {attrLabel(a.name).toLowerCase()}…</option>
            {a.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      ))}

      {clinical.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: SURFACE, border: `1px solid ${TEAL}` }}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.13em]" style={{ color: TEAL_DEEP }}>
            Καταχωρείται στην παραγγελία
          </p>
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {clinical.map(a => (
              <div key={a.name} className="flex items-baseline gap-2">
                <dt className="text-[11px] uppercase tracking-[0.1em]" style={{ color: INK_MUTED }}>
                  {attrLabel(a.name)}
                </dt>
                <dd className="text-[13px] font-semibold tabular-nums" style={{ color: INK }}>
                  {a.options[0]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {fixed.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl p-4" style={{ background: CREAM }}>
          {fixed.map(a => (
            <div key={a.name} className="flex items-baseline gap-2">
              <dt className="text-[11px] uppercase tracking-[0.1em]" style={{ color: INK_MUTED }}>
                {attrLabel(a.name)}
              </dt>
              <dd className="text-[13px] font-semibold" style={{ color: INK }}>{a.options.join(', ')}</dd>
            </div>
          ))}
        </dl>
      )}

      {msg && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px]"
          style={msg.ok
            ? { background: 'rgb(21 128 61 / 10%)', color: '#15803D' }
            : { background: 'rgb(185 28 28 / 8%)', color: '#B91C1C' }}
        >
          {msg.ok ? <CheckCircle size={ICON_SM} /> : <WarningCircle size={ICON_SM} />}
          {msg.text}
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border" style={{ borderColor: HAIRLINE }}>
          <button
            type="button"
            onClick={() => setPairs(q => Math.max(1, q - 1))}
            aria-label="Μείωση ποσότητας"
            className="grid h-12 w-12 cursor-pointer place-items-center rounded-full hover:bg-black/5"
          >
            <Minus size={ICON_SM} />
          </button>
          <span className="w-9 text-center text-[15px] tabular-nums">{pairs}</span>
          <button
            type="button"
            onClick={() => setPairs(q => Math.min(99, q + 1))}
            aria-label="Αύξηση ποσότητας"
            className="grid h-12 w-12 cursor-pointer place-items-center rounded-full hover:bg-black/5"
          >
            <Plus size={ICON_SM} />
          </button>
        </div>

        <button
          onClick={submit}
          disabled={pending || !canAdd}
          className="h-12 flex-1 cursor-pointer rounded-full text-[14px] font-bold transition-transform disabled:opacity-40 motion-safe:enabled:hover:-translate-y-0.5"
          style={{ background: INK, color: SURFACE }}
        >
          {pending
            ? 'Προσθήκη…'
            : out
              ? 'Εξαντλημένο'
              : !complete
                ? 'Διάλεξε βαθμό και στα δύο μάτια'
                : 'Προσθήκη στο καλάθι'}
        </button>
      </div>
    </div>
  )
}

function EyeColumn({
  eye, label, values, attrs, disabled, hint, onChange,
}: {
  eye: 'RIGHT' | 'LEFT'
  label: string
  values: Record<string, string>
  attrs: { name: string; options: string[] }[]
  disabled?: boolean
  hint?: string
  onChange: (attr: string, value: string) => void
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
    >
      <p className="flex items-baseline gap-2">
        <span className="text-[14px] font-bold" style={{ color: INK }}>{label}</span>
        <span className="text-[11px] font-bold" style={{ color: TEAL_DEEP }}>{EYE_SHORT[eye]}</span>
      </p>
      {hint && <p className="mt-0.5 text-[11.5px]" style={{ color: INK_FAINT }}>{hint}</p>}

      <div className="mt-3 space-y-2.5">
        {attrs.map(a => (
          <label key={a.name} className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: INK_MUTED }}>
              {attrLabel(a.name)}
            </span>
            <select
              value={values[a.name] ?? ''}
              disabled={disabled}
              onChange={e => onChange(a.name, e.target.value)}
              className="h-11 w-full cursor-pointer rounded-full border px-4 text-[14px] tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                borderColor: values[a.name] ? TEAL : HAIRLINE,
                background: SURFACE,
                color: INK,
              }}
            >
              <option value="">Επίλεξε…</option>
              {a.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>
  )
}
