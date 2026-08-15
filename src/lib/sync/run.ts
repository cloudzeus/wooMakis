import { prisma } from '@/lib/prisma'
import { pullCategories } from '@/lib/sync/categories'
import { linkProductImages, pullProducts } from '@/lib/sync/products'
import { mirrorImages } from '@/lib/sync/mirror'

export type FullPullResult = {
  categories: { created: number; updated: number }
  products: { created: number; updated: number }
  images: { mirrored: number; skipped: number; failed: number }
  links: { linked: number; unresolved: number }
}

/** Categories first — products reference them when building category links. */
export async function runFullPull({ withImages = true } = {}): Promise<FullPullResult> {
  const startedAt = new Date()
  const log = await prisma.syncLog.create({
    data: { target: 'catalog', direction: 'PULL', outcome: 'FAILED', startedAt },
  })

  try {
    const categories = await pullCategories()
    const products = await pullProducts()
    const images = withImages
      ? await mirrorImages(products.imageUrls)
      : { mirrored: 0, skipped: 0, failed: 0 }

    // Always relink, even when mirroring was skipped — assets from an earlier
    // run are already present and the products still need their links.
    const links = await linkProductImages(products.imagesByProduct)

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        outcome: images.failed > 0 ? 'PARTIAL' : 'SUCCESS',
        finishedAt: new Date(),
        created: categories.created + products.created,
        updated: categories.updated + products.updated,
        skipped: images.skipped,
        failed: images.failed,
      },
    })
    return { categories, products, images, links }
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { outcome: 'FAILED', finishedAt: new Date(), error: String(err).slice(0, 1000) },
    })
    throw err
  }
}
