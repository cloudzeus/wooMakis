/**
 * Product attribute shape, exactly as WooCommerce returns and accepts it.
 *
 * Two kinds share this structure and they behave differently on write:
 *
 *  - **Global** attributes (`id > 0`) are taxonomy terms shared across the
 *    catalog, e.g. `pa_vathmos`. WooCommerce matches them by `id`, and every
 *    option must already exist as a term — inventing one here does not create
 *    it, the option is silently dropped.
 *  - **Local** attributes (`id = 0`) belong to the single product and are
 *    matched by `name`. Options are free text.
 *
 * mylens.gr uses local attributes for lens powers (109 products expose the
 * power as a plain attribute rather than variations), which is why the editor
 * allows editing option text at all.
 */
export type WooAttribute = {
  id: number
  name: string
  /** Present on reads, ignored on writes. */
  slug?: string
  position: number
  visible: boolean
  variation: boolean
  options: string[]
}

/** Loose shape as it comes out of the `attributes` JSON column. */
type RawAttribute = {
  id?: unknown
  name?: unknown
  slug?: unknown
  position?: unknown
  visible?: unknown
  variation?: unknown
  options?: unknown
}

/**
 * Coerces stored or submitted attributes into the canonical shape.
 *
 * Positions are renumbered from the array order rather than trusted, so a
 * drag-reorder in the editor is authoritative and gaps left by a deleted
 * attribute never reach WooCommerce.
 */
export function normalizeAttributes(input: unknown): WooAttribute[] {
  if (!Array.isArray(input)) return []

  return input
    .map((raw: RawAttribute) => ({
      id: Number(raw?.id ?? 0) || 0,
      name: String(raw?.name ?? '').trim(),
      position: 0,
      visible: raw?.visible !== false,
      variation: raw?.variation === true,
      options: Array.isArray(raw?.options)
        ? raw.options.map(o => String(o).trim()).filter(Boolean)
        : [],
    }))
    .filter(a => a.name.length > 0)
    .map((a, i) => ({ ...a, position: i }))
}

/**
 * The payload form. `slug` is dropped because WooCommerce derives it, and
 * sending a stale one on a global attribute is how a rename silently fails.
 */
export function toWooPayload(attributes: WooAttribute[]): Omit<WooAttribute, 'slug'>[] {
  return attributes.map(({ id, name, position, visible, variation, options }) => ({
    id, name, position, visible, variation, options,
  }))
}

/** True when the attribute is a shared taxonomy term rather than product-local. */
export function isGlobal(attribute: WooAttribute): boolean {
  return attribute.id > 0
}
