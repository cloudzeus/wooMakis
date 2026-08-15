import { BRAND_FIELDS, CATEGORY_FIELDS, PRODUCT_FIELDS, fieldParam } from '@/lib/woo/fields'
import { WooHttpError } from '@/lib/woo/client'

/**
 * The ONLY module permitted to mutate WooCommerce. Everything here is gated.
 *
 * Three independent gates, all required before a byte leaves the application:
 *   1. WOO_ALLOW_WRITES must be "true"          (default false)
 *   2. WOO_DRY_RUN must be "false"              (default true)
 *   3. The caller must pass confirmed: true     (an explicit human decision)
 *
 * With WOO_ENVIRONMENT=production this targets a live store carrying 1133
 * real orders. A dry run returns the exact payload for inspection and performs
 * no network call at all.
 */

export class WooWriteDisabledError extends Error {
  constructor(reason: string) {
    super(`Η εγγραφή στο WooCommerce είναι απενεργοποιημένη: ${reason}`)
    this.name = 'WooWriteDisabledError'
  }
}

export type WriteGate = {
  allowWrites: boolean
  dryRun: boolean
  environment: string
}

export function readGate(): WriteGate {
  return {
    allowWrites: process.env.WOO_ALLOW_WRITES === 'true',
    dryRun: process.env.WOO_DRY_RUN !== 'false',
    environment: process.env.WOO_ENVIRONMENT ?? 'development',
  }
}

/** The three resources this application is allowed to write. */
export type WooResource = 'products' | 'products/categories' | 'products/brands'

const FIELDS_FOR: Record<WooResource, readonly string[]> = {
  'products': PRODUCT_FIELDS,
  'products/categories': CATEGORY_FIELDS,
  'products/brands': BRAND_FIELDS,
}

export type WritePlan = {
  method: 'PUT'
  resource: WooResource
  wooId: number
  url: string
  body: Record<string, unknown>
  gate: WriteGate
  /** True when this call would actually hit the network. */
  wouldExecute: boolean
}

function config() {
  const baseUrl = process.env.WOO_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.WOO_CONSUMER_KEY
  const secret = process.env.WOO_CONSUMER_SECRET
  if (!baseUrl || !key || !secret) throw new Error('Λείπουν ρυθμίσεις WooCommerce.')
  return { baseUrl, auth: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }
}

/** Builds the plan without sending anything. Safe to call anywhere. */
export function planUpdate(
  resource: WooResource,
  wooId: number,
  body: Record<string, unknown>,
  confirmed = false,
): WritePlan {
  const gate = readGate()
  const { baseUrl } = config()
  return {
    method: 'PUT',
    resource,
    wooId,
    url: `${baseUrl}/wp-json/wc/v3/${resource}/${wooId}`,
    body,
    gate,
    wouldExecute: gate.allowWrites && !gate.dryRun && confirmed,
  }
}

/** Kept as the product-shaped entry point most callers use. */
export function planProductUpdate(
  wooId: number,
  body: Record<string, unknown>,
  confirmed = false,
): WritePlan {
  return planUpdate('products', wooId, body, confirmed)
}

/**
 * Executes a planned update. Throws unless all three gates are open.
 *
 * NOTE ON IMAGES: WooCommerce REPLACES the entire gallery with whatever
 * `images` array it receives. Callers must send the complete desired gallery,
 * never a partial one, or the omitted images are removed from the product.
 *
 * The same wholesale-replacement rule applies to `attributes`.
 */
export async function executeUpdate(plan: WritePlan): Promise<Record<string, unknown>> {
  if (!plan.gate.allowWrites) throw new WooWriteDisabledError('WOO_ALLOW_WRITES=false')
  if (plan.gate.dryRun) throw new WooWriteDisabledError('WOO_DRY_RUN=true')
  if (!plan.wouldExecute) throw new WooWriteDisabledError('δεν επιβεβαιώθηκε από χρήστη')

  const { auth } = config()
  const url = new URL(plan.url)
  url.searchParams.set('_fields', fieldParam(FIELDS_FOR[plan.resource]))

  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify(plan.body),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new WooHttpError(res.status, plan.url, await res.text().catch(() => ''))
  }
  return (await res.json()) as Record<string, unknown>
}

/** Historical name, kept so existing callers do not have to change. */
export const executeProductUpdate = executeUpdate

/**
 * Reads a resource back from WooCommerce.
 *
 * This is a GET, so it is not gated — and that is the point: it is how a push
 * is proved to have landed. WooCommerce's own PUT response echoes the request
 * body, which makes it worthless as evidence; a separate read after the fact
 * is the only thing that shows the store actually changed.
 */
export async function readBack(
  resource: WooResource,
  wooId: number,
): Promise<Record<string, unknown>> {
  const { baseUrl, auth } = config()
  const url = new URL(`${baseUrl}/wp-json/wc/v3/${resource}/${wooId}`)
  url.searchParams.set('_fields', fieldParam(FIELDS_FOR[resource]))

  const res = await fetch(url.toString(), {
    headers: { authorization: auth, accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new WooHttpError(res.status, url.toString(), await res.text().catch(() => ''))
  return (await res.json()) as Record<string, unknown>
}

export type FieldVerdict = {
  field: string
  sent: unknown
  live: unknown
  match: boolean
}

/**
 * Compares what was sent against what the store now reports.
 *
 * Comparison is deliberately loose — Woo normalises as it stores: prices come
 * back as strings with trailing zeros, names get HTML entities, and images
 * return WordPress media ids and rewritten `src` urls rather than the Bunny
 * urls that were sent. So `images` is compared on count alone, prices on
 * numeric value, and text on a trimmed, entity-decoded basis. A false here is
 * a real discrepancy, not a formatting difference.
 */
export function verifyFields(
  sent: Record<string, unknown>,
  live: Record<string, unknown>,
): FieldVerdict[] {
  return Object.keys(sent).map(field => {
    const a = sent[field]
    const b = live[field]
    return { field, sent: a, live: b, match: compare(field, a, b) }
  })
}

function compare(field: string, sent: unknown, live: unknown): boolean {
  // Woo sideloads images to its own media library, so the returned src never
  // equals the Bunny url that was sent. Count is the only stable signal.
  if (field === 'images') {
    return Array.isArray(sent) && Array.isArray(live) && sent.length === live.length
  }

  if (field === 'attributes') {
    if (!Array.isArray(sent) || !Array.isArray(live)) return false
    const key = (a: unknown) => {
      const o = a as { name?: string; options?: unknown[] }
      return `${norm(o.name ?? '')}:${(o.options ?? []).map(x => norm(String(x))).sort().join('|')}`
    }
    return sent.map(key).sort().join('§') === live.map(key).sort().join('§')
  }

  if (field === 'regular_price' || field === 'price') {
    const n = (v: unknown) => (v === '' || v == null ? null : Number(v))
    return n(sent) === n(live)
  }

  return norm(String(sent ?? '')) === norm(String(live ?? ''))
}

function norm(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
