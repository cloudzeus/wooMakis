import { prisma } from '@/lib/prisma'
import { pickTranslation, type Locale } from '@/lib/i18n'

/**
 * Storefront content: legal pages and FAQ.
 *
 * Bodies are stored as plain text, not HTML, and rendered through the block
 * parser below. Accepting HTML from an admin textarea and putting it through
 * dangerouslySetInnerHTML would mean one compromised staff account becomes
 * script execution in every visitor's browser, on the pages people are most
 * likely to trust.
 */

export type ContentBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

/**
 * Minimal, deliberately: `## ` starts a heading, `- ` starts a list item, a
 * blank line separates paragraphs. Anything else is a paragraph. Staff can
 * learn this in one sentence and it cannot express anything unsafe.
 */
export function parseBlocks(body: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  let list: string[] = []
  let para: string[] = []

  const flushList = () => { if (list.length) { blocks.push({ type: 'list', items: list }); list = [] } }
  const flushPara = () => {
    if (para.length) { blocks.push({ type: 'paragraph', text: para.join(' ') }); para = [] }
  }

  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()

    if (!line) { flushList(); flushPara(); continue }

    if (line.startsWith('## ')) {
      flushList(); flushPara()
      blocks.push({ type: 'heading', text: line.slice(3).trim() })
      continue
    }
    if (line.startsWith('- ')) {
      flushPara()
      list.push(line.slice(2).trim())
      continue
    }
    flushList()
    para.push(line)
  }
  flushList()
  flushPara()
  return blocks
}

export type PageContent = {
  slug: string
  title: string
  body: string
  summary: string | null
  updatedAt: Date
}

export async function getPage(slug: string, locale: Locale): Promise<PageContent | null> {
  const page = await prisma.contentPage.findUnique({
    where: { slug },
    include: { translations: true },
  })
  if (!page || !page.published) return null

  const t = pickTranslation(page.translations, locale)
  if (!t) return null

  return {
    slug: page.slug,
    title: t.title,
    body: t.body,
    summary: t.summary,
    updatedAt: page.updatedAt,
  }
}

export type FaqEntry = { id: string; category: string; question: string; answer: string }

/** Published FAQ entries grouped by category, in the order staff set. */
export async function getFaq(locale: Locale): Promise<{ category: string; items: FaqEntry[] }[]> {
  const items = await prisma.faqItem.findMany({
    where: { published: true },
    orderBy: [{ category: 'asc' }, { menuOrder: 'asc' }],
    include: { translations: true },
  })

  // Grouped by FaqItem.category, which is stable across languages, but
  // labelled from the translation. Grouping by the translated string instead
  // would split one section into two the moment a single entry is translated.
  const groups = new Map<string, { label: string; items: FaqEntry[] }>()
  for (const item of items) {
    const t = pickTranslation(item.translations, locale)
    if (!t) continue
    const group = groups.get(item.category) ?? { label: item.category, items: [] }
    if (t.locale === locale && t.category) group.label = t.category
    group.items.push({ id: item.id, category: item.category, question: t.question, answer: t.answer })
    groups.set(item.category, group)
  }
  return [...groups.values()].map(g => ({ category: g.label, items: g.items }))
}
