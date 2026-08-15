'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getOrCreateCart } from '@/lib/cart'
import { buildLineKey } from '@/lib/lens-attributes'

export type CartActionResult = { ok: true; itemCount: number } | { ok: false; error: string }

export type EyeChoice = 'RIGHT' | 'LEFT' | 'BOTH'

export type LineSelection = {
  eye: EyeChoice
  /** Eye-keyed choices, e.g. {"Βαθμός OD": "+2.00", "Βαθμός OS": "+3.50"}. */
  selections: Record<string, string>
  quantity: number
}

const MAX_QTY = 99

/**
 * Adds lines for a product.
 *
 * A pair of lenses is ONE line: both eyes live in its selections, keyed by eye
 * (e.g. "Βαθμός OD" / "Βαθμός OS"), and the quantity counts pairs. Re-adding the
 * same pair increments it; a different combination of powers is a separate line.
 */
export async function addLinesToCart(
  productId: string,
  lines: LineSelection[],
): Promise<CartActionResult> {
  if (!lines.length) return { ok: false, error: 'Δεν επιλέχθηκε ποσότητα.' }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, price: true, status: true, stockStatus: true, attributes: true },
  })
  if (!product) return { ok: false, error: 'Το προϊόν δεν βρέθηκε.' }
  if (product.status !== 'publish') return { ok: false, error: 'Το προϊόν δεν είναι διαθέσιμο.' }
  if (product.stockStatus === 'outofstock') return { ok: false, error: 'Το προϊόν είναι εξαντλημένο.' }

  const attrs = Array.isArray(product.attributes)
    ? (product.attributes as { name?: string; options?: string[] }[])
    : []
  // Selection keys carry an eye suffix (e.g. "Βαθμός OD"), so match the value
  // against any attribute whose options contain it rather than against an exact
  // name. A tampered request still cannot record a power this lens is not made in.
  const allOptions = new Set(attrs.flatMap(a => a.options ?? []))
  for (const line of lines) {
    for (const [name, value] of Object.entries(line.selections)) {
      if (!allOptions.has(value)) {
        return { ok: false, error: `Μη έγκυρη επιλογή για «${name}».` }
      }
    }
  }

  const cartId = await getOrCreateCart()

  for (const line of lines) {
    const qty = Math.max(1, Math.min(line.quantity, MAX_QTY))
    const lineKey = buildLineKey(productId, line.eye, line.selections)

    const existing = await prisma.cartLine.findUnique({
      where: { cartId_lineKey: { cartId, lineKey } },
    })

    await prisma.cartLine.upsert({
      where: { cartId_lineKey: { cartId, lineKey } },
      update: { quantity: Math.min((existing?.quantity ?? 0) + qty, MAX_QTY) },
      create: {
        cartId,
        productId,
        lineKey,
        eye: line.eye,
        selections: Object.keys(line.selections).length ? line.selections : undefined,
        quantity: qty,
        addedPrice: product.price,
      },
    })
  }

  revalidatePath('/kalathi')
  revalidatePath('/')
  return { ok: true, itemCount: await countFor(cartId) }
}

/** Simple add for products with nothing to choose. */
export async function addToCart(productId: string, quantity = 1): Promise<CartActionResult> {
  return addLinesToCart(productId, [{ eye: 'BOTH', selections: {}, quantity }])
}

export async function setQuantity(lineKey: string, quantity: number): Promise<CartActionResult> {
  const cartId = await getOrCreateCart()

  if (quantity <= 0) {
    await prisma.cartLine.deleteMany({ where: { cartId, lineKey } })
  } else {
    await prisma.cartLine.updateMany({
      where: { cartId, lineKey },
      data: { quantity: Math.min(quantity, MAX_QTY) },
    })
  }

  revalidatePath('/kalathi')
  return { ok: true, itemCount: await countFor(cartId) }
}

export async function removeFromCart(lineKey: string): Promise<CartActionResult> {
  const cartId = await getOrCreateCart()
  await prisma.cartLine.deleteMany({ where: { cartId, lineKey } })
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
