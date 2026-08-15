import { describe, it, expect } from 'vitest'
import { toCategoryUpserts } from '@/lib/sync/categories'
import type { WooCategory } from '@/lib/woo/types'

const cat = (over: Partial<WooCategory>): WooCategory => ({
  id: 1, lang: 'el', translations: { el: 1 }, name: 'Φακοί', slug: 'fakoi',
  parent: 0, description: '', menu_order: 0, count: 5, ...over,
})

describe('toCategoryUpserts', () => {
  it('produces one row per translation group, not per post', () => {
    const rows = toCategoryUpserts([
      cat({ id: 1, lang: 'el', translations: { el: 1, en: 2 } }),
      cat({ id: 2, lang: 'en', translations: { el: 1, en: 2 }, name: 'Lenses', slug: 'lenses' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].wooGroupKey).toBe(1)
    expect(rows[0].translations.map(t => t.locale).sort()).toEqual(['el', 'en'])
  })

  it('carries each locale name and its own wooId', () => {
    const rows = toCategoryUpserts([
      cat({ id: 1, lang: 'el', translations: { el: 1, en: 2 }, name: 'Φακοί' }),
      cat({ id: 2, lang: 'en', translations: { el: 1, en: 2 }, name: 'Lenses' }),
    ])
    const byLocale = Object.fromEntries(rows[0].translations.map(t => [t.locale, t]))
    expect(byLocale.el.name).toBe('Φακοί')
    expect(byLocale.el.wooId).toBe(1)
    expect(byLocale.en.name).toBe('Lenses')
    expect(byLocale.en.wooId).toBe(2)
  })

  it('maps a top-level category to a null parent rather than group 0', () => {
    const rows = toCategoryUpserts([cat({ parent: 0 })])
    expect(rows[0].parentGroupKey).toBeNull()
  })

  it('resolves a child parent id to the parent group key', () => {
    const rows = toCategoryUpserts([
      cat({ id: 1, lang: 'el', translations: { el: 1, en: 2 } }),
      cat({ id: 2, lang: 'en', translations: { el: 1, en: 2 } }),
      cat({ id: 3, lang: 'el', translations: { el: 3, en: 4 }, parent: 1 }),
      cat({ id: 4, lang: 'en', translations: { el: 3, en: 4 }, parent: 2 }),
    ])
    const child = rows.find(r => r.wooGroupKey === 3)!
    expect(child.parentGroupKey).toBe(1)
  })

  it('keeps the snapshot of each post for later conflict detection', () => {
    const rows = toCategoryUpserts([cat({ id: 9, translations: { el: 9 } })])
    expect(rows[0].translations[0].wooSnapshot).toMatchObject({ id: 9 })
  })
})
