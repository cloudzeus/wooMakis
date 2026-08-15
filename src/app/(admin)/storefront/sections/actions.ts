'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { LOCALES } from '@/lib/i18n'
import { SECTION_KINDS, type SectionKind } from '@/lib/home-sections'

export type SectionResult = { ok: true; message: string } | { ok: false; error: string }

function refresh() {
  revalidatePath('/storefront/sections')
  revalidatePath('/')
}

function isKind(v: string): v is SectionKind {
  return (SECTION_KINDS as readonly string[]).includes(v)
}

/** Creates the row on first edit — sections exist as defaults until touched. */
async function rowFor(kind: SectionKind, menuOrder: number) {
  return prisma.homeSection.upsert({
    where: { kind },
    update: {},
    create: { kind, menuOrder },
  })
}

export async function setSectionEnabled(kind: string, enabled: boolean): Promise<SectionResult> {
  await requirePermission('settings.manage')
  if (!isKind(kind)) return { ok: false, error: `Άγνωστη ενότητα: ${kind}` }

  const row = await rowFor(kind, 0)
  await prisma.homeSection.update({ where: { id: row.id }, data: { enabled } })

  refresh()
  return { ok: true, message: enabled ? 'Η ενότητα εμφανίζεται.' : 'Η ενότητα αποκρύφτηκε.' }
}

/**
 * Moves a section up or down.
 *
 * The whole list is renumbered rather than swapping two values, because the
 * orders start as defaults and only become rows when edited — so gaps and
 * duplicates are the normal state, and a swap would preserve them.
 */
export async function moveSection(kind: string, direction: -1 | 1): Promise<SectionResult> {
  await requirePermission('settings.manage')
  if (!isKind(kind)) return { ok: false, error: `Άγνωστη ενότητα: ${kind}` }

  const rows = await prisma.homeSection.findMany({ orderBy: { menuOrder: 'asc' } })
  const stored = new Map(rows.map(r => [r.kind as SectionKind, r.menuOrder]))

  const ordered = [...SECTION_KINDS]
    .map((k, i) => ({ kind: k, order: stored.get(k) ?? i }))
    .sort((a, b) => a.order - b.order)
    .map(x => x.kind)

  const index = ordered.indexOf(kind)
  const target = index + direction
  if (target < 0 || target >= ordered.length) {
    return { ok: false, error: 'Είναι ήδη στην άκρη.' }
  }

  const [moved] = ordered.splice(index, 1)
  ordered.splice(target, 0, moved)

  for (const [i, k] of ordered.entries()) {
    const row = await rowFor(k, i)
    await prisma.homeSection.update({ where: { id: row.id }, data: { menuOrder: i } })
  }

  refresh()
  return { ok: true, message: 'Η σειρά άλλαξε.' }
}

export type SectionForm = {
  imageSlot: string
  imageSlotB: string
  itemLimit: number
  translations: {
    locale: string
    eyebrow: string
    title: string
    body: string
    ctaLabel: string
    ctaHref: string
    ctaLabelB: string
    ctaHrefB: string
  }[]
}

export async function saveSection(kind: string, form: SectionForm): Promise<SectionResult> {
  await requirePermission('settings.manage')
  if (!isKind(kind)) return { ok: false, error: `Άγνωστη ενότητα: ${kind}` }

  // Internal paths and anchors only. An external destination on a home-page
  // button is how a compromised admin account turns the shop's front door into
  // a redirect, and nothing on this page legitimately needs one.
  for (const t of form.translations) {
    for (const href of [t.ctaHref, t.ctaHrefB]) {
      const v = href.trim()
      if (v && !/^[/#]/.test(v)) {
        return { ok: false, error: `Ο σύνδεσμος «${v}» πρέπει να ξεκινά με / ή #.` }
      }
    }
  }

  const limit = Math.max(0, Math.min(24, Math.round(form.itemLimit)))

  const row = await rowFor(kind, 0)
  await prisma.homeSection.update({
    where: { id: row.id },
    data: {
      imageSlot: form.imageSlot.trim() || null,
      imageSlotB: form.imageSlotB.trim() || null,
      itemLimit: limit,
    },
  })

  for (const t of form.translations) {
    if (!LOCALES.includes(t.locale as (typeof LOCALES)[number])) continue
    const data = {
      eyebrow: t.eyebrow.trim() || null,
      title: t.title.trim() || null,
      body: t.body.trim() || null,
      ctaLabel: t.ctaLabel.trim() || null,
      ctaHref: t.ctaHref.trim() || null,
      ctaLabelB: t.ctaLabelB.trim() || null,
      ctaHrefB: t.ctaHrefB.trim() || null,
    }
    await prisma.homeSectionTranslation.upsert({
      where: { sectionId_locale: { sectionId: row.id, locale: t.locale } },
      update: data,
      create: { sectionId: row.id, locale: t.locale, ...data },
    })
  }

  refresh()
  return { ok: true, message: 'Η ενότητα αποθηκεύτηκε. Άδεια πεδία επιστρέφουν στο προεπιλεγμένο κείμενο.' }
}

/** Drops the overrides so the shipped copy comes back. */
export async function resetSection(kind: string): Promise<SectionResult> {
  await requirePermission('settings.manage')
  if (!isKind(kind)) return { ok: false, error: `Άγνωστη ενότητα: ${kind}` }

  const row = await prisma.homeSection.findUnique({ where: { kind } })
  if (!row) return { ok: true, message: 'Η ενότητα ήταν ήδη στις προεπιλογές.' }

  await prisma.homeSectionTranslation.deleteMany({ where: { sectionId: row.id } })
  refresh()
  return { ok: true, message: 'Τα κείμενα επανήλθαν στις προεπιλογές.' }
}
