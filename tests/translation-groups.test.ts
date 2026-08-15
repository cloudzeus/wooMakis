import { describe, it, expect } from 'vitest'
import { groupByTranslation } from '@/lib/woo/translation-groups'

const post = (id: number, lang: string, translations: Record<string, number>, name = `p${id}`) =>
  ({ id, lang, translations, name })

describe('groupByTranslation', () => {
  it('collapses a translation pair into one group', () => {
    const groups = groupByTranslation([
      post(4308, 'el', { el: 4308, en: 4309 }),
      post(4309, 'en', { el: 4308, en: 4309 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].groupKey).toBe(4308)
    expect(Object.keys(groups[0].byLocale).sort()).toEqual(['el', 'en'])
  })

  it('uses the lowest post id in the group as the stable key', () => {
    const groups = groupByTranslation([
      post(900, 'en', { el: 100, en: 900 }),
      post(100, 'el', { el: 100, en: 900 }),
    ])
    expect(groups[0].groupKey).toBe(100)
  })

  it('keeps an untranslated post as its own single-locale group', () => {
    const groups = groupByTranslation([post(77, 'el', { el: 77 })])
    expect(groups).toHaveLength(1)
    expect(groups[0].groupKey).toBe(77)
    expect(Object.keys(groups[0].byLocale)).toEqual(['el'])
  })

  it('handles a post with an empty translations map', () => {
    const groups = groupByTranslation([post(5, 'el', {})])
    expect(groups).toHaveLength(1)
    expect(groups[0].groupKey).toBe(5)
    expect(groups[0].byLocale.el.id).toBe(5)
  })

  it('does not double count when both members appear', () => {
    const groups = groupByTranslation([
      post(1, 'el', { el: 1, en: 2 }), post(2, 'en', { el: 1, en: 2 }),
      post(3, 'el', { el: 3, en: 4 }), post(4, 'en', { el: 3, en: 4 }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('groups correctly when only one member of a pair was fetched', () => {
    // ?lang=el returns only Greek posts, but each still names its English twin.
    const groups = groupByTranslation([post(1, 'el', { el: 1, en: 2 })])
    expect(groups).toHaveLength(1)
    expect(groups[0].groupKey).toBe(1)
    expect(groups[0].byLocale.en).toBeUndefined()
  })

  it('is deterministic regardless of input order', () => {
    const a = groupByTranslation([post(2, 'en', { el: 1, en: 2 }), post(1, 'el', { el: 1, en: 2 })])
    const b = groupByTranslation([post(1, 'el', { el: 1, en: 2 }), post(2, 'en', { el: 1, en: 2 })])
    expect(a[0].groupKey).toBe(b[0].groupKey)
  })
})
