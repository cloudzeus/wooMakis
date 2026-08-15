/**
 * Storefront design tokens.
 *
 * Kept separate from the admin's Steel & Frost variables: the two products have
 * different jobs and deliberately different identities.
 *
 * The single most important rule here is SURFACE_PRODUCT. Every product photo
 * from mylens.gr is a packshot on a white background, so any tinted tile behind
 * one turns it into a visible white rectangle floating on grey. Product imagery
 * sits on pure white, always.
 */

export const INK = '#0B0F10'          // page canvas, near-black
export const PANEL = '#161B1D'        // raised dark surface
export const PANEL_HI = '#1E2427'     // hover / nested dark surface
export const CREAM = '#F5F2ED'        // editorial light card
export const SURFACE = '#FFFFFF'      // product card
export const SURFACE_PRODUCT = '#FFFFFF' // behind packshots — never tinted
export const TEAL = '#00CFC9'         // brand accent, from the wordmark
export const TEAL_DEEP = '#00A8A3'    // accent for text on light (contrast)
export const INK_MUTED = '#6B7477'    // secondary text on light
export const HAIRLINE = 'rgb(11 15 16 / 10%)'
export const HAIRLINE_DARK = 'rgb(255 255 255 / 9%)'

/** Corner radii — the reference sits around 22–26px. */
export const R_CARD = '24px'
export const R_INNER = '16px'
export const R_PILL = '999px'
