'use server'

import { prisma } from '@/lib/prisma'
import { readCart } from '@/lib/cart'
import { createWooOrder, findCustomerIdByEmail, ordersEnabled, type OrderLineInput } from '@/lib/woo/orders'

export type CheckoutForm = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address1: string
  address2: string
  city: string
  postcode: string
  country: string
  note: string
}

export type CheckoutResult =
  | { ok: true; paymentUrl: string; orderNumber: string }
  | { ok: false; error: string }

function validate(f: CheckoutForm): string | null {
  if (!f.firstName.trim()) return 'Συμπλήρωσε το όνομα.'
  if (!f.lastName.trim()) return 'Συμπλήρωσε το επώνυμο.'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return 'Το email δεν είναι έγκυρο.'
  if (!f.phone.trim()) return 'Συμπλήρωσε τηλέφωνο — χρειάζεται για την παράδοση.'
  if (!f.address1.trim()) return 'Συμπλήρωσε τη διεύθυνση.'
  if (!f.city.trim()) return 'Συμπλήρωσε την πόλη.'
  if (!/^\d{5}$/.test(f.postcode.replace(/\s/g, ''))) return 'Ο Τ.Κ. πρέπει να έχει 5 ψηφία.'
  return null
}

/**
 * Creates the order in WooCommerce and returns its payment_url.
 *
 * The customer is then redirected to WooCommerce's own payment page, where they
 * choose Eurobank / PayPal / αντικαταβολή and pay. No card data passes through
 * this application at any point.
 */
export async function placeOrder(form: CheckoutForm): Promise<CheckoutResult> {
  const invalid = validate(form)
  if (invalid) return { ok: false, error: invalid }

  if (!ordersEnabled()) {
    return {
      ok: false,
      error: 'Οι παραγγελίες είναι προσωρινά απενεργοποιημένες (WOO_ALLOW_ORDERS≠true).',
    }
  }

  const cart = await readCart('el')
  if (!cart.lines.length) return { ok: false, error: 'Το καλάθι είναι άδειο.' }

  // Resolve each local product back to its WooCommerce post id. Greek by
  // preference — a translation created locally has no wooId and cannot be
  // ordered, so it is rejected rather than silently dropped from the order.
  const products = await prisma.product.findMany({
    where: { id: { in: cart.lines.map(l => l.productId) } },
    include: { translations: { select: { locale: true, wooId: true } } },
  })

  const lineItems: OrderLineInput[] = []
  for (const line of cart.lines) {
    const product = products.find(p => p.id === line.productId)
    const wooId =
      product?.translations.find(t => t.locale === 'el' && t.wooId)?.wooId
      ?? product?.translations.find(t => t.wooId)?.wooId
    if (!wooId) {
      return { ok: false, error: `Το προϊόν «${line.name}» δεν είναι διαθέσιμο για παραγγελία.` }
    }
    lineItems.push({ product_id: wooId, quantity: line.quantity })
  }

  const email = form.email.trim().toLowerCase()
  const billing = {
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    address_1: form.address1.trim(),
    address_2: form.address2.trim(),
    city: form.city.trim(),
    postcode: form.postcode.replace(/\s/g, ''),
    country: form.country || 'GR',
    email,
    phone: form.phone.trim(),
  }

  try {
    // Link repeat buyers to their existing account rather than creating another
    // guest record for the same person.
    const customerId = await findCustomerIdByEmail(email)

    const order = await createWooOrder({
      billing,
      lineItems,
      customerId,
      customerNote: form.note.trim(),
    })

    // The cart is deliberately NOT cleared here. The order is still unpaid; if
    // the customer abandons the payment page, emptying their cart would lose
    // the basket they were about to buy.
    return { ok: true, paymentUrl: order.payment_url, orderNumber: order.number }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
