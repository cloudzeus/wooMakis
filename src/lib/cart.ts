import 'server-only'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const CART_COOKIE = 'WOOMAKIS_CART'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export type CartLineView = {
  /** Identity of the line, not the product: two eyes are two lines. */
  lineKey: string
  productId: string
  eye: 'RIGHT' | 'LEFT' | 'BOTH'
  selections: Record<string, string>
  name: string
  slug: string
  imageUrl: string | null
  /** Current catalogue price, re-read on every render — never the stored one. */
  unitPrice: number
  regularPrice: number | null
  onSale: boolean
  quantity: number
  lineTotal: number
  stockStatus: string
  permalink: string | null
}

export type CartView = {
  id: string | null
  lines: CartLineView[]
  itemCount: number
  subtotal: number
}

export const EMPTY_CART: CartView = { id: null, lines: [], itemCount: 0, subtotal: 0 }

function newToken(): string {
  return randomBytes(32).toString('hex')
}

/** Reads the cart id from the cookie without creating anything. */
async function currentCartId(): Promise<string | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value
  if (!token) return null
  const cart = await prisma.cart.findUnique({ where: { token }, select: { id: true } })
  return cart?.id ?? null
}

/**
 * Returns the cart for this visitor, creating one if needed. Only call from a
 * Server Action or Route Handler — setting a cookie during a render throws.
 */
export async function getOrCreateCart(): Promise<string> {
  const jar = await cookies()
  const token = jar.get(CART_COOKIE)?.value

  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token }, select: { id: true } })
    if (existing) {
      await prisma.cart.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } })
      return existing.id
    }
  }

  const cart = await prisma.cart.create({ data: { token: newToken() } })
  const fresh = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, select: { token: true } })
  jar.set(CART_COOKIE, fresh.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return cart.id
}

/**
 * Renders the cart. Safe to call during a render — it never creates a cart and
 * never sets a cookie.
 *
 * Prices come from the product row, not from CartLine.addedPrice: a cart that
 * quoted a stale price at checkout is a support problem, and Woo remains the
 * source of truth for what things cost.
 */
export async function readCart(locale = 'el'): Promise<CartView> {
  const cartId = await currentCartId()
  if (!cartId) return EMPTY_CART

  const lines = await prisma.cartLine.findMany({
    where: { cartId },
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        include: {
          translations: true,
          images: { include: { asset: true }, orderBy: { position: 'asc' }, take: 1 },
        },
      },
    },
  })

  const views: CartLineView[] = lines.map(l => {
    const t = l.product.translations.find(x => x.locale === locale) ?? l.product.translations[0]
    const unitPrice = Number(l.product.price ?? 0)
    return {
      lineKey: l.lineKey,
      productId: l.productId,
      eye: l.eye,
      selections: (l.selections as Record<string, string> | null) ?? {},
      name: t?.name ?? '—',
      slug: t?.slug ?? '',
      imageUrl: l.product.images[0]?.asset.cdnUrl ?? null,
      unitPrice,
      regularPrice: l.product.regularPrice ? Number(l.product.regularPrice) : null,
      onSale: l.product.onSale,
      quantity: l.quantity,
      lineTotal: Math.round(unitPrice * l.quantity * 100) / 100,
      stockStatus: l.product.stockStatus,
      permalink: t?.permalink ?? null,
    }
  })

  return {
    id: cartId,
    lines: views,
    itemCount: views.reduce((n, l) => n + l.quantity, 0),
    subtotal: Math.round(views.reduce((n, l) => n + l.lineTotal, 0) * 100) / 100,
  }
}

/** Item count only — for the header badge, without loading every line. */
export async function readCartCount(): Promise<number> {
  const cartId = await currentCartId()
  if (!cartId) return 0
  const agg = await prisma.cartLine.aggregate({ where: { cartId }, _sum: { quantity: true } })
  return agg._sum.quantity ?? 0
}
