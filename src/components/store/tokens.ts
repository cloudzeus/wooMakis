/**
 * Storefront design tokens — light.
 *
 * Kept separate from the admin's Steel & Frost variables: the two products have
 * different jobs and deliberately different identities.
 *
 * Two rules matter most here:
 *
 * 1. SURFACE_PRODUCT is pure white and never tinted. Every packshot from
 *    mylens.gr is already cut out on white, so any tinted tile behind one turns
 *    it into a visible white rectangle.
 *
 * 2. TEAL is a fill, not a text colour. #00CFC9 on white is ~1.9:1 and fails
 *    WCAG badly. Use TEAL_DEEP (#007D79, ~4.6:1) whenever teal carries text.
 */

export const CANVAS = '#F2F1ED'        // page ground, warm off-white
export const SURFACE = '#FFFFFF'       // cards
export const SURFACE_PRODUCT = '#FFFFFF' // behind packshots — never tinted
export const CREAM = '#E9E6DF'         // recessed light panel
export const INK = '#14181A'           // primary text
export const INK_MUTED = '#5F686B'     // secondary text — 5.4:1 on canvas
export const INK_FAINT = '#98A0A2'     // tertiary, non-essential only
export const TEAL = '#00CFC9'          // brand accent — FILLS ONLY
export const TEAL_DEEP = '#007D79'     // accent for TEXT on light — 4.6:1
export const HAIRLINE = 'rgb(20 24 26 / 12%)'
export const HAIRLINE_STRONG = 'rgb(20 24 26 / 22%)'

/** Corner radii — the reference sits around 22–26px. */
export const R_CARD = '24px'
export const R_INNER = '16px'
export const R_PILL = '999px'
