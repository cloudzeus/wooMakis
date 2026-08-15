import { prisma } from '@/lib/prisma'
import { pickTranslation, type Locale } from '@/lib/i18n'

/**
 * The home page's composition, read from the database.
 *
 * The seven bands of the v3 design are fixed in kind — a HERO is a HERO — but
 * their order, whether they appear at all, their copy, their images and how
 * many items they list are all editable. That is the useful half of a page
 * builder without the cost of one: no drag-and-drop canvas, no arbitrary
 * nesting, and no way to produce a layout the design never covered.
 *
 * Defaults live here rather than in the seed, so a section that has never been
 * edited still renders correct copy and the page cannot go blank because a row
 * is missing.
 */

export const SECTION_KINDS = [
  'HERO', 'TRUST', 'CATEGORIES', 'PRODUCTS', 'PANELS', 'BRANDS', 'NEWSLETTER',
] as const

export type SectionKind = (typeof SECTION_KINDS)[number]

/** What each band is, for the admin list. Kept out of the storefront copy. */
export const SECTION_LABELS: Record<SectionKind, { el: string; help: string }> = {
  HERO: { el: 'Κεντρική εικόνα', help: 'Η μεγάλη εικόνα με τον τίτλο και τα δύο κουμπιά.' },
  TRUST: { el: 'Λωρίδα εμπιστοσύνης', help: 'Οι τέσσερις αριθμοί κάτω από το hero.' },
  CATEGORIES: { el: 'Κατηγορίες', help: 'Οι στρογγυλές κάρτες κατηγοριών.' },
  PRODUCTS: { el: 'Δημοφιλή προϊόντα', help: 'Το πλέγμα προϊόντων με τα φίλτρα.' },
  PANELS: { el: 'Banners', help: 'Τα δύο μεγάλα banners με φωτογραφία.' },
  BRANDS: { el: 'Μάρκες', help: 'Η κυλιόμενη λωρίδα με τα ονόματα των μαρκών.' },
  NEWSLETTER: { el: 'Πρόσκληση εγγραφής', help: 'Το σκούρο πλαίσιο πριν το footer.' },
}

export type SectionCopy = {
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
  ctaLabelB: string
  ctaHrefB: string
}

const EMPTY: SectionCopy = {
  eyebrow: '', title: '', body: '', ctaLabel: '', ctaHref: '', ctaLabelB: '', ctaHrefB: '',
}

/** Shipped copy, used whenever a field has not been overridden in the admin. */
export const DEFAULT_COPY: Record<SectionKind, Record<Locale, SectionCopy>> = {
  HERO: {
    el: {
      ...EMPTY,
      title: 'Δες τη διαφορά καθαρά.',
      body: 'Φακοί επαφής, υγρά φροντίδας και γυαλιά ηλίου από επίσημους διανομείς. Γνήσια προϊόντα, αποστολή σε 1-3 ημέρες.',
      ctaLabel: 'Ψώνισε τώρα', ctaHref: '/proionta',
      ctaLabelB: 'Δες τις κατηγορίες', ctaHrefB: '#katigories',
    },
    en: {
      ...EMPTY,
      title: 'See the difference clearly.',
      body: 'Contact lenses, care solutions and sunglasses from official distributors. Genuine products, delivered in 1-3 days.',
      ctaLabel: 'Shop now', ctaHref: '/proionta',
      ctaLabelB: 'Browse categories', ctaHrefB: '#katigories',
    },
  },
  TRUST: { el: EMPTY, en: EMPTY },
  CATEGORIES: {
    el: { ...EMPTY, title: 'Κατηγορίες', ctaLabel: 'Δες τα όλα', ctaHref: '/proionta' },
    en: { ...EMPTY, title: 'Categories', ctaLabel: 'View all', ctaHref: '/proionta' },
  },
  PRODUCTS: {
    el: { ...EMPTY, title: 'Δημοφιλή προϊόντα' },
    en: { ...EMPTY, title: 'Popular products' },
  },
  PANELS: {
    el: {
      ...EMPTY,
      eyebrow: 'ΚΑΘΑΡΗ ΟΡΑΣΗ, ΚΑΘΕ ΜΕΡΑ',
      title: 'Ό,τι φοράς στα μάτια σου αξίζει προσοχή',
      ctaLabel: 'Δες τα προϊόντα', ctaHref: '/proionta',
      body: 'ΡΩΤΗΣΕ ΜΑΣ|Δεν ξέρεις ποιο υγρό ταιριάζει στους φακούς σου;',
      ctaLabelB: 'Συχνές ερωτήσεις', ctaHrefB: '/syxnes-erotiseis',
    },
    en: {
      ...EMPTY,
      eyebrow: 'CLEAR VISION, EVERY DAY',
      title: 'Whatever you wear on your eyes deserves care',
      ctaLabel: 'Browse products', ctaHref: '/proionta',
      body: 'ASK US|Not sure which solution suits your lenses?',
      ctaLabelB: 'Read the FAQ', ctaHrefB: '/syxnes-erotiseis',
    },
  },
  BRANDS: { el: EMPTY, en: EMPTY },
  NEWSLETTER: {
    el: {
      ...EMPTY,
      eyebrow: 'ΕΝΗΜΕΡΩΣΗ',
      title: 'Υπενθυμίσεις αντικατάστασης φακών',
      body: 'Σου θυμίζουμε πότε τελειώνουν οι φακοί σου και σου στέλνουμε νέες παραλαβές. Χωρίς spam.',
      ctaLabel: 'Δημιούργησε λογαριασμό', ctaHref: '/sindesi',
    },
    en: {
      ...EMPTY,
      eyebrow: 'STAY IN TOUCH',
      title: 'Lens replacement reminders',
      body: 'We remind you when your lenses run out and tell you about new arrivals. No spam.',
      ctaLabel: 'Create an account', ctaHref: '/sindesi',
    },
  },
}

