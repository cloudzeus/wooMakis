import { PRODUCT_FIELDS, fieldParam } from '@/lib/woo/fields'
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

export type WritePlan = {
  method: 'PUT'
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
export function planProductUpdate(
  wooId: number,
  body: Record<string, unknown>,
  confirmed = false,
): WritePlan {
  const gate = readGate()
  const { baseUrl } = config()
  return {
    method: 'PUT',
    url: `${baseUrl}/wp-json/wc/v3/products/${wooId}`,
    body,
    gate,
    wouldExecute: gate.allowWrites && !gate.dryRun && confirmed,
  }
}

/**
 * Executes a planned update. Throws unless all three gates are open.
 *
 * NOTE ON IMAGES: WooCommerce REPLACES the entire gallery with whatever
 * `images` array it receives. Callers must send the complete desired gallery,
 * never a partial one, or the omitted images are removed from the product.
 */
export async function executeProductUpdate(plan: WritePlan): Promise<unknown> {
  if (!plan.gate.allowWrites) throw new WooWriteDisabledError('WOO_ALLOW_WRITES=false')
  if (plan.gate.dryRun) throw new WooWriteDisabledError('WOO_DRY_RUN=true')
  if (!plan.wouldExecute) throw new WooWriteDisabledError('δεν επιβεβαιώθηκε από χρήστη')

  const { auth } = config()
  const url = new URL(plan.url)
  url.searchParams.set('_fields', fieldParam(PRODUCT_FIELDS))

  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify(plan.body),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new WooHttpError(res.status, plan.url, await res.text().catch(() => ''))
  }
  return res.json()
}
