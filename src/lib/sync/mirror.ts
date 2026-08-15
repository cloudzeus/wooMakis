import { prisma } from '@/lib/prisma'
import { bunnyUpload, cdnUrlFor } from '@/lib/bunny'
import { buildDerivatives, contentHash, extensionFor, imageDimensions, storageKeyFor } from '@/lib/images'

export type MirrorResult = {
  mirrored: number
  skipped: number
  failed: number
  /**
   * Every source url this run could resolve, mapped to its asset id.
   *
   * Needed because content-addressing dedupes by BYTES while products reference
   * images by URL: two products carrying the identical photo produce one asset
   * under the first product's url, so the second url resolves to nothing. This
   * map is what lets linkProductImages find it anyway.
   */
  resolved: Map<string, string>
}

/**
 * Downloads each source image, content-hashes it, and uploads the original plus
 * WebP/AVIF derivatives. An asset whose hash is already recorded is skipped
 * without touching the network again — that is what makes re-sync cheap.
 */
export async function mirrorImages(sourceUrls: string[]): Promise<MirrorResult> {
  let mirrored = 0
  let skipped = 0
  let failed = 0
  const resolved = new Map<string, string>()

  for (const sourceUrl of sourceUrls) {
    try {
      const already = await prisma.mediaAsset.findFirst({ where: { sourceUrl, mirroredAt: { not: null } } })
      if (already) { resolved.set(sourceUrl, already.id); skipped++; continue }

      const res = await fetch(sourceUrl)
      if (!res.ok) { failed++; continue }
      const bytes = Buffer.from(await res.arrayBuffer())

      const hash = contentHash(bytes)
      const existing = await prisma.mediaAsset.findUnique({ where: { contentHash: hash } })
      if (existing) {
        // Identical bytes already stored under a different url. Record the
        // alias so this product can still link to it.
        resolved.set(sourceUrl, existing.id)
        skipped++
        continue
      }

      const ext = extensionFor(sourceUrl)
      const mimeType = res.headers.get('content-type') ?? `image/${ext}`
      const originalKey = storageKeyFor(hash, 'original', ext)

      await bunnyUpload(originalKey, bytes, mimeType)
      const derivatives = await buildDerivatives(hash, bytes)
      for (const d of derivatives) {
        await bunnyUpload(d.key, d.body, `image/${d.format}`)
      }
      const { width, height } = await imageDimensions(bytes)

      const created = await prisma.mediaAsset.create({
        data: {
          contentHash: hash, sourceUrl, storageKey: originalKey,
          cdnUrl: cdnUrlFor(originalKey), mimeType, bytes: bytes.byteLength,
          width, height,
          derivatives: derivatives.map(d => ({ width: d.width, format: d.format, key: d.key })),
          mirroredAt: new Date(),
        },
      })
      resolved.set(sourceUrl, created.id)
      mirrored++
    } catch {
      failed++
    }
  }
  return { mirrored, skipped, failed, resolved }
}
