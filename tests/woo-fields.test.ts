import { describe, it, expect } from 'vitest'
import { PRODUCT_FIELDS, CATEGORY_FIELDS, VARIATION_FIELDS, FORBIDDEN_FIELDS } from '@/lib/woo/fields'

describe('woo field whitelists', () => {
  it('never requests the fields that crash the source site', () => {
    for (const list of [PRODUCT_FIELDS, CATEGORY_FIELDS, VARIATION_FIELDS]) {
      for (const forbidden of FORBIDDEN_FIELDS) {
        expect(list, `${forbidden} must never be requested`).not.toContain(forbidden)
      }
    }
  })

  it('names exactly the three fields known to 500', () => {
    expect([...FORBIDDEN_FIELDS].sort()).toEqual(['on_sale', 'price_html', 'sale_price'])
  })

  it('requests the fields the sync engine depends on', () => {
    for (const f of ['id', 'lang', 'translations', 'name', 'slug', 'price', 'regular_price',
                     'categories', 'images', 'date_modified', 'type', 'status']) {
      expect(PRODUCT_FIELDS).toContain(f)
    }
  })

  it('requests lang and translations on categories so groups can be built', () => {
    expect(CATEGORY_FIELDS).toContain('lang')
    expect(CATEGORY_FIELDS).toContain('translations')
  })

  it('has no duplicate entries', () => {
    for (const list of [PRODUCT_FIELDS, CATEGORY_FIELDS, VARIATION_FIELDS]) {
      expect(new Set(list).size).toBe(list.length)
    }
  })
})
