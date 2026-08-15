'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { bunnyUpload, cdnUrlFor } from '@/lib/bunny'
import { contentHash } from '@/lib/images'
import {
  MAX_EDGE, isImage, isVideo, processImage, processVideo,
} from '@/lib/media-processing'

export type MediaResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

/** 512 MB. Videos are re-encoded server-side, so the ceiling is generous. */
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Normalises an upload and stores it on Bunny.
 *
 * Images become WebP capped at 1920px on the longest edge. Video becomes
 * H.264/AAC MP4, same cap, CRF 26, faststart. Both are content-addressed by the
 * hash of the PROCESSED bytes, so re-uploading the same source file twice
 * resolves to one asset instead of two.
 */
export async function uploadMedia(formData: FormData): Promise<MediaResult> {
  await requirePermission('media.upload')

  const file = formData.get('file')
  const title = String(formData.get('title') ?? '').trim()
  const altText = String(formData.get('altText') ?? '').trim()

  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Δεν επιλέχθηκε αρχείο.' }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Το αρχείο ξεπερνά τα ${humanSize(MAX_UPLOAD_BYTES)}.` }
  }

  const image = isImage(file.type)
  const video = isVideo(file.type)
  if (!image && !video) {
    return { ok: false, error: 'Επιτρέπονται μόνο εικόνες και βίντεο.' }
  }

  const input = Buffer.from(await file.arrayBuffer())

  let body: Buffer
  let mimeType: string
  let ext: string
  let width: number
  let height: number
  let duration: number | null = null

  try {
    if (image) {
      const r = await processImage(input)
      ;({ body, mimeType, ext, width, height } = r)
    } else {
      const r = await processVideo(input, file.name)
      ;({ body, mimeType, ext, width, height } = r)
      duration = r.durationSeconds
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const hash = contentHash(body)
  const existing = await prisma.mediaAsset.findUnique({ where: { contentHash: hash } })
  if (existing) {
    return { ok: true, message: 'Το αρχείο υπάρχει ήδη στη βιβλιοθήκη (ίδιο περιεχόμενο).' }
  }

  const key = `library/${hash}/original.${ext}`
  try {
    await bunnyUpload(key, body, mimeType)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  await prisma.mediaAsset.create({
    data: {
      contentHash: hash,
      sourceUrl: cdnUrlFor(key), // originated here; Bunny is the source
      storageKey: key,
      cdnUrl: cdnUrlFor(key),
      mimeType,
      bytes: body.byteLength,
      width: width || null,
      height: height || null,
      derivatives: duration !== null ? { durationSeconds: duration } : undefined,
      mirroredAt: new Date(),
      kind: 'LIBRARY',
      title: title || file.name,
      altText: altText || null,
    },
  })

  const saved = input.byteLength - body.byteLength
  const pct = Math.round((saved / input.byteLength) * 100)
  revalidatePath('/media')

  return {
    ok: true,
    message:
      `${image ? 'Εικόνα' : 'Βίντεο'} ${humanSize(input.byteLength)} → ${humanSize(body.byteLength)}` +
      `${saved > 0 ? ` (${pct}% μικρότερο)` : ''}, ${width}×${height}, max ${MAX_EDGE}px.`,
  }
}

export async function updateMedia(
  id: string,
  fields: { title: string; altText: string },
): Promise<MediaResult> {
  await requirePermission('media.upload')
  await prisma.mediaAsset.update({
    where: { id },
    data: { title: fields.title.trim() || null, altText: fields.altText.trim() || null },
  })
  revalidatePath('/media')
  return { ok: true, message: 'Αποθηκεύτηκε.' }
}

/**
 * Assigns an asset to a named storefront position. The slot is unique, so this
 * clears it from whatever held it before rather than leaving two claimants.
 */
export async function assignSlot(id: string, slot: string | null): Promise<MediaResult> {
  await requirePermission('settings.manage')

  if (slot) {
    await prisma.mediaAsset.updateMany({ where: { slot }, data: { slot: null } })
  }
  await prisma.mediaAsset.update({ where: { id }, data: { slot } })

  revalidatePath('/media')
  revalidatePath('/')
  return { ok: true, message: slot ? `Ορίστηκε στη θέση «${slot}».` : 'Αφαιρέθηκε από τη θέση.' }
}

/**
 * Removes the database record. The Bunny object is deliberately left in place:
 * content-addressed keys are shared, and another asset or a cached page may
 * still reference the same bytes.
 */
export async function deleteMedia(id: string): Promise<MediaResult> {
  await requirePermission('media.delete')

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  })
  if (!asset) return { ok: false, error: 'Δεν βρέθηκε.' }
  if (asset.kind === 'PRODUCT' || asset._count.products > 0) {
    return { ok: false, error: 'Χρησιμοποιείται σε προϊόν και δεν διαγράφεται από εδώ.' }
  }

  await prisma.mediaAsset.delete({ where: { id } })
  revalidatePath('/media')
  return { ok: true, message: 'Διαγράφηκε από τη βιβλιοθήκη (το αρχείο παραμένει στο Bunny).' }
}
