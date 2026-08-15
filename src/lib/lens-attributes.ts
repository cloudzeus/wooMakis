/**
 * Which product attributes the customer chooses, and which are fixed facts.
 *
 * Important: WooCommerce on mylens.gr models lens power as a plain attribute
 * with `variation: false`, not as a product variation. 110 products carry a
 * Βαθμός attribute this way but only 19 products have real variations. So there
 * is no variation id to select; the choice is carried to the order as line-item
 * meta instead. That also means power does not change price and has no
 * per-power stock.
 */

/** Attributes prescribed per eye. Matched loosely because Woo names carry a prefix. */
const PER_EYE = [
  'βαθμός',      // sphere / power
  'κύλινδρος',   // cylinder, for toric lenses
  'άξονας',      // axis, for toric lenses
  'addition',    // for multifocal
  'χρώμα',       // colour, for cosmetic lenses
]

/** Attributes that describe the product, identical for both eyes. */
const FIXED = ['καμπυλότητα', 'διάμετρος', 'διάρκεια', 'τύπος', 'υλικό', 'διαπερατότητα']

export type ProductAttribute = { name: string; options: string[] }

export type AttributeSplit = {
  /** Choosable per eye, more than one option. */
  perEye: ProductAttribute[]
  /** Shown as specification only. */
  fixed: ProductAttribute[]
}

function normalise(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function matches(name: string, list: string[]): boolean {
  const n = normalise(name)
  return list.some(k => n.includes(normalise(k)))
}

/**
 * Splits a product's attributes into what the customer picks and what is simply
 * true of the product.
 *
 * A per-eye attribute with a single option is NOT a choice, so it moves to the
 * fixed list. That is what stops "Καμπυλότητα: 8.60" being rendered as a
 * dropdown with one entry.
 */
export function splitAttributes(attributes: ProductAttribute[]): AttributeSplit {
  const perEye: ProductAttribute[] = []
  const fixed: ProductAttribute[] = []

  for (const a of attributes) {
    if (!a.options?.length) continue
    if (matches(a.name, PER_EYE) && a.options.length > 1) perEye.push(a)
    else if (matches(a.name, FIXED) || a.options.length === 1) fixed.push(a)
    else if (a.options.length > 1) perEye.push(a)
    else fixed.push(a)
  }

  return { perEye, fixed }
}

/** True when this product needs a left/right choice rather than a single one. */
export function needsPerEye(attributes: ProductAttribute[]): boolean {
  return splitAttributes(attributes).perEye.length > 0
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

/**
 * Deterministic identity for a cart line: same product, same eye, same choices
 * collapses onto one row; a different power stays separate.
 *
 * Keys are sorted so that {a,b} and {b,a} produce the same string.
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
