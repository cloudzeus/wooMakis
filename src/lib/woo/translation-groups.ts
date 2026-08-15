export type TranslatablePost = {
  id: number
  lang: string
  translations: Record<string, number>
}

export type TranslationGroup<T extends TranslatablePost> = {
  /**
   * Lowest post id across the whole translation set — including ids we did not
   * fetch. Using the lowest *known* id instead would make the key flip when a
   * language is fetched separately.
   */
  groupKey: number
  byLocale: Record<string, T>
}

/**
 * Collapses Polylang posts into logical entities. The source site returns one
 * post per language (see spec §2.0); treating each as its own product would
 * double the catalog.
 */
export function groupByTranslation<T extends TranslatablePost>(posts: T[]): TranslationGroup<T>[] {
  const groups = new Map<number, TranslationGroup<T>>()

  for (const post of posts) {
    const ids = Object.values(post.translations ?? {})
    const groupKey = ids.length ? Math.min(...ids, post.id) : post.id

    let group = groups.get(groupKey)
    if (!group) {
      group = { groupKey, byLocale: {} }
      groups.set(groupKey, group)
    }
    group.byLocale[post.lang] = post
  }

  return [...groups.values()].sort((a, b) => a.groupKey - b.groupKey)
}

/**
 * WooCommerce returns post titles HTML-escaped — "Bausch &amp; Lomb", not
 * "Bausch & Lomb". Decoding at sync time means every consumer (admin table,
 * storefront, DeepSeek prompt, order line) gets the real name without each
 * having to remember.
 */
const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#039;': "'", '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
}

export function decodeEntities(input: string): string {
  return input
    .replace(/&(?:amp|lt|gt|quot|#0?39|apos|nbsp);/g, m => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}
