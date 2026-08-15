import { prisma } from '@/lib/prisma'
import { isDeepSeekConfigured, translateTermFields } from '@/lib/deepseek'
import { isEmptyHtml, sanitizeHtml } from '@/lib/sanitize-html'
import {
  executeUpdate, planUpdate, readBack, readGate, verifyFields,
  type FieldVerdict, type WooResource, type WritePlan,
} from '@/lib/woo/write'

/**
 * Categories and brands are the same shape end to end: a translation group with
 * one WordPress term per language, a name, a slug and a description. Polylang
 * duplicates both identically, and the WooCommerce endpoints differ only in
 * their path. So the editing, translating and pushing logic lives here once and
 * is parameterised by kind, rather than existing twice with a drift risk.
 */
export type TermKind = 'category' | 'brand'

const RESOURCE: Record<TermKind, WooResource> = {
  category: 'products/categories',
  brand: 'products/brands',
}

export type TermTranslationInput = {
  locale: string
  name: string
  description: string
}

export type TermResult = { ok: true; message: string } | { ok: false; error: string }

export const LOCALES = ['el', 'en'] as const

async function loadTranslations(kind: TermKind, id: string) {
  return kind === 'category'
    ? prisma.categoryTranslation.findMany({ where: { categoryId: id }, orderBy: { locale: 'asc' } })
    : prisma.brandTranslation.findMany({ where: { brandId: id }, orderBy: { locale: 'asc' } })
}

/** Local-only save. WooCommerce is untouched. */
export async function saveTerm(
  kind: TermKind,
  id: string,
  translations: TermTranslationInput[],
): Promise<TermResult> {
  for (const t of translations) {
    if (!t.name.trim()) return { ok: false, error: `Το όνομα για «${t.locale}» δεν μπορεί να είναι κενό.` }
  }

  for (const t of translations) {
    // Server-side sanitising, for the same reason as products: the action is
    // the boundary, not the form.
    const description = sanitizeHtml(t.description)
    const data = {
      name: t.name.trim(),
      description: isEmptyHtml(description) ? null : description,
    }
    if (kind === 'category') {
      await prisma.categoryTranslation.updateMany({
        where: { categoryId: id, locale: t.locale }, data,
      })
    } else {
      await prisma.brandTranslation.updateMany({
        where: { brandId: id, locale: t.locale }, data,
      })
    }
  }

  return { ok: true, message: 'Αποθηκεύτηκε τοπικά. Δεν στάλθηκε στο WooCommerce.' }
}

/**
 * Translates into `toLocale` with DeepSeek and saves locally.
 *
 * Unlike products, a missing language is NOT created here: a category or brand
 * term that does not exist upstream would have no wooId, and the schema makes
 * wooId required on both translation tables. Filling that gap means creating
 * the term in WordPress first, which is a push, not a translation.
 */
