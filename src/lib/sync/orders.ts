import { prisma } from '@/lib/prisma'
import { WooHttpError } from '@/lib/woo/client'
import { ORDER_DETAIL_FIELDS, fieldParam } from '@/lib/woo/fields'
import { decodeEntities } from '@/lib/woo/translation-groups'
import { parseEpoPrescription } from '@/lib/woo/epo'
import type { WooOrder, WooOrderLine } from '@/lib/woo/types'

/**
 * Order pull.
 *
 * Read-only and one-directional. Orders are created upstream — the storefront
 * posts them to WooCommerce and redirects to its payment page — so WooCommerce
 * is the source of truth and this mirror exists only so the admin can search
 * and report without hammering the REST API.
 *
 * Line-item meta is what makes this worth storing: the prescription lives
 * there and nowhere else, because power is a plain attribute on this shop
 * rather than a variation.
 */

function config() {
  const baseUrl = process.env.WOO_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.WOO_CONSUMER_KEY
  const secret = process.env.WOO_CONSUMER_SECRET
  if (!baseUrl || !key || !secret) throw new Error('Λείπουν ρυθμίσεις WooCommerce.')
  return { baseUrl, auth: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }
}

export type OrderPullResult = {
  fetched: number
  created: number
  updated: number
  linesWritten: number
  linkedToCustomer: number
  linkedToProduct: number
}

/**
 * WooCommerce hides cancelled and trashed orders from the default listing, so
 * `status=any` is passed explicitly. Without it a pull silently under-reports
 * and the totals never reconcile.
 */
const STATUS = 'any'

/** Meta keys WooCommerce uses internally. Never shown, never stored. */
function isInternal(key: string): boolean {
  return key.startsWith('_')
}

/**
 * The prescription plus any plain meta, merged.
 *
 * Two sources, because this store has two eras of orders: the Extra Product
 * Options plugin buried the prescription in `_tmcartepo_data` on every
 * historical order, while ordinary line meta is what an order placed through
 * this application writes. Reading only the second showed 2087 of 2088 lines
 * as having no prescription at all.
 */
function readableMeta(line: WooOrderLine): Record<string, string> | undefined {
  const out: Record<string, string> = { ...parseEpoPrescription(line.meta_data) }

  for (const m of line.meta_data ?? []) {
    if (!m.key || isInternal(m.key)) continue
    // display_key/display_value are the human-facing pair the plugin renders;
    // fall back to the raw pair when a plugin does not set them.
    const k = decodeEntities(String(m.display_key ?? m.key).trim())
    const v = decodeEntities(String(m.display_value ?? m.value ?? '').replace(/<[^>]+>/g, '')).trim()
    if (k && v && !(k in out)) out[k] = v
  }

  return Object.keys(out).length ? out : undefined
}

/**
 * WordPress stores gateway titles and product names HTML-encoded, so
 * "Debit & Credit Cards" arrives as "Debit &amp; Credit Cards" and renders
 * that way in a React text node, which escapes rather than decodes.
 */
function text(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s ? decodeEntities(s) : null
}

