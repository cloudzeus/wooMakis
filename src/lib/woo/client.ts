import { BRAND_FIELDS, CATEGORY_FIELDS, PRODUCT_FIELDS, VARIATION_FIELDS, fieldParam } from '@/lib/woo/fields'
import type { WooBrand, WooCategory, WooProduct, WooVariation } from '@/lib/woo/types'

export class WooHttpError extends Error {
  constructor(readonly status: number, readonly url: string, readonly body: string) {
    super(`Woo HTTP ${status} for ${url}: ${body.slice(0, 200)}`)
    this.name = 'WooHttpError'
  }
}

type ListOptions = { perPage?: number; maxPages?: number; params?: Record<string, string> }

function config() {
  const baseUrl = process.env.WOO_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.WOO_CONSUMER_KEY
  const secret = process.env.WOO_CONSUMER_SECRET
  if (!baseUrl || !key || !secret) {
    throw new Error('Λείπουν ρυθμίσεις WooCommerce (WOO_BASE_URL / WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET).')
  }
  return { baseUrl, auth: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }
}

/**
 * Paginated GET. `_fields` is applied by the caller and is never optional —
 * requesting the full object 500s on the source site (see lib/woo/fields.ts).
 */
async function listAll<T>(
  resource: string,
  fields: readonly string[],
  { perPage = 100, maxPages = 50, params = {} }: ListOptions = {},
): Promise<T[]> {
  const { baseUrl, auth } = config()
  const out: T[] = []

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    const url = new URL(`${baseUrl}/wp-json/wc/v3/${resource}`)
    url.searchParams.set('per_page', String(perPage))
    url.searchParams.set('page', String(pageNo))
    url.searchParams.set('_fields', fieldParam(fields))
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    const res = await fetch(url.toString(), {
      headers: { authorization: auth, accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new WooHttpError(res.status, url.toString(), await res.text().catch(() => ''))

    const batch = (await res.json()) as T[]
    out.push(...batch)

    const totalPages = Number(res.headers.get('x-wp-totalpages') ?? '1')
    if (pageNo >= totalPages) break
  }
  return out
}

export function listCategories(opts?: ListOptions): Promise<WooCategory[]> {
  return listAll<WooCategory>('products/categories', CATEGORY_FIELDS, opts)
}

export function listProducts(opts?: ListOptions): Promise<WooProduct[]> {
  return listAll<WooProduct>('products', PRODUCT_FIELDS, opts)
}

export function listBrands(opts?: ListOptions): Promise<WooBrand[]> {
  return listAll<WooBrand>('products/brands', BRAND_FIELDS, opts)
}

export function listVariations(productId: number, opts?: ListOptions): Promise<WooVariation[]> {
  return listAll<WooVariation>(`products/${productId}/variations`, VARIATION_FIELDS, opts)
}
