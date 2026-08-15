import { describe, it, expect } from 'vitest'
import { slugify, transliterateGreek, uniqueSlug } from '@/lib/slug'

describe('slugify', () => {
  it('does not return an empty slug for an all-Greek name', () => {
    // The bug this exists to prevent: NFD + [^a-z0-9] strips Greek entirely,
    // and a product with an empty slug has no reachable page.
    expect(slugify('Δοκιμαστικό Προϊόν Ελέγχου')).toBe('dokimastiko-proion-elenchou')
  })

  it('keeps Latin names working', () => {
    expect(slugify('Acuvue Oasys for Astigmatism')).toBe('acuvue-oasys-for-astigmatism')
  })

  it('strips Latin accents', () => {
    expect(slugify('Café Frappé')).toBe('cafe-frappe')
  })

  it('handles Greek digraphs before single letters', () => {
    expect(transliterateGreek('μπουκάλι')).toBe('boukali')
    expect(transliterateGreek('ευχαριστώ')).toBe('evcharisto')
  })

  it('falls back rather than returning an empty string', () => {
    expect(slugify('!!! ---')).toBe('item')
    expect(slugify('', 'product')).toBe('product')
  })

  it('never leaves a trailing separator', () => {
    expect(slugify('Προϊόν —')).not.toMatch(/-$/)
  })

  it('is deterministic', () => {
    expect(slugify('Φακοί Επαφής')).toBe(slugify('Φακοί Επαφής'))
  })
})

describe('uniqueSlug', () => {
  it('returns the base when free', async () => {
    expect(await uniqueSlug('lens', async () => false)).toBe('lens')
  })

  it('appends a counter on collision', async () => {
    const used = new Set(['lens', 'lens-2'])
    expect(await uniqueSlug('lens', async c => used.has(c))).toBe('lens-3')
  })
})
