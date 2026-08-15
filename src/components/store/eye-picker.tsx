'use client'

import { useMemo, useState, useTransition } from 'react'
import { addLinesToCart, type EyeChoice, type LineSelection } from '@/app/kalathi/actions'
import { CheckCircle, ICON_SM, Minus, Plus, WarningCircle } from './icons'
import { EYE_LABEL, EYE_SHORT, splitAttributes } from '@/lib/lens-attributes'
import { CREAM, HAIRLINE, INK, INK_FAINT, INK_MUTED, R_INNER, SURFACE, TEAL, TEAL_DEEP } from './tokens'
import type { StoreProduct } from './types'

type EyeState = {
  enabled: boolean
  quantity: number
  selections: Record<string, string>
}

/**
 * Per-eye lens selection.
 *
 * Contact lenses are prescribed separately for each eye and the two powers
 * usually differ, so this is two independent selections that produce two cart
 * lines, not one line with a quantity of two.
 *
 * Either eye can be switched off: buying for one eye only is normal, whether
 * because the prescription differs or because only one lens was lost.
 */
export function EyePicker({ product }: { product: StoreProduct }) {
  const { perEye, fixed } = useMemo(
    () => splitAttributes(product.attributes),
    [product.attributes],
  )

  const blank = (): EyeState => ({
    enabled: true,
    quantity: 1,
    selections: Object.fromEntries(perEye.map(a => [a.name, ''])),
  })

  const [right, setRight] = useState<EyeState>(blank)
  const [left, setLeft] = useState<EyeState>(blank)
  const [mirror, setMirror] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const out = product.stockStatus !== 'instock'

  function updateRight(next: EyeState) {
    setRight(next)
    // Most prescriptions are the same in both eyes, so mirroring is the useful
    // default; unticking it is what makes different powers possible.
    if (mirror) setLeft({ ...next, quantity: next.quantity })
  }

  const active = [
    right.enabled ? ({ eye: 'RIGHT', state: right } as const) : null,
    left.enabled ? ({ eye: 'LEFT', state: left } as const) : null,
  ].filter(Boolean) as { eye: EyeChoice; state: EyeState }[]

  const missing = active.filter(a =>
    perEye.some(attr => !a.state.selections[attr.name]),
  )
  const canAdd = active.length > 0 && missing.length === 0 && !out

  function submit() {
    const lines: LineSelection[] = active.map(a => ({
      eye: a.eye,
      selections: a.state.selections,
      quantity: a.state.quantity,
    }))
    start(async () => {
      const r = await addLinesToCart(product.id, lines)
      setMsg(r.ok
        ? { ok: true, text: `Προστέθηκαν στο καλάθι (${r.itemCount} προϊόντα).` }
        : { ok: false, text: r.error })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: INK_MUTED }}>
          Επιλογή ανά μάτι
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px]" style={{ color: INK_MUTED }}>
          <input
            type="checkbox"
            checked={mirror}
            onChange={e => {
              setMirror(e.target.checked)
              if (e.target.checked) setLeft({ ...right })
            }}
          />
          Ίδιος βαθμός και στα δύο μάτια
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <EyeCard
          eye="RIGHT" state={right} attrs={perEye} disabled={out}
          onChange={updateRight}
        />
        <EyeCard
          eye="LEFT" state={left} attrs={perEye} disabled={out || mirror}
          hint={mirror ? 'Ακολουθεί το δεξί μάτι' : undefined}
          onChange={setLeft}
        />
      </div>

      {fixed.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl p-4" style={{ background: CREAM }}>
          {fixed.map(a => (
            <div key={a.name} className="flex items-baseline gap-2">
              <dt className="text-[11px] uppercase tracking-[0.1em]" style={{ color: INK_MUTED }}>
                {a.name.replace(/^Ιδιότητα\s*[-–]\s*/, '')}
              </dt>
              <dd className="text-[13px] font-semibold" style={{ color: INK }}>
                {a.options.join(', ')}
              </dd>
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

      <button
        onClick={submit}
        disabled={pending || !canAdd}
        className="h-13 w-full cursor-pointer rounded-full py-4 text-[14px] font-bold transition-transform disabled:opacity-40 motion-safe:enabled:hover:-translate-y-0.5"
        style={{ background: INK, color: SURFACE }}
      >
        {pending
          ? 'Προσθήκη…'
          : out
            ? 'Εξαντλημένο'
            : active.length === 0
              ? 'Διάλεξε τουλάχιστον ένα μάτι'
              : missing.length > 0
                ? 'Συμπλήρωσε τις επιλογές'
                : `Προσθήκη στο καλάθι (${active.length === 2 ? '2 κουτιά' : '1 κουτί'})`}
      </button>

      <p className="text-center text-[12px]" style={{ color: INK_FAINT }}>
        Κάθε μάτι χρεώνεται ξεχωριστά. Αν χρειάζεσαι φακό μόνο για το ένα,
        ξετίκαρε το άλλο.
      </p>
    </div>
  )
}

function EyeCard({
  eye, state, attrs, disabled, hint, onChange,
}: {
  eye: 'RIGHT' | 'LEFT'
  state: EyeState
  attrs: { name: string; options: string[] }[]
  disabled?: boolean
  hint?: string
  onChange: (s: EyeState) => void
}) {
  return (
    <div
      className="rounded-2xl p-4 transition-opacity"
      style={{
        background: SURFACE,
        border: `1px solid ${state.enabled ? HAIRLINE : 'transparent'}`,
        opacity: state.enabled ? 1 : 0.5,
      }}
    >
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span className="text-[14px] font-bold" style={{ color: INK }}>{EYE_LABEL[eye]}</span>
          <span className="text-[11px] font-semibold" style={{ color: TEAL_DEEP }}>{EYE_SHORT[eye]}</span>
        </span>
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={e => onChange({ ...state, enabled: e.target.checked })}
        />
      </label>

      {hint && <p className="mt-1 text-[11.5px]" style={{ color: INK_FAINT }}>{hint}</p>}

      <div className="mt-3 space-y-2.5">
        {attrs.map(a => (
          <label key={a.name} className="block">
            <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: INK_MUTED }}>
              {a.name.replace(/^Ιδιότητα\s*[-–]\s*/, '')}
            </span>
            <select
              value={state.selections[a.name] ?? ''}
              disabled={disabled || !state.enabled}
              onChange={e => onChange({
                ...state,
                selections: { ...state.selections, [a.name]: e.target.value },
              })}
              className="h-11 w-full cursor-pointer rounded-full border px-4 text-[14px] tabular-nums outline-none disabled:cursor-not-allowed"
              style={{
                borderColor: state.selections[a.name] ? TEAL : HAIRLINE,
                background: SURFACE,
                color: INK,
              }}
            >
              <option value="">Επίλεξε…</option>
              {a.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11.5px]" style={{ color: INK_MUTED }}>Κουτιά</span>
          <div className="flex items-center rounded-full border" style={{ borderColor: HAIRLINE }}>
            <button
              type="button"
              disabled={!state.enabled}
              onClick={() => onChange({ ...state, quantity: Math.max(1, state.quantity - 1) })}
              aria-label={`Μείωση για ${EYE_LABEL[eye]}`}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full hover:bg-black/5"
            >
              <Minus size={14} />
            </button>
            <span className="w-7 text-center text-[13px] tabular-nums">{state.quantity}</span>
            <button
              type="button"
              disabled={!state.enabled}
              onClick={() => onChange({ ...state, quantity: Math.min(99, state.quantity + 1) })}
              aria-label={`Αύξηση για ${EYE_LABEL[eye]}`}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full hover:bg-black/5"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
