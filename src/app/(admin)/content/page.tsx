import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { isDeepSeekConfigured } from '@/lib/deepseek'
import { ContentManager, type FaqRow, type PageRow } from './content-manager'

export const dynamic = 'force-dynamic'

export default async function ContentPage() {
  await requirePermission('settings.manage')

  const [pages, faq] = await Promise.all([
    prisma.contentPage.findMany({
      orderBy: [{ kind: 'asc' }, { menuOrder: 'asc' }],
      include: { translations: true },
    }),
    prisma.faqItem.findMany({
      orderBy: [{ category: 'asc' }, { menuOrder: 'asc' }],
      include: { translations: true },
    }),
  ])

  const pageRows: PageRow[] = pages.map(p => ({
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    published: p.published,
    translations: p.translations.map(t => ({
      locale: t.locale,
      title: t.title,
      body: t.body,
      summary: t.summary ?? '',
    })),
  }))

  const faqRows: FaqRow[] = faq.map(f => ({
    id: f.id,
    category: f.category,
    published: f.published,
    menuOrder: f.menuOrder,
    translations: f.translations.map(t => ({
      locale: t.locale,
      question: t.question,
      answer: t.answer,
    })),
  }))

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Περιεχόμενο</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Σελίδες όρων και πολιτικών, και οι συχνές ερωτήσεις του καταστήματος.
          Υπάρχουν μόνο εδώ — δεν κατεβαίνουν από το WooCommerce.
        </p>
      </header>

      <ContentManager pages={pageRows} faq={faqRows} deepseekReady={isDeepSeekConfigured()} />
    </section>
  )
}
