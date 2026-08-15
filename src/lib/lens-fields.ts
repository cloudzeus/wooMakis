/**
 * The per-eye field set mylens.gr actually collects, transcribed from the live
 * "Extra Product Options" configuration export.
 *
 * That plugin — not WooCommerce variations — is what asks the customer for a
 * prescription on the current site. Its config is the authority on three things
 * the mirrored product attributes do not tell us:
 *
 *  1. **Order.** The live form asks Βαθμός → Καμπυλότητα → Κύλινδρος →
 *     Διάμετρος → Άξονας → Addition → Χρώμα → Υπερέχων. Matching it means an
 *     optician reading a new order sees the same sequence as on an old one.
 *  2. **The taxonomy slug** behind each label (`pa_det_power` and friends),
 *     which is how the values are keyed in the existing order history.
 *  3. **The full option list**, which is a superset of what any single product
 *     exposes — power runs −23.00 to +23.00 across the catalog even though a
 *     given lens lists a narrow band.
 *
 * Every option in the export carries price 0, confirming what the catalog pull
 * already implied: a prescription choice never changes what the customer pays.
 *
 * One deliberate divergence: the live form's conditional logic lets a customer
 * order a single eye, with a hidden per-eye quantity. This application sells a
 * pair as one line with two dimensions, as specified. That is a product
 * decision, not an oversight — noted here so the difference is not mistaken
 * for a transcription error.
 */

export type LensField = {
  /** WooCommerce taxonomy slug used on the live site. */
  slug: string
  /** Greek label as the customer sees it. */
  label: string
  /** Every value offered anywhere in the catalog. */
  options: string[]
}

export const LENS_FIELDS: LensField[] = [
  {
    slug: 'pa_det_power',
    label: 'Βαθμός',
    options: [
      '0',
      ...range(-23, -10.5, 0.5).map(fmt2),
      ...range(-10, -0.25, 0.25).map(fmt2),
      ...range(0.25, 10, 0.25).map(plus2),
      ...range(10.5, 14, 0.5).map(plus2),
      ...range(15, 23, 0.5).map(plus2),
    ],
  },
  {
    slug: 'pa_det_kabylotita',
    label: 'Καμπυλότητα',
    // The parenthesised entries are how the site marks a curve that is stocked
    // only for minus, or for both minus and plus, powers.
    options: [
      '8.00', '8.30', '8.30 (-)', '8.40', '8.50', '8.60', '8.60 (-/+)',
      '8.70', '8.80', '8.90', '8.90 (-)', '9.00', '9.20', '9.50', '9.80',
    ],
  },
  {
    slug: 'pa_det_cylinder',
    label: 'Κύλινδρος',
    options: [
      ...range(-0.75, -6, 0.25).map(fmt2),
      '-6.50', '-7.00', '-7.50', '-8.00', '1.75',
    ],
  },
  {
    slug: 'pa_det_diametros',
    label: 'Διάμετρος',
    options: ['13.8', '14', '14.1', '14.2', '14.3', '14.4', '14.5'],
  },
  {
    slug: 'pa_det_axis',
    label: 'Άξονας',
    options: range(0, 180, 5).map(n => String(n)),
  },
  {
    slug: 'pa_det_addition',
    label: 'Addition',
    options: [
      '+1.00', '1.00 to +1.50 Low', '1.00 to +2.25 Low', '+1.50', '+1.50 Low',
      '1.75 to +2.50 High', '+2.00', '+2.00 Mid', '+2.50', '+2.50 High',
      '2.50 to +3.00 High', '+3.00', '+3.50', '+4.00', 'High', 'Low', '-', 'Med',
    ],
  },
  {
    slug: 'pa_det_color',
    label: 'Χρώμα',
    options: [
      'Acqua', 'Amazon', 'Amber', 'Amethyst', 'Aquamarine', 'Bang White', 'Blue',
      'Brilliant Blue', 'Brown', 'Caramel Brown', 'Cat Eye', 'Cat Eye Yellow',
      'Choco', 'Creamy Beige', 'Dark Green', 'Darker', 'Desert Dream', 'Emerald',
      'Flower Yellow', 'Forest Green', 'Full Black', 'Full Red', 'Full White',
      'Full Yellow', 'Gemstone Green', 'Green', 'Grey', 'Hazel', 'Hearts', 'Honey',
      'Icy Blue', 'India', 'Indigo', 'Innocent White', 'Jade', 'Light Blue',
      'Light Green', 'Lighter', 'Mint Touch', 'Misty Grey', 'Ocean', 'Pacific',
      'Pearl', 'Platinum', 'Pumpkin', 'Pure Hazel', 'Sapphire Blue', 'Solid Black',
      'Solid Red', 'Solid White', 'Spice', 'Sterling Grey', 'Sun', 'Topaz',
      'True Sapphire', 'Turquise', 'Turquoise', 'Vampire Queen', 'Violet',
      'Yellow', 'Yellow Twilight',
    ],
  },
  {
    slug: 'pa_det_dominant',
    label: 'Υπερέχων',
    options: ['D', 'N'],
  },
]

/** Inclusive numeric range that tolerates a descending start/end. */
function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  const dir = to >= from ? 1 : -1
  // Integer counter, because repeated float addition drifts at 0.25 steps.
  const count = Math.round(Math.abs(to - from) / step)
  for (let i = 0; i <= count; i++) out.push(from + dir * i * step)
  return out
}

function fmt2(n: number): string {
  return n.toFixed(2)
}

function plus2(n: number): string {
  return `+${n.toFixed(2)}`
}

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const BY_LABEL = new Map(LENS_FIELDS.map(f => [normalise(f.label), f]))

/**
 * Resolves a mirrored attribute name ("Ιδιότητα - Καμπυλότητα") to its live
 * field definition. Returns undefined for anything that is not a prescription
 * field — hat size, frame colour, lens material.
 */
export function lensFieldFor(attributeName: string): LensField | undefined {
  const n = normalise(attributeName.replace(/^Ιδιότητα\s*[-–]\s*/, '').trim())
  const exact = BY_LABEL.get(n)
  if (exact) return exact
  return LENS_FIELDS.find(f => n.includes(normalise(f.label)))
}

/** Display order on the live site; unknown fields sort after the known ones. */
export function lensFieldOrder(attributeName: string): number {
  const field = lensFieldFor(attributeName)
  return field ? LENS_FIELDS.indexOf(field) : LENS_FIELDS.length
}

/**
 * Sorts prescription pairs into the clinical order used everywhere else —
 * Βαθμός, Καμπυλότητα, Κύλινδρος, Διάμετρος, Άξονας — with the right eye
 * before the left.
 *
 * Order meta arrives as a plain object, and object key order is whatever the
 * plugin happened to write, so without this an order reads in a different
 * sequence from the form that produced it.
 */
export function sortPrescription(meta: Record<string, string>): [string, string][] {
  const rank = (key: string) => {
    const eye = key.endsWith(' OS') ? 1 : 0
    const bare = key.replace(/\s+(OD|OS)$/, '')
    return eye * 100 + lensFieldOrder(bare)
  }
  return Object.entries(meta).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'el'))
}
