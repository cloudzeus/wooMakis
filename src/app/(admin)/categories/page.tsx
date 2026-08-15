import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { CategoriesTable, type CategoryRow } from './categories-table'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  await requirePermission('category.view')

  const categories = await prisma.category.findMany({
    orderBy: { menuOrder: 'asc' },
    include: {
      translations: true,
      _count: { select: { products: true } },
    },
  })

  // parentGroupKey points at another category's wooGroupKey, not its cuid.
  const nameByGroupKey = new Map(
    categories.map(c => [
      c.wooGroupKey,
      c.translations.find(t => t.locale === 'el')?.name ?? c.translations[0]?.name ?? null,
    ]),
  )

  const rows: CategoryRow[] = categories.map(c => {
    const el = c.translations.find(t => t.locale === 'el')
    const en = c.translations.find(t => t.locale === 'en')
    return {
      id: c.id,
      wooGroupKey: c.wooGroupKey,
      parentName: c.parentGroupKey ? nameByGroupKey.get(c.parentGroupKey) ?? null : null,
      menuOrder: c.menuOrder,
      count: c.count,
      nameEl: el?.name ?? null,
      nameEn: en?.name ?? null,
      slugEl: el?.slug ?? null,
      slugEn: en?.slug ?? null,
      descriptionEl: el?.description ?? null,
      locales: c.translations.map(t => t.locale).sort(),
      productCount: c._count.products,
    }
  })

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Κατηγορίες</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} κατηγορίες · {rows.reduce((n, r) => n + r.locales.length, 0)} μεταφράσεις
        </p>
      </header>

      <CategoriesTable rows={rows} />
    </section>
  )
}