export async function translateTerm(
  kind: TermKind,
  id: string,
  toLocale: string,
): Promise<TermResult> {
  if (!isDeepSeekConfigured()) {
    return { ok: false, error: 'Λείπει το DEEPSEEK_API_KEY στο .env — η μετάφραση είναι απενεργοποιημένη.' }
  }
  if (!LOCALES.includes(toLocale as (typeof LOCALES)[number])) {
    return { ok: false, error: `Μη υποστηριζόμενη γλώσσα: ${toLocale}` }
  }

  const rows = await loadTranslations(kind, id)
  const target = rows.find(t => t.locale === toLocale)
  if (!target) {
    return {
      ok: false,
      error: `Δεν υπάρχει όρος «${toLocale}» στο WooCommerce. Δημιούργησέ τον πρώτα στο WordPress ` +
        'και ξανατρέξε τον συγχρονισμό — η μετάφραση ενημερώνει υπάρχοντες όρους.',
    }
  }

  const source = rows.find(t => t.locale === 'el' && t.locale !== toLocale)
    ?? rows.find(t => t.locale !== toLocale)
  if (!source) return { ok: false, error: 'Δεν υπάρχει γλώσσα-πηγή για μετάφραση.' }

  let translated
  try {
    translated = await translateTermFields(
      { name: source.name, description: source.description },
      source.locale, toLocale, kind,
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const data = { name: translated.name, description: translated.description || null }
  if (kind === 'category') {
    await prisma.categoryTranslation.update({
      where: { categoryId_locale: { categoryId: id, locale: toLocale } }, data,
    })
  } else {
    await prisma.brandTranslation.update({
      where: { brandId_locale: { brandId: id, locale: toLocale } }, data,
    })
  }

  return { ok: true, message: `Η μετάφραση «${toLocale}» ενημερώθηκε από «${source.locale}» με DeepSeek.` }
}

export type TermPushScope = { content: boolean }

export type TermPreview = {
  plans: { locale: string; wooId: number; plan: WritePlan }[]
  gate: ReturnType<typeof readGate>
  warnings: string[]
}

export async function previewTermPush(
  kind: TermKind,
  id: string,
  scope: TermPushScope,
): Promise<TermPreview> {
  const rows = await loadTranslations(kind, id)
  const warnings: string[] = []

  const plans = rows.map(t => {
    const body: Record<string, unknown> = {}
    if (scope.content) {
      body.name = t.name
      body.description = t.description ?? ''
    }
    return { locale: t.locale, wooId: t.wooId, plan: planUpdate(RESOURCE[kind], t.wooId, body) }
  }).filter(p => Object.keys(p.plan.body).length > 0)

  // The slug is deliberately never sent. Changing it rewrites every public URL
  // for that category and breaks existing links and search indexing; renaming
  // is a content change, not a routing change.
  if (scope.content) {
    warnings.push('Το slug (URL) δεν στέλνεται ποτέ — η αλλαγή του θα έσπαγε τα υπάρχοντα links.')
  }

  return { plans, gate: readGate(), warnings }
}

export type TermReport = { locale: string; wooId: number; verdicts: FieldVerdict[]; ok: boolean }

export type TermPushResult =
  | { ok: true; message: string; reports: TermReport[] }
  | { ok: false; error: string; reports?: TermReport[] }

/** Sends, then reads back and diffs. See pushProductToWoo for why. */
export async function pushTerm(
  kind: TermKind,
  id: string,
  scope: TermPushScope,
  confirmed: boolean,
): Promise<TermPushResult> {
  if (!confirmed) return { ok: false, error: 'Απαιτείται ρητή επιβεβαίωση πριν την αποστολή.' }
  if (!scope.content) return { ok: false, error: 'Δεν επιλέχθηκε κανένα πεδίο για αποστολή.' }

  const preview = await previewTermPush(kind, id, scope)
  if (!preview.plans.length) return { ok: false, error: 'Δεν υπάρχει τίποτα να σταλεί.' }

  const reports: TermReport[] = []
  for (const { locale, wooId, plan } of preview.plans) {
    try {
      await executeUpdate({ ...plan, wouldExecute: plan.gate.allowWrites && !plan.gate.dryRun })
    } catch (err) {
      return {
        ok: false,
        error: `Απέτυχε η αποστολή για ${locale} (#${wooId}): ${err instanceof Error ? err.message : String(err)}`,
        reports,
      }
    }
    const live = await readBack(RESOURCE[kind], wooId)
    const verdicts = verifyFields(plan.body, live)
    reports.push({ locale, wooId, verdicts, ok: verdicts.every(v => v.match) })
  }

  const failed = reports.filter(r => !r.ok)
  if (failed.length) {
    const fields = failed.flatMap(r => r.verdicts.filter(v => !v.match).map(v => `${r.locale}.${v.field}`))
    return {
      ok: false,
      error: `Η αποστολή έγινε δεκτή αλλά ο έλεγχος ανάγνωσης ΔΕΝ επιβεβαίωσε: ${fields.join(', ')}.`,
      reports,
    }
  }
  return {
    ok: true,
    message: `Επιβεβαιωμένο στο WooCommerce: ${reports.map(r => `${r.locale} #${r.wooId}`).join(', ')}.`,
    reports,
  }
}

/** Read-only comparison. No gates involved — nothing is written. */
export async function verifyTerm(kind: TermKind, id: string): Promise<TermPushResult> {
  const preview = await previewTermPush(kind, id, { content: true })
  if (!preview.plans.length) return { ok: false, error: 'Δεν υπάρχει τίποτα να ελεγχθεί.' }

  const reports: TermReport[] = []
  for (const { locale, wooId, plan } of preview.plans) {
    try {
      const live = await readBack(RESOURCE[kind], wooId)
      const verdicts = verifyFields(plan.body, live)
      reports.push({ locale, wooId, verdicts, ok: verdicts.every(v => v.match) })
    } catch (err) {
      return { ok: false, error: `Απέτυχε η ανάγνωση #${wooId}: ${String(err)}`, reports }
    }
  }

  const drifted = reports.flatMap(r => r.verdicts.filter(v => !v.match).map(v => `${r.locale}.${v.field}`))
  return drifted.length
    ? { ok: false, error: `Διαφορές με το WooCommerce: ${drifted.join(', ')}.`, reports }
    : { ok: true, message: 'Το WooCommerce συμφωνεί με τα τοπικά δεδομένα.', reports }
}
