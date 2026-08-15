import { prisma } from '@/lib/prisma'
import { CUSTOMER_FIELDS, ORDER_FIELDS, fieldParam } from '@/lib/woo/fields'
import { WooHttpError } from '@/lib/woo/client'
import type { WooCustomer, WooOrder } from '@/lib/woo/types'

/**
 * Customer pull.
 *
 * mylens.gr has 30 registered customers against 1133 orders, so the great
 * majority of buyers exist only as billing blocks on guest orders. Reading the
 * customers endpoint alone would show a nearly empty screen, so orders are read
 * too and their billing details deduped by email into GUEST records.
 *
 * Guests have no wooCustomerId and are never pushed upstream; they are a local
 * view of people who have actually bought something.
 */

function config() {
  const baseUrl = process.env.WOO_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.WOO_CONSUMER_KEY
  const secret = process.env.WOO_CONSUMER_SECRET
  if (!baseUrl || !key || !secret) throw new Error('Λείπουν ρυθμίσεις WooCommerce.')
  return { baseUrl, auth: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }
}

async function listAll<T>(resource: string, fields: readonly string[], maxPages = 60): Promise<T[]> {
  const { baseUrl, auth } = config()
  const out: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${baseUrl}/wp-json/wc/v3/${resource}`)
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))
    url.searchParams.set('_fields', fieldParam(fields))
    const res = await fetch(url.toString(), {
      headers: { authorization: auth, accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new WooHttpError(res.status, url.toString(), await res.text().catch(() => ''))
    out.push(...((await res.json()) as T[]))
    if (page >= Number(res.headers.get('x-wp-totalpages') ?? '1')) break
  }
  return out
}

function fullName(first?: string, last?: string, company?: string, email?: string): string {
  const person = [first?.trim(), last?.trim()].filter(Boolean).join(' ')
  return person || company?.trim() || email?.trim() || 'Χωρίς όνομα'
}

export type CustomerPullResult = { registered: number; guests: number; updated: number }

/**
 * Writes one registered WooCommerce customer.
 *
 * Extracted so a webhook can sync a single customer through the same code as
 * the bulk pull, rather than a second writer that drifts.
 */
export async function upsertCustomerFromWoo(c: WooCustomer): Promise<{ created: boolean }> {
  const b = c.billing ?? {}
  const data = {
    source: 'WOO' as const,
    NAME: fullName(c.first_name, c.last_name, b.company, c.email),
    firstName: c.first_name || null,
    lastName: c.last_name || null,
    company: b.company || null,
    EMAIL: (c.email || b.email || '').toLowerCase() || null,
    PHONE01: b.phone || null,
    ADDRESS: [b.address_1, b.address_2].filter(Boolean).join(', ') || null,
    CITY: b.city || null,
    ZIP: b.postcode || null,
    DISTRICT: b.state || null,
    COUNTRY: b.country || null,
    wooSnapshot: c as object,
  }

  const existing = await prisma.customer.findUnique({ where: { wooCustomerId: c.id } })
  await prisma.customer.upsert({
    where: { wooCustomerId: c.id },
    update: data,
    create: { wooCustomerId: c.id, ...data },
  })
  return { created: !existing }
}

export async function pullCustomers(): Promise<CustomerPullResult> {
  const [customers, orders] = await Promise.all([
    listAll<WooCustomer>('customers', CUSTOMER_FIELDS),
    listAll<WooOrder>('orders', ORDER_FIELDS),
  ])

  let registered = 0
  let updated = 0

  for (const c of customers) {
    const r = await upsertCustomerFromWoo(c)
    r.created ? registered++ : updated++
  }

  // Guest orders, deduped by lowercased email. Totals are accumulated across
  // every order that email placed, which is what makes the list sortable by value.
  type Agg = {
    billing: NonNullable<WooOrder['billing']>
    orders: number
    spent: number
    last: Date | null
    wooCustomerId: number
  }
  const guests = new Map<string, Agg>()

  for (const o of orders) {
    const email = (o.billing?.email ?? '').trim().toLowerCase()
    if (!email) continue
    const at = o.date_created ? new Date(o.date_created) : null
    const prev = guests.get(email)
    guests.set(email, {
      billing: o.billing!,
      orders: (prev?.orders ?? 0) + 1,
      spent: (prev?.spent ?? 0) + Number(o.total ?? 0),
      last: !prev?.last || (at && at > prev.last) ? at : prev.last,
      wooCustomerId: o.customer_id || prev?.wooCustomerId || 0,
    })
  }

  let guestCount = 0
  for (const [email, g] of guests) {
    const b = g.billing
    const linked = g.wooCustomerId
      ? await prisma.customer.findUnique({ where: { wooCustomerId: g.wooCustomerId } })
      : null
    const byEmail = linked ?? await prisma.customer.findFirst({ where: { EMAIL: email } })

    const stats = {
      orderCount: g.orders,
      totalSpent: g.spent.toFixed(2),
      lastOrderAt: g.last,
    }

    if (byEmail) {
      // A registered customer who also has orders: keep the account, add totals.
      await prisma.customer.update({ where: { id: byEmail.id }, data: stats })
      updated++
      continue
    }

    await prisma.customer.create({
      data: {
        source: 'GUEST',
        NAME: fullName(b.first_name, b.last_name, b.company, email),
        firstName: b.first_name || null,
        lastName: b.last_name || null,
        company: b.company || null,
        EMAIL: email,
        PHONE01: b.phone || null,
        ADDRESS: [b.address_1, b.address_2].filter(Boolean).join(', ') || null,
        CITY: b.city || null,
        ZIP: b.postcode || null,
        DISTRICT: b.state || null,
        COUNTRY: b.country || null,
        ...stats,
      },
    })
    guestCount++
  }

  return { registered, guests: guestCount, updated }
}
