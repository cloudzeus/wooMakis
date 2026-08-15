import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { requirePermission } from '@/lib/rbac-server'
import { isDeepSeekConfigured } from '@/lib/deepseek'
import { checkKeyCapability, readGate } from '@/lib/woo/write'
import { CategoryEditor } from './category-editor'

export const dynamic = 'force-dynamic'

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requirePermission('category.view')

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      translations: { orderBy: { locale: 'asc' } },
      _count: { select: { products: true } },
    },
  })
  if (!category) notFound()

  const parent = category.parentGroupKey
    ? await prisma.category.findUnique({
        where: { wooGroupKey: category.parentGroupKey },
        include: { translations: true },
      })
    : null

  // A safe probe: a PUT to an id that cannot exist, which answers whether
  // the API key may write without writing anything.
  const keyStatus = await checkKeyCapability()

  const parentName = parent?.translations.find(t => t.locale === 'el')?.name
    ?? parent?.translations[0]?.name

  return (
    <section className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href="/categories" className="hover:text-foreground">Κατηγορίες</Link>
        <span className="mx-1">/</span>
        <span>{category.translations.find(t => t.locale === 'el')?.name ?? category.id}</span>
      </nav>

      <CategoryEditor
        id={category.id}
        subtitle={[
          `Woo group #${category.wooGroupKey}`,
          parentName ? `υποκατηγορία του «${parentName}»` : 'κατηγορία πρώτου επιπέδου',
          `${category._count.products} προϊόντα`,
        ].join(' · ')}
        translations={category.translations.map(t => ({
          locale: t.locale,
          wooId: t.wooId,
          name: t.name,
          slug: t.slug,
          description: t.description ?? '',
        }))}
        gate={readGate()}
        keyStatus={keyStatus}
        canEdit={can(session, 'category.edit')}
        canPush={can(session, 'sync.push')}
        deepseekReady={isDeepSeekConfigured()}
      />
    </section>
  )
}
