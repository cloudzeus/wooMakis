import { prisma } from '@/lib/prisma'
import { listBrands } from '@/lib/woo/client'
import { decodeEntities, groupByTranslation } from '@/lib/woo/translation-groups'
import type { WooBrand } from '@/lib/woo/types'

export type BrandTranslationUpsert = {
  locale: string
  wooId: number
  name: string
  slug: string
  description: string | null
  wooSnapshot: WooBrand
}

export type BrandUpsert = {
  wooGroupKey: number
  count: number
  translations: BrandTranslationUpsert[]
}

/**
 * Pure: Woo brand posts → one upsert per logical brand.
 *
 * Polylang duplicates brands per language exactly as it does categories, so the
 * 44 posts on mylens.gr are roughly 22 real brands. Counting posts would show
 * "Alcon" twice in every filter.
 */
export function toBrandUpserts(posts: WooBrand[]): BrandUpsert[] {
  return groupByTranslation(posts).map(g => {
    const any = Object.values(g.byLocale)[0]
    return {
      wooGroupKey: g.groupKey,
      count: any.count,
      translations: Object.entries(g.byLocale).map(([locale, post]) => ({
        locale,
        wooId: post.id,
        name: decodeEntities(post.name),
        slug: post.slug,
        description: post.description || null,
        wooSnapshot: post,
      })),
    }
  })
}

export async function pullBrands(): Promise<{ created: number; updated: number }> {
  const posts = await listBrands()
  const upserts = toBrandUpserts(posts)
  let created = 0
  let updated = 0

  for (const row of upserts) {
    const existing = await prisma.brand.findUnique({ where: { wooGroupKey: row.wooGroupKey } })
    const brand = await prisma.brand.upsert({
      where: { wooGroupKey: row.wooGroupKey },
      update: { count: row.count },
      create: { wooGroupKey: row.wooGroupKey, count: row.count },
    })
    existing ? updated++ : created++

    for (const t of row.translations) {
      await prisma.brandTranslation.upsert({
        where: { brandId_locale: { brandId: brand.id, locale: t.locale } },
        update: { wooId: t.wooId, name: t.name, slug: t.slug, description: t.description, wooSnapshot: t.wooSnapshot as object },
        create: {
          brandId: brand.id, locale: t.locale, wooId: t.wooId,
          name: t.name, slug: t.slug, description: t.description,
          wooSnapshot: t.wooSnapshot as object,
        },
      })
    }
  }
  return { created, updated }
}
