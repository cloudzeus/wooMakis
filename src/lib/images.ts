import { createHash } from 'node:crypto'
import sharp from 'sharp'

/** Widths generated for every mirrored image, ascending. */
export const DERIVATIVE_WIDTHS = [320, 640, 1280] as const

/**
 * SHA-256 of the original bytes. This is the dedupe key and what makes re-sync
 * idempotent: identical bytes produce an identical storage key, so a second run
 * uploads nothing.
 */
export function contentHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function extensionFor(url: string): string {
  const withoutQuery = url.split('?')[0]
  const match = /\.([a-z0-9]+)$/i.exec(withoutQuery)
  return match ? match[1].toLowerCase() : 'jpg'
}

export function storageKeyFor(hash: string, variant: 'original' | number, ext: string): string {
  return `products/${hash}/${variant}.${ext}`
}

export type Derivative = { width: number; format: 'webp' | 'avif'; body: Buffer; key: string }

export async function buildDerivatives(hash: string, original: Buffer): Promise<Derivative[]> {
  const meta = await sharp(original).metadata()
  const out: Derivative[] = []

  for (const width of DERIVATIVE_WIDTHS) {
    // Never upscale — a 320px source should not become a blurry 1280px file.
    if (meta.width && meta.width < width) continue
    for (const format of ['webp', 'avif'] as const) {
      const body = await sharp(original).resize({ width })[format]().toBuffer()
      out.push({ width, format, body, key: storageKeyFor(hash, width, format) })
    }
  }
  return out
}

export async function imageDimensions(bytes: Buffer): Promise<{ width?: number; height?: number }> {
  const meta = await sharp(bytes).metadata()
  return { width: meta.width, height: meta.height }
}
