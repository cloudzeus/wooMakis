/**
 * Sorts a product's attributes into what the customer chooses and how.
 *
 * Three outcomes, and getting them apart matters:
 *
 *   perEye   prescription values, chosen twice (once per eye) - power,
 *            cylinder, axis, addition, base curve, dominant eye
 *   choices  one selection for the whole product - hat size, frame colour
 *   fixed    a single option, so nothing to choose; shown as specification
 *
 * A product is treated as a lens only when it actually carries a prescription
 * attribute. Without that test a hat's "Μέγεθος Καπέλου" would render as a
 * left/right eye choice, which is how this was wrong first time round.
 *
 * Note on the data: mylens.gr models power as a plain attribute with
 * variation:false, not as a WooCommerce variation. 109 products expose power
 * this way while only 19 have real variations. So the choice cannot be sent as
 * a variation id; it travels to the order as line-item meta instead, which also
 * means power does not change price and has no per-power stock.
 */

import { lensFieldOrder } from '@/lib/lens-fields'

/** Prescription attributes: chosen separately for each eye. */
const PRESCRIPTION = [
  'βαθμός',            // sphere
  'κύλινδρος',         // cylinder, toric
  'άξονας',            // axis, toric
  'addition',          // multifocal
  'καμπυλότητα',       // base curve, BC
  'διάμετρος',         // diameter, DIA
  'υπερέχων',          // dominant eye
]

/**
 * Prescription values that identify the lens even when the product offers only
 * one of them.
 *
 * Base curve and diameter are what an optician reads back off a box, and an
 * order that omits them cannot be dispensed against a prescription. In this
 * catalog they are usually fixed per product — all 109 lenses list a single
 * diameter, and 90 of the 106 with a base curve list a single one — so if they
 * were treated like the other single-value attributes they would be shown on
 * the page and then dropped on the way to the order. They are carried onto the
 * line instead, chosen when there is a choice and attached automatically when
 * there is not.
 */
const CLINICAL = ['καμπυλότητα', 'διάμετρος']

/** Descriptive only, never a choice and never on an order line. */
const SPEC_ONLY = ['διάρκεια', 'τύπος', 'υλικό', 'διαπερατότητα', 'παράδοση', 'περιεκτικότητα']

export type ProductAttribute = { name: string; options: string[] }

export type AttributeSplit = {
  perEye: ProductAttribute[]
  choices: ProductAttribute[]
  /**
   * Single-valued clinical specs. Nothing to choose, but they must appear on
   * the cart line and therefore in the WooCommerce order.
   */
  clinical: ProductAttribute[]
  /** Descriptive. Shown on the page, never recorded on the order. */
  fixed: ProductAttribute[]
}

function normalise(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function matches(name: string, list: string[]): boolean {
  const n = normalise(name)
  return list.some(k => n.includes(normalise(k)))
}

export function splitAttributes(attributes: ProductAttribute[]): AttributeSplit {
  const usable = attributes.filter(a => a.options?.length)

  // Only a product carrying a real prescription attribute is a lens. Base curve
  // and diameter alone do not qualify: they are single-valued on almost every
  // product, so treating them as the test would classify nothing as a lens.
  const isLens = usable.some(
    a => matches(a.name, PRESCRIPTION) && !matches(a.name, CLINICAL) && a.options.length > 1,
  )

  const perEye: ProductAttribute[] = []
  const choices: ProductAttribute[] = []
  const clinical: ProductAttribute[] = []
  const fixed: ProductAttribute[] = []

  for (const a of usable) {
    if (matches(a.name, SPEC_ONLY)) { fixed.push(a); continue }

    const single = a.options.length === 1

    if (isLens && matches(a.name, CLINICAL)) {
      // Multi-valued base curve is a genuine per-eye choice (16 products);
      // single-valued is attached to the line without asking.
      if (single) clinical.push(a)
      else perEye.push(a)
      continue
    }

    if (single) { fixed.push(a); continue }
    if (isLens && matches(a.name, PRESCRIPTION)) perEye.push(a)
    else choices.push(a)
  }

  // Same sequence the live mylens.gr prescription form uses, so an order reads
  // the way the fulfilment team already expects it to.
  perEye.sort((a, b) => lensFieldOrder(a.name) - lensFieldOrder(b.name))
  clinical.sort((a, b) => lensFieldOrder(a.name) - lensFieldOrder(b.name))

  return { perEye, choices, clinical, fixed }
}

/**
 * The auto-attached clinical values for a line, keyed as they should read on
 * the order. Same value for both eyes, so no eye suffix.
 */
export function clinicalSelections(attributes: ProductAttribute[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const a of splitAttributes(attributes).clinical) {
    out[attrLabel(a.name)] = a.options[0]
  }
  return out
}

/** True when this product needs a left/right choice rather than a single one. */
export function needsPerEye(attributes: ProductAttribute[]): boolean {
  return splitAttributes(attributes).perEye.length > 0
}

/** True when the customer must pick something before this can be bought. */
export function needsSelection(attributes: ProductAttribute[]): boolean {
  const { perEye, choices } = splitAttributes(attributes)
  return perEye.length > 0 || choices.length > 0
}

export const EYE_LABEL: Record<'RIGHT' | 'LEFT' | 'BOTH', string> = {
  RIGHT: 'Δεξί μάτι',
  LEFT: 'Αριστερό μάτι',
  BOTH: '',
}

/** Optician shorthand, shown beside the Greek so a prescription reads across. */
export const EYE_SHORT: Record<'RIGHT' | 'LEFT' | 'BOTH', string> = {
  RIGHT: 'OD',
  LEFT: 'OS',
  BOTH: '',
}

/** Strips the "Ιδιότητα -" prefix WooCommerce puts on lens attributes. */
export function attrLabel(name: string): string {
  return name.replace(/^Ιδιότητα\s*[-–]\s*/, '').trim()
}

/**
 * Names a per-eye value inside a single line's selections.
 *
 * A pair is one product with two dimensions, so both eyes live in one line and
 * the key must say which eye it belongs to. This string reaches the WooCommerce
 * order as line-item meta, so it is written to be readable there.
 */
export function eyeAttrKey(attrName: string, eye: 'RIGHT' | 'LEFT'): string {
  return `${attrLabel(attrName)} ${EYE_SHORT[eye]}`
}

/**
 * Deterministic identity for a cart line: product plus the exact choices.
 * Keys are sorted so {a,b} and {b,a} do not produce two rows for one selection.
 */
export function buildLineKey(
  productId: string,
  eye: 'RIGHT' | 'LEFT' | 'BOTH',
  selections: Record<string, string>,
): string {
  const stable = Object.keys(selections)
    .sort()
    .map(k => `${k}=${selections[k]}`)
    .join('|')
  return `${productId}::${eye}::${stable}`
}
