'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getOrCreateCart } from '@/lib/cart'

export type CartActionResult = { ok: true; itemCount: number } | { ok: false; error: string }

const MAX_QTY = 99

export async function addToCart(productId: string, quantity = 1): Promise<CartActionResult> {
  if (quantity < 1) return { ok: false, error: 'Μη έγκυρη ποσότητα.' }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, price: true, status: true, stockStatus: true },
  })
  if (!product) return { ok: false, error: 'Το προϊόν δεν βρέθηκε.' }
  if (product.status !== 'publish') return { ok: false, error: 'Το προϊόν δεν είναι διαθέσιμο.' }
  if (product.stockStatus === 'outofstock') return { ok: false, error: 'Το προϊόν είναι εξαντλημένο.' }

  const cartId = await getOrCreateCart()

  const existing = await prisma.cartLine.findUnique({
    where: { cartId_productId: { cartId, productId } },
  })
  const nextQty = Math.min((existing?.quantity ?? 0) + quantity, MAX_QTY)

  await prisma.cartLine.upsert({
    where: { cartId_productId: { cartId, productId } },
    update: { quantity: nextQty },
    // addedPrice is a record of what the customer saw, kept for support
    // questions only. Totals always re-read the live price.
    create: { cartId, productId, quantity: nextQty, addedPrice: product.price },
  })

  revalidatePath('/kalathi')
  revalidatePath('/')
  return { ok: true, itemCount: await countFor(cartId) }
}

export async function setQuantity(productId: string, quantity: number): Promise<CartActionResult> {
  const cartId = await getOrCreateCart()

  if (quantity <= 0) {
    await prisma.cartLine.deleteMany({ where: { cartId, productId } })
  } else {
    await prisma.cartLine.updateMany({
      where: { cartId, productId },
      data: { quantity: Math.min(quantity, MAX_QTY) },
    })
  }

  revalidatePath('/kalathi')
  return { ok: true, itemCount: await countFor(cartId) }
}

export async function removeFromCart(productId: string): Promise<CartActionResult> {
  const cartId = await getOrCreateCart()
  await prisma.cartLine.deleteMany({ where: { cartId, productId } })
  revalidatePath('/kalathi')
  return { ok: true, itemCount: await countFor(cartId) }
}

export async function clearCart(): Promise<CartActionResult> {
  const cartId = await getOrCreateCart()
  await prisma.cartLine.deleteMany({ where: { cartId } })
  revalidatePath('/kalathi')
  return { ok: true, itemCount: 0 }
}

async function countFor(cartId: string): Promise<number> {
  const agg = await prisma.cartLine.aggregate({ where: { cartId }, _sum: { quantity: true } })
  return agg._sum.quantity ?? 0
}
