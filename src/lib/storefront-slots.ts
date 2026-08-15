/**
 * Named positions on the public storefront that an uploaded asset can fill.
 *
 * Deliberately a plain module with no 'use client': both the media library (a
 * client component) and the storefront overview (a server component) read it,
 * and a server component cannot import a value out of a client module.
 *
 * Adding a slot here is half the work; the page that renders it must look it up
 * by key, as src/app/page.tsx does for editorial-hero.
 */
export type StorefrontSlot = {
  key: string
  label: string
  /** What the position is for, shown in the admin. */
  hint: string
}

export const SLOTS: StorefrontSlot[] = [
  {
    key: 'editorial-hero',
    label: 'Εικόνα ενότητας «Καθαρή όραση»',
    hint: 'Μεγάλη φωτογραφία μάρκας, κάθετη ή τετράγωνη. Εμφανίζεται στη σκούρα ενότητα της αρχικής.',
  },
]
