/**
 * Storefront design tokens.
 *
 * Light is the locked page theme (Section 4.11). One deliberate dark band is
 * permitted as a Color Block Story device and is used exactly once, on the
 * editorial section - not as random alternation.
 *
 * Two rules that must not drift:
 *
 * 1. SURFACE_PRODUCT is pure white and never tinted. Every packshot from
 *    mylens.gr is already cut out on white, so a tinted tile behind one draws a
 *    visible rectangle.
 *
 * 2. TEAL is a fill, never a text colour. #00CFC9 on white is ~1.9:1 and fails
 *    WCAG. Text that must read as teal uses TEAL_DEEP (~4.6:1).
 */

export const CANVAS = '#F2F1ED'          // page ground, warm off-white
export const SURFACE = '#FFFFFF'         // cards
export const SURFACE_PRODUCT = '#FFFFFF' // behind packshots - never tinted
export const CREAM = '#E9E6DF'           // recessed light panel
export const INK = '#14181A'             // primary text (off-black, not #000)
export const INK_MUTED = '#5F686B'       // secondary - 5.4:1 on canvas
export const INK_FAINT = '#98A0A2'       // tertiary, non-essential only
export const TEAL = '#00CFC9'            // brand accent - FILLS ONLY
export const TEAL_DEEP = '#007D79'       // accent for TEXT on light - 4.6:1
export const HAIRLINE = 'rgb(20 24 26 / 12%)'
export const HAIRLINE_STRONG = 'rgb(20 24 26 / 22%)'

/** The single dark band. Used once, deliberately. */
export const DARK = '#14181A'
export const DARK_SURFACE = '#1D2325'
export const ON_DARK = '#F2F1ED'
export const ON_DARK_MUTED = 'rgb(242 241 237 / 62%)'
export const HAIRLINE_ON_DARK = 'rgb(242 241 237 / 14%)'

/** One radius system: cards 24, inner 16, interactive fully pilled. */
export const R_CARD = '24px'
export const R_INNER = '16px'
export const R_PILL = '999px'
