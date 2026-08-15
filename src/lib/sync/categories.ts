import { prisma } from '@/lib/prisma'
import { listCategories } from '@/lib/woo/client'
import { groupByTranslation } from '@/lib/woo/translation-groups'
import type { WooCategory } from '@/lib/woo/types'

export type CategoryTranslationUpsert = {
  locale: string
  wooId: number
  name: string
  slug: string
  description: string | null
  wooSnapshot: WooCategory
}

export type CategoryUpsert = {
  wooGroupKey: number
  parentGroupKey: number | null
  menuOrder: number
  count: number
  translations: CategoryTranslationUpsert[]
}

/** Pure: Woo posts → one upsert per logical category. */
export function toCategoryUpserts(posts: WooCategory[]): CategoryUpsert[] {
  const groups = groupByTranslation(posts)

  // Any post id → its group key, so a parent reference in either language resolves.
  const groupKeyByPostId = new Map<number, number>()
  for (const g of groups) {
    for (const post of Object.values(g.byLocale)) {
      groupKeyByPostId.set(post.id, g.groupKey)
      for (const id of Object.values(post.translations ?? {})) {
        groupKeyByPostId.set(id, g.groupKey)
      }
    }
  }

  return groups.map(g => {
    const any = Object.values(g.byLocale)[0]
    const parent = any.parent
    return {
      wooGroupKey: g.groupKey,
      parentGroupKey: parent ? groupKeyByPostId.get(parent) ?? null : null,
      menuOrder: any.menu_order,
      count: any.count,
      translations: Object.entries(g.byLocale).map(([locale, post]) => ({
        locale,
        wooId: post.id,
        name: post.name,
        slug: post.slug,
        description: post.description || null,
        wooSnapshot: post,
      })),
    }
  })
}

export type PullResult = { created: number; updated: number }

export async function pullCategories(): Promise<PullResult> {
  const posts = await listCategories()
  const upserts = toCategoryUpserts(posts)
  let created = 0
  let updated = 0

  for (const row of upserts) {
    const existing = await prisma.category.findUnique({ where: { wooGroupKey: row.wooGroupKey } })
    const category = await prisma.category.upsert({
      where: { wooGroupKey: row.wooGroupKey },
      update: {
        parentGroupKey: row.parentGroupKey,
        menuOrder: row.menuOrder,
        count: row.count,
      },
      create: {
        wooGroupKey: row.wooGroupKey,
        parentGroupKey: row.parentGroupKey,
        menuOrder: row.menuOrder,
        count: row.count,
      },
    })
    if (existing) updated++
    else created++

    for (const t of row.translations) {
      await prisma.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: category.id, locale: t.locale } },
        update: {
          wooId: t.wooId, name: t.name, slug: t.slug,
          description: t.description, wooSnapshot: t.wooSnapshot as object,
        },
        create: {
          categoryId: category.id, locale: t.locale, wooId: t.wooId,
          name: t.name, slug: t.slug, description: t.description,
          wooSnapshot: t.wooSnapshot as object,
        },
      })
    }
  }
  return { created, updated }
}