function dec(v: string | undefined): string {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

/**
 * Writes one order and its lines.
 *
 * Extracted so a webhook can sync a single order through exactly the same code
 * as the full pull — a second writer is how the two quietly start disagreeing
 * about a field.
 *
 * The lookup maps are optional: the bulk pull builds them once for 1133
 * orders, while a single-order sync resolves the two ids it needs directly.
 */
export async function upsertOrderFromWoo(
  o: WooOrder,
  maps?: {
    productByWooId: Map<number, string>
    customerByWooId: Map<number, string>
    customerByEmail: Map<string, string>
  },
): Promise<{ created: boolean; lines: number; linkedToProduct: number }> {
  const b = o.billing ?? {}
  const email = (b.email ?? '').trim().toLowerCase() || null

  let customerId: string | null = null
  if (maps) {
    customerId =
      (o.customer_id ? maps.customerByWooId.get(o.customer_id) : undefined)
      ?? (email ? maps.customerByEmail.get(email) : undefined)
      ?? null
  } else {
    const found = o.customer_id
      ? await prisma.customer.findUnique({ where: { wooCustomerId: o.customer_id }, select: { id: true } })
      : email
        ? await prisma.customer.findFirst({ where: { EMAIL: email }, select: { id: true } })
        : null
    customerId = found?.id ?? null
  }

  const data = {
    number: o.number ?? String(o.id),
    status: o.status ?? 'pending',
    currency: o.currency || 'EUR',
    total: dec(o.total),
    totalTax: dec(o.total_tax),
    shippingTotal: dec(o.shipping_total),
    discountTotal: dec(o.discount_total),
    paymentMethod: o.payment_method || null,
    paymentMethodTitle: text(o.payment_method_title),
    transactionId: o.transaction_id || null,
    wooCustomerId: o.customer_id || null,
    customerId,
    billingName:
      text([b.first_name, b.last_name].filter(Boolean).join(' '))
      ?? text(b.company) ?? email ?? 'Χωρίς όνομα',
    email,
    phone: b.phone || null,
    city: text(b.city),
    customerNote: text(o.customer_note),
    datePaid: o.date_paid ? new Date(o.date_paid) : null,
    dateCreated: o.date_created ? new Date(o.date_created) : new Date(),
    dateModified: o.date_modified ? new Date(o.date_modified) : null,
    wooSnapshot: o as object,
    syncedAt: new Date(),
  }

  const existing = await prisma.order.findUnique({ where: { wooId: o.id }, select: { id: true } })
  const order = await prisma.order.upsert({
    where: { wooId: o.id },
    update: data,
    create: { wooId: o.id, ...data },
  })

  // Lines are replaced rather than merged: WooCommerce reissues line ids when
  // an order is edited, so merging leaves orphans that inflate the total.
  await prisma.orderLine.deleteMany({ where: { orderId: order.id } })

  let lines = 0
  let linkedToProduct = 0
  for (const l of o.line_items ?? []) {
    let productId: string | null = null
    if (l.product_id) {
      productId = maps
        ? maps.productByWooId.get(l.product_id) ?? null
        : (await prisma.productTranslation.findFirst({
            where: { wooId: l.product_id }, select: { productId: true },
          }))?.productId ?? null
    }
    if (productId) linkedToProduct++

    await prisma.orderLine.create({
      data: {
        orderId: order.id,
        wooLineId: l.id,
        name: text(l.name) ?? 'Χωρίς όνομα',
        sku: l.sku || null,
        quantity: l.quantity ?? 1,
        subtotal: dec(l.subtotal),
        total: dec(l.total),
        wooProductId: l.product_id || null,
        wooVariationId: l.variation_id || null,
        productId,
        meta: readableMeta(l),
      },
    })
    lines++
  }

  return { created: !existing, lines, linkedToProduct }
}

export async function pullOrders({ maxPages = 40 } = {}): Promise<OrderPullResult> {
  const { baseUrl, auth } = config()

  // Built once: 214 products against 1133 orders, so resolving each line by
  // query would be thousands of round trips to the database.
  const productByWooId = new Map<number, string>()
  for (const t of await prisma.productTranslation.findMany({
    where: { wooId: { not: null } },
    select: { wooId: true, productId: true },
  })) {
    if (t.wooId) productByWooId.set(t.wooId, t.productId)
  }

  const customers = await prisma.customer.findMany({
    select: { id: true, wooCustomerId: true, EMAIL: true },
  })
  const customerByWooId = new Map<number, string>()
  const customerByEmail = new Map<string, string>()
  for (const c of customers) {
    if (c.wooCustomerId) customerByWooId.set(c.wooCustomerId, c.id)
    if (c.EMAIL) customerByEmail.set(c.EMAIL.toLowerCase(), c.id)
  }

  const result: OrderPullResult = {
    fetched: 0, created: 0, updated: 0,
    linesWritten: 0, linkedToCustomer: 0, linkedToProduct: 0,
  }

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${baseUrl}/wp-json/wc/v3/orders`)
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))
    url.searchParams.set('status', STATUS)
    url.searchParams.set('orderby', 'id')
    url.searchParams.set('order', 'asc')
    url.searchParams.set('_fields', fieldParam(ORDER_DETAIL_FIELDS))

    const res = await fetch(url.toString(), {
      headers: { authorization: auth, accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new WooHttpError(res.status, url.toString(), await res.text().catch(() => ''))

    const orders = (await res.json()) as WooOrder[]
    result.fetched += orders.length

    for (const o of orders) {
      const r = await upsertOrderFromWoo(o, { productByWooId, customerByWooId, customerByEmail })
      r.created ? result.created++ : result.updated++
      result.linesWritten += r.lines
      result.linkedToProduct += r.linkedToProduct
      if (o.customer_id || o.billing?.email) result.linkedToCustomer++
    }

    if (page >= Number(res.headers.get('x-wp-totalpages') ?? '1')) break
  }

  return result
}

/**
 * Recomputes each customer's order count, spend and last order date from the
 * mirrored orders.
 *
 * The customer pull estimates these from the orders endpoint at the time it
 * runs; once real orders are stored, they are the better source. Cancelled,
 * refunded and failed orders are excluded from spend but still counted, which
 * is what "how many times have they ordered" usually means to whoever is
 * asking.
 */
export async function recomputeCustomerTotals(): Promise<{ updated: number }> {
  const NON_REVENUE = ['cancelled', 'refunded', 'failed', 'trash']

  const grouped = await prisma.order.groupBy({
    by: ['customerId'],
    where: { customerId: { not: null } },
    _count: { _all: true },
    _max: { dateCreated: true },
  })

  let updated = 0
  for (const g of grouped) {
    if (!g.customerId) continue
    const spend = await prisma.order.aggregate({
      where: { customerId: g.customerId, status: { notIn: NON_REVENUE } },
      _sum: { total: true },
    })
    await prisma.customer.update({
      where: { id: g.customerId },
      data: {
        orderCount: g._count._all,
        totalSpent: spend._sum.total ?? 0,
        lastOrderAt: g._max.dateCreated,
      },
    })
    updated++
  }
  return { updated }
}
