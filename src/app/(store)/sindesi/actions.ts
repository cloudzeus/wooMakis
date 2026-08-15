'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  checkPassword, createCustomerSession, destroyCustomerSession,
  grantOrderAccess, hashPassword, verifyPassword,
} from '@/lib/customer-auth'

export type AuthResult = { ok: false; error: string }

/** Deliberately identical for "no such account" and "wrong password". */
const BAD_CREDENTIALS = 'Λάθος email ή κωδικός.'

function normaliseEmail(v: string): string {
  return v.trim().toLowerCase()
}

export async function signInCustomer(form: { email: string; password: string }): Promise<AuthResult> {
  const email = normaliseEmail(form.email)

  const account = await prisma.customerAccount.findUnique({
    where: { email },
    include: { customer: { select: { id: true, NAME: true } } },
  })

  // Both branches must cost roughly the same: returning early on a missing
  // account makes the response time a reliable account-existence oracle.
  const hash = account?.passwordHash
    ?? '$2a$12$0000000000000000000000000000000000000000000000000000'
  const valid = await verifyPassword(form.password, hash)

  if (!account || !valid) return { ok: false, error: BAD_CREDENTIALS }
  if (!account.active) return { ok: false, error: 'Ο λογαριασμός είναι ανενεργός.' }

  await prisma.customerAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
  })

  await createCustomerSession({
    accountId: account.id,
    customerId: account.customerId,
    email: account.email,
    name: account.customer.NAME,
  })
  redirect('/logariasmos')
}

/**
 * Creates an account, attaching it to the existing customer record when the
 * email is already known.
 *
 * 466 customers were ingested from WooCommerce, 436 of them guests who never
 * had an account anywhere. Matching on email is what lets someone who has
 * bought before see that history the moment they register, instead of starting
 * from an empty dashboard next to their own past orders.
 */
export async function registerCustomer(form: {
  name: string
  email: string
  password: string
}): Promise<AuthResult> {
  const email = normaliseEmail(form.email)
  const name = form.name.trim()

  if (!name) return { ok: false, error: 'Συμπλήρωσε το ονοματεπώνυμό σου.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Μη έγκυρο email.' }

  const pwError = checkPassword(form.password)
  if (pwError) return { ok: false, error: pwError }

  if (await prisma.customerAccount.findUnique({ where: { email } })) {
    return {
      ok: false,
      error: 'Υπάρχει ήδη λογαριασμός με αυτό το email. Δοκίμασε σύνδεση.',
    }
  }

  const existing = await prisma.customer.findFirst({ where: { EMAIL: email } })

  const customer = existing ?? await prisma.customer.create({
    data: { source: 'LOCAL', NAME: name, EMAIL: email },
  })

  const account = await prisma.customerAccount.create({
    data: {
      customerId: customer.id,
      email,
      passwordHash: await hashPassword(form.password),
    },
  })

  await createCustomerSession({
    accountId: account.id,
    customerId: customer.id,
    email,
    name: customer.NAME,
  })
  redirect('/logariasmos')
}

export async function signOutCustomer(): Promise<void> {
  await destroyCustomerSession()
  redirect('/')
}

export type LookupResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string }

/**
 * Guest order lookup: email plus order number, no account.
 *
 * 436 of the customers here bought as guests and have no account to sign in
 * to. Without this they would have no way at all to see an order, and the
 * alternative — emailing a link — needs mail infrastructure this deployment
 * does not have.
 */
export async function lookupOrder(form: {
  email: string
  number: string
}): Promise<LookupResult> {
  const email = normaliseEmail(form.email)
  const number = form.number.trim().replace(/^#/, '')

  if (!email || !number) return { ok: false, error: 'Συμπλήρωσε email και αριθμό παραγγελίας.' }

  const order = await prisma.order.findFirst({
    where: { number, email },
    select: { id: true },
  })

  // One message for "no such order" and "wrong email", so the form cannot be
  // used to test which email addresses have ordered.
  if (!order) {
    return { ok: false, error: 'Δεν βρέθηκε παραγγελία με αυτά τα στοιχεία.' }
  }

  // The order page checks this grant, so the id alone does not open it.
  await grantOrderAccess(order.id)
  return { ok: true, orderId: order.id }
}
