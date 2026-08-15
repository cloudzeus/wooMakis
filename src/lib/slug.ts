/**
 * Slugs for a Greek catalog.
 *
 * The obvious implementation — NFD normalise, strip anything outside a-z0-9 —
 * produces an EMPTY string for any all-Greek name, because Greek letters do
 * not decompose to Latin ones. "Δοκιμαστικό Προϊόν" became "". That is not a
 * cosmetic problem: /proionta/[slug] looks products up by slug, so an empty
 * one is a product with no reachable page.
 *
 * So Greek is transliterated first. The mapping follows ELOT 743 closely
 * enough to be recognisable and, more importantly, is deterministic — the same
 * name always yields the same slug, which is what makes a URL stable.
 */

/** Digraphs must be replaced before single letters or they never match. */
const DIGRAPHS: [RegExp, string][] = [
  [/ο[υύ]/g, 'ou'],
  [/α[υύ]/g, 'av'],
  [/ε[υύ]/g, 'ev'],
  [/μπ/g, 'b'],
  [/ντ/g, 'd'],
  [/γκ/g, 'gk'],
  [/γγ/g, 'ng'],
  [/γχ/g, 'nch'],
  [/τσ/g, 'ts'],
  [/τζ/g, 'tz'],
]

const LETTERS: Record<string, string> = {
  α: 'a', ά: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'e', ζ: 'z',
  η: 'i', ή: 'i', θ: 'th', ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i', κ: 'k',
  λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', ό: 'o', π: 'p', ρ: 'r',
  σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'y', ϋ: 'y', ΰ: 'y', φ: 'f',
  χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'o',
}

export function transliterateGreek(input: string): string {
  let s = input.toLowerCase()
  for (const [re, to] of DIGRAPHS) s = s.replace(re, to)
  return s.replace(/[α-ωάέήίόύώϊϋΐΰς]/g, ch => LETTERS[ch] ?? ch)
}

/**
 * A URL segment. Never returns an empty string: a name that transliterates to
 * nothing at all (say, one made entirely of punctuation) falls back to
 * `fallback`, because a blank slug silently collides with every other blank one.
 */
export function slugify(input: string, fallback = 'item'): string {
  const slug = transliterateGreek(input)
    // Latin accents still need the NFD pass — "Café" should become "cafe".
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
    .replace(/-+$/, '')

  return slug || fallback
}

/**
 * Appends -2, -3 … until the slug is unused.
 *
 * `taken` is asked rather than given a list, so the caller can query whichever
 * table it cares about without this module knowing about the database.
 */
export async function uniqueSlug(
  base: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!(await taken(base))) return base
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`
    if (!(await taken(candidate))) return candidate
  }
  // 99 collisions on one name means something is wrong upstream; a timestamp
  // is ugly but terminates and stays unique.
  return `${base}-${Date.now().toString(36)}`
}