/** Default order and image slots, applied when a row has never been created. */
const DEFAULTS: Record<SectionKind, { order: number; slot?: string; slotB?: string; limit: number }> = {
  HERO: { order: 0, slot: 'hero-visual', limit: 0 },
  TRUST: { order: 1, limit: 4 },
  CATEGORIES: { order: 2, limit: 6 },
  PRODUCTS: { order: 3, limit: 12 },
  PANELS: { order: 4, slot: 'editorial-hero', slotB: 'trust-visual', limit: 0 },
  BRANDS: { order: 5, limit: 12 },
  NEWSLETTER: { order: 6, limit: 0 },
}

export type ResolvedSection = {
  kind: SectionKind
  enabled: boolean
  menuOrder: number
  imageSlot: string | null
  imageSlotB: string | null
  itemLimit: number
  copy: SectionCopy
}

/**
 * A stored value wins; a blank one falls back so nothing renders empty.
 *
 * Prisma returns nullable columns as `null`, not `undefined`, so the input is
 * typed loosely and normalised here rather than at every call site.
 */
type StoredCopy = Partial<Record<keyof SectionCopy, string | null>>

function merge(stored: StoredCopy | undefined, fallback: SectionCopy): SectionCopy {
  const pick = (k: keyof SectionCopy) => {
    const value = stored?.[k]?.trim()
    return value ? value : fallback[k]
  }
  return {
    eyebrow: pick('eyebrow'), title: pick('title'), body: pick('body'),
    ctaLabel: pick('ctaLabel'), ctaHref: pick('ctaHref'),
    ctaLabelB: pick('ctaLabelB'), ctaHrefB: pick('ctaHrefB'),
  }
}

export async function getHomeSections(locale: Locale): Promise<ResolvedSection[]> {
  const rows = await prisma.homeSection.findMany({ include: { translations: true } })
  const byKind = new Map(rows.map(r => [r.kind as SectionKind, r]))

  return SECTION_KINDS
    .map(kind => {
      const row = byKind.get(kind)
      const d = DEFAULTS[kind]
      const stored = row ? pickTranslation(row.translations, locale) : undefined
      return {
        kind,
        enabled: row?.enabled ?? true,
        menuOrder: row?.menuOrder ?? d.order,
        imageSlot: row?.imageSlot ?? d.slot ?? null,
        imageSlotB: row?.imageSlotB ?? d.slotB ?? null,
        itemLimit: row?.itemLimit ?? d.limit,
        copy: merge(stored ?? undefined, DEFAULT_COPY[kind][locale]),
      }
    })
    .filter(s => s.enabled)
    .sort((a, b) => a.menuOrder - b.menuOrder)
}

/** Every section including the disabled ones, for the admin screen. */
export async function getAllHomeSections(locale: Locale): Promise<ResolvedSection[]> {
  const rows = await prisma.homeSection.findMany({ include: { translations: true } })
  const byKind = new Map(rows.map(r => [r.kind as SectionKind, r]))

  return SECTION_KINDS
    .map(kind => {
      const row = byKind.get(kind)
      const d = DEFAULTS[kind]
      const stored = row?.translations.find(t => t.locale === locale)
      return {
        kind,
        enabled: row?.enabled ?? true,
        menuOrder: row?.menuOrder ?? d.order,
        imageSlot: row?.imageSlot ?? d.slot ?? null,
        imageSlotB: row?.imageSlotB ?? d.slotB ?? null,
        itemLimit: row?.itemLimit ?? d.limit,
        // The admin shows what was actually stored, blanks included, so the
        // operator can tell an override from a default.
        copy: {
          eyebrow: stored?.eyebrow ?? '', title: stored?.title ?? '', body: stored?.body ?? '',
          ctaLabel: stored?.ctaLabel ?? '', ctaHref: stored?.ctaHref ?? '',
          ctaLabelB: stored?.ctaLabelB ?? '', ctaHrefB: stored?.ctaHrefB ?? '',
        },
      }
    })
    .sort((a, b) => a.menuOrder - b.menuOrder)
}

export function defaultCopyFor(kind: SectionKind, locale: Locale): SectionCopy {
  return DEFAULT_COPY[kind][locale]
}
