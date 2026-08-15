import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

/**
 * Storefront customer sessions.
 *
 * Deliberately separate from the admin session (Auth.js, staff only). Two
 * reasons, and both matter:
 *
 *  - A shared session would put a shopper and an administrator in the same
 *    token namespace. One bug in role handling then becomes a privilege
 *    escalation rather than a display glitch.
 *  - The admin session carries a permission array refreshed against the
 *    database every 60 seconds. A customer session needs none of that, and
 *    paying for it on every storefront request would be waste.
 *
 * A customer signing in here is NOT signing in to WooCommerce. WordPress
 * password hashes cannot be verified through the REST API, so an existing
 * customer sets a password here the first time and is matched to their order
 * history by email.
 */

const COOKIE = 'WOOMAKIS_CUSTOMER'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days
const ISSUER = 'woomakis'
const AUDIENCE = 'storefront'

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET
  if (!value) throw new Error('Λείπει το AUTH_SECRET — δεν μπορεί να υπογραφεί session.')
  return new TextEncoder().encode(value)
}

export type CustomerSession = {
  accountId: string
  customerId: string
  email: string
  name: string
}

export async function createCustomerSession(session: CustomerSession): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())

  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
}

/**
 * Reads and verifies the session.
 *
 * The account is re-checked against the database on every call rather than
 * trusted from the token: a deactivated account must stop working immediately,
 * not in thirty days when the token happens to expire.
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE })
    const accountId = String(payload.accountId ?? '')
    if (!accountId) return null

    const account = await prisma.customerAccount.findUnique({
      where: { id: accountId },
      include: { customer: { select: { id: true, NAME: true } } },
    })
    if (!account || !account.active) return null

    return {
      accountId: account.id,
      customerId: account.customerId,
      email: account.email,
      name: account.customer.NAME,
    }
  } catch {
    // Expired, tampered with, or signed with a rotated secret. All three mean
    // "not signed in" and none of them should surface as an error page.
    return null
  }
}

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
}

export function checkPassword(password: string): string | null {
  if (password.length < 8) return 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.'
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Ο κωδικός πρέπει να έχει γράμματα και αριθμούς.'
  }
  return null
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Short-lived permission to view one specific order, issued after a successful
 * guest lookup.
 *
 * Without it the order page would be a bearer URL: whoever holds the id sees
 * the order, and ids leak through referrers, browser history and shared links.
 * The grant is a signed cookie naming exactly the orders that were looked up,
 * so a URL on its own is not enough.
 */
const ORDER_GRANT_COOKIE = 'WOOMAKIS_ORDER_ACCESS'
const ORDER_GRANT_MAX_AGE = 60 * 60 // one hour

export async function grantOrderAccess(orderId: string): Promise<void> {
  const store = await cookies()
  const existing = await readOrderGrants()
  // Cap the list so a scripted sequence of lookups cannot grow the cookie
  // without bound; the newest grant is the one that matters.
  const ids = [orderId, ...existing.filter(id => id !== orderId)].slice(0, 10)

  const token = await new SignJWT({ ids })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${ORDER_GRANT_MAX_AGE}s`)
    .sign(secret())

  store.set(ORDER_GRANT_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ORDER_GRANT_MAX_AGE,
  })
}

async function readOrderGrants(): Promise<string[]> {
  const store = await cookies()
  const token = store.get(ORDER_GRANT_COOKIE)?.value
  if (!token) return []
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE })
    return Array.isArray(payload.ids) ? payload.ids.map(String) : []
  } catch {
    return []
  }
}

export async function hasOrderAccess(orderId: string): Promise<boolean> {
  return (await readOrderGrants()).includes(orderId)
}
