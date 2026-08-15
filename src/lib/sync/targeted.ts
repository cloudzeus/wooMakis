import { prisma } from '@/lib/prisma'
import { WooHttpError } from '@/lib/woo/client'
import {
  ORDER_DETAIL_FIELDS, PRODUCT_FIELDS, CUSTOMER_FIELDS, fieldParam,
} from '@/lib/woo/fields'
import type { WooOrder, WooProduct } from '@/lib/woo/types'
import { persistProductUpserts, toProductUpserts } from '@/lib/sync/products'
import { upsertOrderFromWoo } from '@/lib/sync/orders'
import { upsertCustomerFromWoo } from '@/lib/sync/customers'

/**
 * Sync exactly one object, named by a webhook.
 *
 * The first version of the webhook worker answered every event with a full
 * catalogue pull. That is minutes of work for a one-field edit, it hammers
 * mylens.gr, and it cannot finish inside the window the runtime keeps a
 * request alive after responding — so it was killed halfway and nothing was
 * ever marked done.
 *
 * A webhook already tells us which object changed. Fetching that one object
 * takes a few hundred milliseconds and reuses the same writers as the full
 * sync, so the two cannot drift apart.
 */

function config() {
  const baseUrl = process.env.WOO_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.WOO_CONSUMER_KEY
  const secret = process.env.WOO_CONSUMER_SECRET
  if (!baseUrl || !key || !secret) throw new Error('Λείπουν ρυθμίσεις WooCommerce.')
  return { baseUrl, auth: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }
}

async function fetchOne<T>(resource: string, id: number, fields: readonly string[]): Promise<T | null> {
  const { baseUrl, auth } = config()
  const url = new URL(`${baseUrl}/wp-json/wc/v3/${resource}/${id}`)
  url.searchParams.set('_fields', fieldParam(fields))

  const res = await fetch(url.toString(), {
    headers: { authorization: auth, accept: 'application/json' },
    cache: 'no-store',
  })

  // A deleted object 404s. That is a normal outcome for a `.deleted` webhook
  // and must not be treated as a failure to retry.
  if (res.status === 404) return null
  if (!res.ok) throw new WooHttpError(res.status, url.toString(), await res.text().catch(() => ''))
  return (await res.json()) as T
}

export type TargetedResult = { synced: boolean; detail: string }

/**
 * Syncs a product and its whole translation group.
 *
 * Polylang makes each language a separate post, and the group is what this
 * application stores as one Product. So a change to the Greek post has to pull
 * the English one too, or the pair falls out of step.
 */
export async function syncProduct(wooId: number): Promise<TargetedResult> {
  const post = await fetchOne<WooProduct>('products', wooId, PRODUCT_FIELDS)

  if (!post) {
    // Deleted upstream. The local row is left alone rather than cascaded away:
    // orders reference products, and a hard delete here would strip the link
    // from historical orders that are still perfectly valid.
    return { synced: false, detail: `product ${wooId} not found upstream (deleted?)` }
  }

  const siblings = Object.values(post.translations ?? {})
    .map(Number)
    .filter(id => Number.isFinite(id) && id !== wooId)

  const group: WooProduct[] = [post]
  for (const id of siblings) {
    const t = await fetchOne<WooProduct>('products', id, PRODUCT_FIELDS)
    if (t) group.push(t)
  }

  const result = await persistProductUpserts(toProductUpserts(group))
  return {
    synced: true,
    detail: `product group ${wooId} (${group.length} languages): ${result.created} created, ${result.updated} updated`,
  }
}

export async function syncOrder(wooId: number): Promise<TargetedResult> {
  const order = await fetchOne<WooOrder>('orders', wooId, ORDER_DETAIL_FIELDS)
  if (!order) return { synced: false, detail: `order ${wooId} not found upstream` }

  await upsertOrderFromWoo(order)
  return { synced: true, detail: `order ${wooId} updated` }
}

export async function syncCustomer(wooId: number): Promise<TargetedResult> {
  const customer = await fetchOne<Record<string, unknown>>('customers', wooId, CUSTOMER_FIELDS)
  if (!customer) return { synced: false, detail: `customer ${wooId} not found upstream` }

  await upsertCustomerFromWoo(customer as never)
  return { synced: true, detail: `customer ${wooId} updated` }
}

/** Removes a product's local row when WooCommerce says it is gone for good. */
export async function markProductDeleted(wooId: number): Promise<TargetedResult> {
  const translation = await prisma.productTranslation.findFirst({ where: { wooId } })
  if (!translation) return { synced: false, detail: `product ${wooId} was not mirrored` }

  // Unpublished rather than deleted: the storefront stops showing it, and any
  // order line that points at it keeps working.
  await prisma.product.update({
    where: { id: translation.productId },
    data: { status: 'draft' },
  })
  return { synced: true, detail: `product ${wooId} set to draft (deleted upstream)` }
}
