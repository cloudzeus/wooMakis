'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { LOCALES } from '@/lib/i18n'
import { isDeepSeekConfigured, translateTermFields } from '@/lib/deepseek'

export type ContentResult = { ok: true; message: string } | { ok: false; error: string }

/** Every storefront page and FAQ answer is revalidated together — they share a layout. */
function refresh(slug?: string) {
  revalidatePath('/content')
  revalidatePath('/syxnes-erotiseis')
  if (slug) revalidatePath(`/${slug}`)
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// ── Pages ─────────────────────────────────────────────────

export async function savePage(
  id: string,
  translations: { locale: string; title: string; body: string; summary: string }[],
  published: boolean,
): Promise<ContentResult> {
  await requirePermission('settings.manage')

  for (const t of translations) {
    if (!t.title.trim()) return { ok: false, error: `Λείπει τίτλος για «${t.locale}».` }
  }

  const page = await prisma.contentPage.update({
    where: { id },
    data: { published },
  })

  for (const t of translations) {
    await prisma.contentPageTranslation.upsert({
      where: { pageId_locale: { pageId: id, locale: t.locale } },
      update: {
        title: t.title.trim(),
        body: t.body,
        summary: t.summary.trim() || null,
      },
      create: {
        pageId: id,
        locale: t.locale,
        title: t.title.trim(),
        body: t.body,
        summary: t.summary.trim() || null,
      },
    })
  }

  refresh(page.slug)
  return { ok: true, message: `Η σελίδα «${page.slug}» αποθηκεύτηκε.` }
}

export async function createPage(title: string): Promise<ContentResult> {
  await requirePermission('settings.manage')

  const clean = title.trim()
  if (!clean) return { ok: false, error: 'Συμπλήρωσε τίτλο.' }

  const slug = slugify(clean)
  if (!slug) return { ok: false, error: 'Ο τίτλος δεν παράγει έγκυρο slug — γράψε τον με λατινικά ή πρόσθεσε λέξεις.' }
  if (await prisma.contentPage.findUnique({ where: { slug } })) {
    return { ok: false, error: `Υπάρχει ήδη σελίδα με slug «${slug}».` }
  }

  await prisma.contentPage.create({
    data: {
      slug,
      kind: 'GENERIC',
      published: false,
      translations: { create: { locale: 'el', title: clean, body: '' } },
    },
  })

  refresh(slug)
  return { ok: true, message: `Δημιουργήθηκε η σελίδα «${slug}» ως πρόχειρη.` }
}

export async function deletePage(id: string): Promise<ContentResult> {
  await requirePermission('settings.manage')

  const page = await prisma.contentPage.findUnique({ where: { id } })
  if (!page) return { ok: false, error: 'Η σελίδα δεν βρέθηκε.' }

  // The legal pages are linked from the footer of every page and are a
  // regulatory requirement; unpublishing is the intended way to take one down.
  if (page.kind !== 'GENERIC') {
    return {
      ok: false,
      error: `Η «${page.slug}» είναι θεσμική σελίδα (${page.kind}) και δεν διαγράφεται. Απόσυρέ την αντί να τη σβήσεις.`,
    }
  }

  await prisma.contentPage.delete({ where: { id } })
  refresh(page.slug)
  return { ok: true, message: `Η σελίδα «${page.slug}» διαγράφηκε.` }
}

/** Translates a page into the other language with DeepSeek. */
export async function translatePage(id: string, toLocale: string): Promise<ContentResult> {
  await requirePermission('settings.manage')

  if (!isDeepSeekConfigured()) {
    return { ok: false, error: 'Λείπει το DEEPSEEK_API_KEY στο .env.' }
  }
  if (!(LOCALES as readonly string[]).includes(toLocale)) {
    return { ok: false, error: `Μη υποστηριζόμενη γλώσσα: ${toLocale}` }
  }

  const page = await prisma.contentPage.findUnique({
    where: { id },
    include: { translations: true },
  })
  if (!page) return { ok: false, error: 'Η σελίδα δεν βρέθηκε.' }

  const source = page.translations.find(t => t.locale !== toLocale && t.locale === 'el')
    ?? page.translations.find(t => t.locale !== toLocale)
  if (!source) return { ok: false, error: 'Δεν υπάρχει γλώσσα-πηγή.' }

  let translated
  try {
    // The term prompt is reused: it preserves structure and adds nothing, which
    // is exactly what legal text needs. A "make it flow better" prompt on terms
    // and conditions is how a clause quietly changes meaning.
    translated = await translateTermFields(
      { name: source.title, description: source.body },
      source.locale, toLocale, 'category',
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  await prisma.contentPageTranslation.upsert({
    where: { pageId_locale: { pageId: id, locale: toLocale } },
    update: { title: translated.name, body: translated.description ?? '' },
    create: {
      pageId: id,
      locale: toLocale,
      title: translated.name,
      body: translated.description ?? '',
    },
  })

  refresh(page.slug)
  return {
    ok: true,
    message: `Μεταφράστηκε στα «${toLocale}». Έλεγξε το κείμενο πριν το δημοσιεύσεις — είναι νομικό.`,
  }
}

// ── FAQ ───────────────────────────────────────────────────

export async function createFaq(
  category: string,
  question: string,
  answer: string,
): Promise<ContentResult> {
  await requirePermission('settings.manage')

  if (!question.trim()) return { ok: false, error: 'Συμπλήρωσε ερώτηση.' }
  if (!answer.trim()) return { ok: false, error: 'Συμπλήρωσε απάντηση.' }

  const cat = category.trim() || 'Γενικά'
  const last = await prisma.faqItem.findFirst({
    where: { category: cat },
    orderBy: { menuOrder: 'desc' },
    select: { menuOrder: true },
  })

  await prisma.faqItem.create({
    data: {
      category: cat,
      menuOrder: (last?.menuOrder ?? -1) + 1,
      translations: { create: { locale: 'el', question: question.trim(), answer: answer.trim() } },
    },
  })

  refresh()
  return { ok: true, message: 'Η ερώτηση προστέθηκε.' }
}

export async function saveFaq(
  id: string,
  category: string,
  published: boolean,
  translations: { locale: string; question: string; answer: string }[],
): Promise<ContentResult> {
  await requirePermission('settings.manage')

  await prisma.faqItem.update({
    where: { id },
    data: { category: category.trim() || 'Γενικά', published },
  })

  for (const t of translations) {
    // An empty translation is removed rather than stored blank: a blank English
    // answer would render as an empty accordion instead of falling back to Greek.
    if (!t.question.trim() || !t.answer.trim()) {
      await prisma.faqTranslation.deleteMany({ where: { faqId: id, locale: t.locale } })
      continue
    }
    await prisma.faqTranslation.upsert({
      where: { faqId_locale: { faqId: id, locale: t.locale } },
      update: { question: t.question.trim(), answer: t.answer.trim() },
      create: { faqId: id, locale: t.locale, question: t.question.trim(), answer: t.answer.trim() },
    })
  }

  refresh()
  return { ok: true, message: 'Η ερώτηση αποθηκεύτηκε.' }
}

export async function deleteFaq(id: string): Promise<ContentResult> {
  await requirePermission('settings.manage')
  await prisma.faqItem.delete({ where: { id } })
  refresh()
  return { ok: true, message: 'Η ερώτηση διαγράφηκε.' }
}

/** Moves an entry within its category. */
export async function moveFaq(id: string, direction: -1 | 1): Promise<ContentResult> {
  await requirePermission('settings.manage')

  const item = await prisma.faqItem.findUnique({ where: { id } })
  if (!item) return { ok: false, error: 'Η ερώτηση δεν βρέθηκε.' }

  const siblings = await prisma.faqItem.findMany({
    where: { category: item.category },
    orderBy: { menuOrder: 'asc' },
  })
  const index = siblings.findIndex(s => s.id === id)
  const target = index + direction
  if (target < 0 || target >= siblings.length) {
    return { ok: false, error: 'Είναι ήδη στην άκρη της κατηγορίας.' }
  }

  // Renumber the whole category rather than swapping two values: the orders
  // can contain gaps and duplicates from earlier edits, and a swap preserves them.
  const reordered = [...siblings]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(target, 0, moved)

  await prisma.$transaction(
    reordered.map((s, i) =>
      prisma.faqItem.update({ where: { id: s.id }, data: { menuOrder: i } }),
    ),
  )

  refresh()
  return { ok: true, message: 'Η σειρά άλλαξε.' }
}

export async function translateFaq(id: string, toLocale: string): Promise<ContentResult> {
  await requirePermission('settings.manage')

  if (!isDeepSeekConfigured()) return { ok: false, error: 'Λείπει το DEEPSEEK_API_KEY στο .env.' }

  const item = await prisma.faqItem.findUnique({ where: { id }, include: { translations: true } })
  if (!item) return { ok: false, error: 'Η ερώτηση δεν βρέθηκε.' }

  const source = item.translations.find(t => t.locale !== toLocale)
  if (!source) return { ok: false, error: 'Δεν υπάρχει γλώσσα-πηγή.' }

  try {
    const translated = await translateTermFields(
      { name: source.question, description: source.answer },
      source.locale, toLocale, 'category',
    )
    await prisma.faqTranslation.upsert({
      where: { faqId_locale: { faqId: id, locale: toLocale } },
      update: { question: translated.name, answer: translated.description ?? '' },
      create: {
        faqId: id,
        locale: toLocale,
        question: translated.name,
        answer: translated.description ?? '',
      },
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  refresh()
  return { ok: true, message: `Μεταφράστηκε στα «${toLocale}».` }
}
