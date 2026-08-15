import 'server-only'
import { WooHttpError } from '@/lib/woo/client'

/**
 * Order creation in WooCommerce.
 *
 * WooCommerce is the system of record for orders and customers, so checkout
 * creates the order there rather than here. Crucially the order is created
 * UNPAID (`set_paid: false`) and WooCommerce returns a `payment_url` — the
 * customer is redirected to that page and pays with whichever of the site's
 * configured gateways they choose (Eurobank, PayPal, αντικαταβολή, …).
 *
 * NO CARD DATA EVER REACHES THIS APPLICATION. There is no card field in this
 * codebase, nothing to log, and no PCI scope — not even SAQ-A. That is the
 * entire reason for the redirect rather than a ported gateway integration.
 *
 * Gated separately from WOO_ALLOW_WRITES: that flag guards admin-initiated
 * pushes of catalogue data, which are dangerous because they overwrite. This is
 * customer-initiated creation of new records, a different risk profile, so it
 * gets its own switch rather than being forced to share one.
 */

export class OrdersDisabledError extends Error {
  constructor() {
    super('Η δημιουργία παραγγελιών είναι απενεργοποιημένη (WOO_ALLOW_ORDERS≠true).')
    this.name = 'OrdersDisabledError'
  }
}

export function ordersEnabled(): boolean {
  return process.env.WOO_ALLOW_ORDERS === 'true'
}

export type OrderAddress = {
  first_name: string
  last_name: string
  company?: string
  address_1: string
  address_2?: string
  city: string
  postcode: string
  country: string
  state?: string
  email?: string
  phone?: string
}

export type OrderLineInput = {
  /** The WooCommerce post id of the product (a translation's wooId). */
  product_id: number
  /** Set for a variable product's chosen variation. */
  variation_id?: number
  quantity: number
}

export type CreatedOrder = {
  id: number
  number: string
  status: string
  total: string
  currency: string
  /** Where to send the customer to pay. Present while the order is unpaid. */
  payment_url: string
  order_key: string
}

function config() {
  const baseUrl = process.env.WOO_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.WOO_CONSUMER_KEY
  const secret = process.env.WOO_CONSUMER_SECRET
  if (!baseUrl || !key || !secret) throw new Error('Λείπουν ρυθμίσεις WooCommerce.')
  return { baseUrl, auth: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }
}

export type CreateOrderInput = {
  billing: OrderAddress
  shipping?: OrderAddress
  lineItems: OrderLineInput[]
  customerNote?: string
  /** Woo customer id when known; 0 (the default) means a guest order. */
  customerId?: number
}

export async function createWooOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  if (!ordersEnabled()) throw new OrdersDisabledError()

  const { baseUrl, auth } = config()

  const body = {
    // Deliberately unpaid and with no payment_method: the customer chooses one
    // on WooCommerce's own payment page, which is what keeps cards out of here.
    set_paid: false,
    status: 'pending',
    customer_id: input.customerId ?? 0,
    billing: input.billing,
    shipping: input.shipping ?? input.billing,
    line_items: input.lineItems,
    customer_note: input.customerNote ?? '',
    // Marks provenance so these are distinguishable from orders placed on the
    // original storefront.
    meta_data: [{ key: '_woomakis_source', value: 'storefront' }],
  }

  const url = `${baseUrl}/wp-json/wc/v3/orders`
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw new WooHttpError(res.status, url, await res.text().catch(() => ''))

  const order = (await res.json()) as CreatedOrder
  if (!order.payment_url) {
    throw new Error(`Η παραγγελία #${order.id} δημιουργήθηκε αλλά δεν επέστρεψε payment_url.`)
  }
  return order
}

/**
 * Finds an existing WooCommerce customer by email, so repeat buyers are linked
 * to their account rather than accumulating duplicate guest records.
 * Returns 0 when no account exists — a valid customer_id meaning "guest".
 */
export async function findCustomerIdByEmail(email: string): Promise<number> {
  const { baseUrl, auth } = config()
  const url = new URL(`${baseUrl}/wp-json/wc/v3/customers`)
  url.searchParams.set('email', email)
  url.searchParams.set('per_page', '1')
  url.searchParams.set('_fields', 'id,email')

  const res = await fetch(url.toString(), {
    headers: { authorization: auth, accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return 0
  const list = (await res.json()) as { id: number }[]
  return list[0]?.id ?? 0
}
