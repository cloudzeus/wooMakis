import { describe, it, expect } from 'vitest'
import { contentHash, storageKeyFor, extensionFor, DERIVATIVE_WIDTHS } from '@/lib/images'

describe('image identity', () => {
  it('hashes identical bytes to the same value', () => {
    expect(contentHash(Buffer.from('abc'))).toBe(contentHash(Buffer.from('abc')))
  })

  it('hashes different bytes differently', () => {
    expect(contentHash(Buffer.from('abc'))).not.toBe(contentHash(Buffer.from('abd')))
  })

  it('produces a hex sha-256', () => {
    expect(contentHash(Buffer.from('abc'))).toMatch(/^[0-9a-f]{64}$/)
  })

  it('builds a content-addressed original key', () => {
    const h = contentHash(Buffer.from('abc'))
    expect(storageKeyFor(h, 'original', 'jpg')).toBe(`products/${h}/original.jpg`)
  })

  it('builds a width-suffixed derivative key', () => {
    const h = contentHash(Buffer.from('abc'))
    expect(storageKeyFor(h, 640, 'webp')).toBe(`products/${h}/640.webp`)
  })

  it('derives an extension from a url with a query string', () => {
    expect(extensionFor('https://x/a.JPG?ver=2')).toBe('jpg')
  })

  it('falls back to jpg for an extensionless url', () => {
    expect(extensionFor('https://x/image')).toBe('jpg')
  })

  it('declares derivative widths in ascending order', () => {
    expect([...DERIVATIVE_WIDTHS]).toEqual([...DERIVATIVE_WIDTHS].sort((a, b) => a - b))
  })
})
