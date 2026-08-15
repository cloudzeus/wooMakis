/**
 * Storefront design tokens — "Mylens Redesign v3".
 *
 * Transcribed from the design project rather than reinvented, so the values
 * here are the source of truth and every component reads them instead of
 * repeating hex codes inline. The previous palette (teal #00CFC9 on a warm
 * canvas) is gone; this one is a deep green-black ink over white, with a
 * teal-blue primary and a red reserved for offers.
 *
 * Two rules carried over from the old system because they were learned the
 * hard way and still apply:
 *
 * 1. SURFACE_PRODUCT is pure white and never tinted. Every packshot from
 *    mylens.gr is cut out on white, so a tinted tile draws a visible rectangle
 *    around the bottle.
 * 2. Accent colours are checked for contrast before being used on text.
 *    PRIMARY (#0E7C9C) is 4.8:1 on white and safe for body text; ACCENT
 *    (#7DD5E8) is 1.8:1 and is a fill or a highlight on dark ONLY.
 */

// ── Ground ────────────────────────────────────────────────
export const SURFACE = '#FFFFFF'          // page and card ground
export const SURFACE_PRODUCT = '#FFFFFF'  // behind packshots — never tinted
export const CANVAS = '#F7F6F2'           // recessed band (products, footer)
export const CREAM = '#F1EEE6'            // nav hover, subtle fill
export const TINT = '#F1F7F9'             // cool tint behind product circles
export const TRACK = '#EEEBE3'            // progress track, inner hairline

// ── Ink ───────────────────────────────────────────────────
export const INK = '#101B14'              // primary text, dark sections
export const INK_MUTED = '#4C554E'        // secondary — 8.2:1 on white
export const INK_FAINT = '#8A948C'        // tertiary, non-essential only
export const INK_ON_DARK = '#D9E2DC'      // body text on INK
export const INK_ON_DARK_FAINT = '#B9C7BF'

// ── Accents ───────────────────────────────────────────────
export const PRIMARY = '#0E7C9C'          // links, primary button, kickers
export const PRIMARY_DEEP = '#0A5E77'     // hover
export const PRIMARY_ON = '#D6EEF5'       // text on a PRIMARY fill
export const ACCENT = '#7DD5E8'           // highlight — FILL or on-dark only
export const ACCENT_PALE = '#BDE7F2'      // eyebrow labels on dark

export const SALE = '#C83634'             // offers, urgency, savings
export const SALE_PALE = '#FCEBEA'        // sale pill background
export const SUCCESS = '#1E7A3C'          // "you save", verified purchase
export const STAR = '#E0A93E'             // rating stars

// ── Lines ─────────────────────────────────────────────────
export const HAIRLINE = '#E7E4DC'
export const HAIRLINE_SOFT = '#D9D5CB'
export const HAIRLINE_ON_DARK = 'rgb(255 255 255 / 22%)'

// ── Radius ────────────────────────────────────────────────
/** One system: panels 24, cards 20, inner 14, interactive fully pilled. */
export const R_PANEL = '24px'
export const R_CARD = '20px'
export const R_INNER = '14px'
export const R_PILL = '99px'

/** Page gutter and maximum measure, shared by every section. */
export const MAX_W = '1400px'
export const GUTTER = '28px'
