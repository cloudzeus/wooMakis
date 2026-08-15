import { describe, it, expect } from 'vitest'
import { toProductUpserts, deriveOnSale } from '@/lib/sync/products'
import type { WooProduct } from '@/lib/woo/types'

const prod = (over: Partial<WooProduct>): WooProduct => ({
  id: 1, lang: 'el', translations: { el: 1 }, name: 'Φακός', slug: 'fakos',
  permalink: 'https://x/fakos', sku: 'SKU1', type: 'simple', status: 'publish',
  featured: false, description: 'περιγραφή', short_description: 'σύντομη',
  price: '10.00', regular_price: '10.00',
  manage_stock: false, stock_quantity: null, stock_status: 'instock',
  categories: [], tags: [], images: [], attributes: [], variations: [],
  menu_order: 0, total_sales: 3,
  date_created: '2026-01-01T00:00:00', date_modified: '2026-02-01T00:00:00', ...over,
})

describe('deriveOnSale', () => {
  it('is true when price is below regular price', () => {
    expect(deriveOnSale('8.00', '10.00')).toBe(true)
  })
  it('is false when they are equal', () => {
    expect(deriveOnSale('10.00', '10.00')).toBe(false)
  })
  it('is false when either value is missing', () => {
    expect(deriveOnSale('', '10.00')).toBe(false)
    expect(deriveOnSale('8.00', '')).toBe(false)
  })
  it('is false for unparseable values rather than throwing', () => {
    expect(deriveOnSale('abc', '10.00')).toBe(false)
  })
})

describe('toProductUpserts', () => {
  it('produces one product per translation group', () => {
    const rows = toProductUpserts([
      prod({ id: 1, lang: 'el', translations: { el: 1, en: 2 } }),
      prod({ id: 2, lang: 'en', translations: { el: 1, en: 2 }, name: 'Lens' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].translations).toHaveLength(2)
  })

  it('keeps a Greek-only product as a single-locale group', () => {
    const rows = toProductUpserts([prod({ id: 7, lang: 'el', translations: { el: 7 } })])
    expect(rows).toHaveLength(1)
    expect(rows[0].translations.map(t => t.locale)).toEqual(['el'])
  })

  it('takes language-neutral fields from the group', () => {
    const rows = toProductUpserts([prod({ sku: 'ABC', type: 'variable', total_sales: 12 })])
    expect(rows[0].sku).toBe('ABC')
    expect(rows[0].type).toBe('variable')
    expect(rows[0].totalSales).toBe(12)
  })

  it('derives onSale locally because Woo sale fields cannot be read', () => {
    const rows = toProductUpserts([prod({ price: '7.50', regular_price: '10.00' })])
    expect(rows[0].onSale).toBe(true)
  })

  it('collects distinct image source urls across both languages', () => {
    const rows = toProductUpserts([
      prod({ id: 1, lang: 'el', translations: { el: 1, en: 2 }, images: [{ id: 9, src: 'https://x/a.jpg' }] }),
      prod({ id: 2, lang: 'en', translations: { el: 1, en: 2 }, images: [{ id: 9, src: 'https://x/a.jpg' }] }),
    ])
    expect(rows[0].images).toHaveLength(1)
    expect(rows[0].images[0].src).toBe('https://x/a.jpg')
  })

  it('records category group references', () => {
    const rows = toProductUpserts([
      prod({ categories: [{ id: 12179, name: 'Contact Lenses', slug: 'contact-lenses' }] }),
    ])
    expect(rows[0].categoryWooIds).toEqual([12179])
  })
})
