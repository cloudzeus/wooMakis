/**
 * Reads the prescription out of a WooCommerce order line.
 *
 * mylens.gr collects the prescription with the "Extra Product Options"
 * plugin (ThemeComplete, prefix `tmcartepo`), not with WooCommerce variations
 * or plain line-item meta. The plugin writes everything into a single meta
 * entry keyed `_tmcartepo_data`, holding a JSON array of one object per field.
 *
 * That leading underscore is the trap. WooCommerce convention is that
 * `_`-prefixed meta is internal and should not be displayed, so a reader that
 * filters it out — which is the correct default — silently drops the entire
 * prescription. On this store 2087 of 2088 order lines looked empty for
 * exactly that reason.
 *
 * Entry shape, verified against live orders:
 *
 *   {
 *     name: "Βαθμός", value: "-4.50",
 *     cssclass: "deximat",              // which eye's section
 *     hidevalueinorder: "" | "hidden",  // the plugin's own display rule
 *     …presentation fields
 *   }
 */

import { EYE_SHORT } from '@/lib/lens-attributes'

const EPO_KEY = '_tmcartepo_data'

/**
 * Section CSS classes from the live form configuration. The section *label* is
 * "Μάτι" on both sides, so it cannot tell the eyes apart; the class can.
 */
const EYE_BY_CLASS: Record<string, 'RIGHT' | 'LEFT'> = {
  deximat: 'RIGHT',
  aristeromat: 'LEFT',
}

type EpoEntry = {
  name?: unknown
  value?: unknown
  cssclass?: unknown
  hidevalueinorder?: unknown
  hidelabelinorder?: unknown
}

type MetaEntry = { key?: string; value?: unknown }

function entries(meta: MetaEntry[] | undefined): EpoEntry[] {
  const raw = meta?.find(m => m.key === EPO_KEY)?.value
  if (!raw) return []
  try {
    // Woo returns it already parsed on some endpoints and as a JSON string on
    // others, depending on how the value round-trips through the REST layer.
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? (parsed as EpoEntry[]) : []
  } catch {
    return []
  }
}

/**
 * Returns the prescription keyed for display, e.g.
 * `{"Βαθμός OD": "-4.50", "Καμπυλότητα OD": "8.40"}`.
 *
 * Keys match what this application's own storefront writes for new orders, so
 * an order placed here and one placed on the old site read identically.
 *
 * Fields the plugin itself marks as hidden on the order are skipped: that is
 * the section checkbox and the per-eye quantity, which duplicate information
 * already on the line.
 */
export function parseEpoPrescription(
  meta: MetaEntry[] | undefined,
): Record<string, string> | undefined {
  const out: Record<string, string> = {}

  // The eye is announced once, by the section's own entry, and then applies to
  // every field that follows it. The individual fields carry their own class
  // (`pa_det_cylinder` and friends), so reading cssclass per field finds the
  // attribute slug and never the eye — which is how the first attempt at this
  // produced 1736 prescriptions with not one eye marked.
  let eye: 'RIGHT' | 'LEFT' | undefined

  for (const e of entries(meta)) {
    const marker = EYE_BY_CLASS[String(e.cssclass ?? '')]
    if (marker) eye = marker

    const name = String(e.name ?? '').trim()
    const value = String(e.value ?? '').trim()
    if (!name || !value) continue

    // The plugin's own display rules. Hidden here means the section checkbox
    // and the per-eye quantity, which duplicate what the line already says.
    if (e.hidevalueinorder === 'hidden') continue

    const key = eye ? `${name} ${EYE_SHORT[eye]}` : name

    // A field repeated within one eye's section would be a configuration
    // error upstream; keep the first and do not silently overwrite.
    if (!(key in out)) out[key] = value
  }

  return Object.keys(out).length ? out : undefined
}

/** True when the line carries an Extra Product Options payload at all. */
export function hasEpoData(meta: MetaEntry[] | undefined): boolean {
  return !!meta?.some(m => m.key === EPO_KEY)
}
