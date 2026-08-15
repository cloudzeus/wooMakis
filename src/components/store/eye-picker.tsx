'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { addLinesToCart } from '@/app/(store)/kalathi/actions'
import { CheckCircle, ICON_SM, Minus, Plus, WarningCircle } from './icons'
import { EYE_SHORT, attrLabel, defaultSelections, eyeAttrKey, splitAttributes } from '@/lib/lens-attributes'
import {
  CREAM, HAIRLINE, INK, INK_FAINT, INK_MUTED, PRIMARY, SURFACE,
} from './tokens'
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
  const { perEye, choices, fixed } = useMemo(
    () => splitAttributes(product.attributes),
    [product.attributes],
  )

  // Attributes offering a single value are chosen for the customer rather than
  // hidden: base curve and diameter are fixed on most lenses but still belong
  // on the order, and asking someone to pick from a list of one is noise.
  const defaults = useMemo(() => defaultSelections(product.attributes), [product.attributes])

  const [right, setRight] = useState<Record<string, string>>(defaults)
  const [left, setLeft] = useState<Record<string, string>>(defaults)
  /** Single selections for the whole product, e.g. hat size. */
  const [picked, setPicked] = useState<Record<string, string>>(defaults)
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

  // Naming the first thing still missing, rather than saying "διάλεξε βαθμό",
  // which stopped being true once every attribute became selectable.
  const missing =
    perEye.find(a => !right[a.name] || !left[a.name])
    ?? choices.find(a => !picked[a.name])
  const complete = !missing
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
        <PrescriptionGrid
          attrs={perEye}
          right={right}
          left={left}
          mirror={mirror}
          disabled={out}
          onMirror={next => { setMirror(next); if (next) setLeft(right) }}
          onRight={updateRight}
          onLeft={(attr, v) => setLeft(p => ({ ...p, [attr]: v }))}
        />
      )}

      {/* Single selections for the whole product, e.g. hat size. */}
      {choices.map(a => {
        const only = a.options.length === 1
        return (
          <label key={a.name} className="block">
            <span className="mb-1.5 flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-[0.13em]" style={{ color: INK_MUTED }}>
              {attrLabel(a.name)}
              {only && <span className="font-medium normal-case tracking-normal" style={{ color: INK_FAINT }}>σταθερό</span>}
            </span>
            <select
              value={picked[a.name] ?? ''}
              disabled={out || only}
              onChange={e => setPicked(p => ({ ...p, [a.name]: e.target.value }))}
              className="h-12 w-full cursor-pointer rounded-full border px-5 text-[14px] outline-none disabled:cursor-default disabled:opacity-100"
              style={{
                borderColor: !only && picked[a.name] ? PRIMARY : HAIRLINE,
                background: only ? CREAM : SURFACE,
                color: INK,
              }}
            >
              {!only && <option value="">Επίλεξε {attrLabel(a.name).toLowerCase()}…</option>}
              {a.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        )
      })}

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
              : missing
                ? `Διάλεξε ${attrLabel(missing.name).toLowerCase()}`
                : 'Προσθήκη στο καλάθι'}
        </button>
      </div>
    </div>
  )
}


/**
 * The prescription, laid out the way one is written: one row per measurement,
 * one column per eye.
 *
 * The previous side-by-side cards misaligned as soon as the two eyes differed
 * in height — a hint line under one heading pushed every field in that column
 * down by a row, so "Βαθμός" on the right sat next to "Καμπυλότητα" on the
 * left. Reading a prescription off that is guesswork. A single grid makes the
 * rows share a track, so a label can only ever line up with its own values.
 *
 * Measurements that offer one value are shown once, spanning both eyes, rather
 * than as two identical disabled selects.
 */
function PrescriptionGrid({
  attrs, right, left, mirror, disabled, onMirror, onRight, onLeft,
}: {
  attrs: { name: string; options: string[] }[]
  right: Record<string, string>
  left: Record<string, string>
  mirror: boolean
  disabled?: boolean
  onMirror: (next: boolean) => void
  onRight: (attr: string, value: string) => void
  onLeft: (attr: string, value: string) => void
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: INK_MUTED }}>
          Η συνταγή σου
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px]" style={{ color: INK_MUTED }}>
          <input type="checkbox" checked={mirror} onChange={e => onMirror(e.target.checked)} />
          Ίδια τιμή και στα δύο μάτια
        </label>
      </div>

      <div className="grid items-center gap-x-3 gap-y-2.5 grid-cols-[1fr_1fr] sm:grid-cols-[minmax(7.5rem,auto)_1fr_1fr]">
        {/* Column heads. On mobile the label sits on its own row above, so the
            first grid cell is skipped there. */}
        <span className="hidden sm:block" aria-hidden />
        {/* No "follows the right eye" note here: it would make this row taller
            than the ones below it and the checkbox above already says so. */}
        <EyeHead label="Δεξί" short="OD" />
        <EyeHead label="Αριστερό" short="OS" />

        {attrs.map(a => {
          const only = a.options.length === 1
          return (
            <Fragment key={a.name}>
              <span
                className="col-span-2 flex flex-wrap items-baseline gap-x-1.5 text-[11px] font-bold uppercase tracking-[0.1em] sm:col-span-1"
                style={{ color: INK_MUTED }}
              >
                {attrLabel(a.name)}
                {only && (
                  <span className="font-medium normal-case tracking-normal" style={{ color: INK_FAINT }}>
                    σταθερό
                  </span>
                )}
              </span>

              {only ? (
                <span
                  className="col-span-2 flex h-11 items-center rounded-full px-4 text-[14px] font-semibold tabular-nums"
                  style={{ background: CREAM, color: INK }}
                >
                  {a.options[0]}
                </span>
              ) : (
                <>
                  <EyeSelect
                    attr={a} value={right[a.name]} disabled={disabled} eye="δεξί"
                    onChange={v => onRight(a.name, v)}
                  />
                  <EyeSelect
                    attr={a} value={left[a.name]} disabled={disabled || mirror} eye="αριστερό"
                    onChange={v => onLeft(a.name, v)}
                  />
                </>
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

function EyeHead({ label, short }: { label: string; short: string }) {
  return (
    <span className="flex items-baseline gap-1.5 pb-0.5">
      <span className="text-[13px] font-bold" style={{ color: INK }}>{label}</span>
      <span className="text-[10.5px] font-bold" style={{ color: PRIMARY }}>{short}</span>
    </span>
  )
}

function EyeSelect({
  attr, value, disabled, eye, onChange,
}: {
  attr: { name: string; options: string[] }
  value: string | undefined
  disabled?: boolean
  eye: string
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      // The visible label sits in another grid cell and the attribute name
      // contains spaces, so it cannot serve as an id for aria-labelledby.
      aria-label={`${attrLabel(attr.name)}, ${eye} μάτι`}
      className="h-11 w-full cursor-pointer rounded-full border px-4 text-[14px] tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-70"
      style={{ borderColor: value ? PRIMARY : HAIRLINE, background: SURFACE, color: INK }}
    >
      <option value="">Επίλεξε…</option>
      {attr.options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
