import 'server-only'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

/**
 * Media normalisation for the admin library.
 *
 * Images: re-encoded to WebP, longest edge capped at MAX_EDGE. Video: re-encoded
 * to H.264/AAC in MP4, longest edge capped, CRF-driven so quality holds while
 * size falls.
 *
 * ffmpeg is an external binary, not an npm package. It is present on this
 * machine and installed into the Docker image (see Dockerfile). `hasFfmpeg()`
 * exists so the UI can say so plainly instead of failing at upload time.
 */

/** Longest edge, in pixels. Anything larger is downscaled; nothing is upscaled. */
export const MAX_EDGE = 1920

export type ProcessedImage = {
  body: Buffer
  mimeType: 'image/webp'
  ext: 'webp'
  width: number
  height: number
  originalBytes: number
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const meta = await sharp(input).metadata()

  const body = await sharp(input)
    .rotate() // honour EXIF orientation before resizing, or portraits come out sideways
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true, // a 600px source must not become a soft 1920px file
    })
    .webp({ quality: 82 })
    .toBuffer()

  const out = await sharp(body).metadata()
  return {
    body,
    mimeType: 'image/webp',
    ext: 'webp',
    width: out.width ?? meta.width ?? 0,
    height: out.height ?? meta.height ?? 0,
    originalBytes: input.byteLength,
  }
}

export type ProcessedVideo = {
  body: Buffer
  mimeType: 'video/mp4'
  ext: 'mp4'
  width: number
  height: number
  durationSeconds: number | null
  originalBytes: number
}

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise(resolve => {
    const p = spawn(bin, args)
    let stderr = ''
    p.stderr.on('data', d => { stderr += String(d) })
    p.on('error', () => resolve({ code: -1, stderr: `${bin} not found` }))
    p.on('close', code => resolve({ code: code ?? -1, stderr }))
  })
}

export async function hasFfmpeg(): Promise<boolean> {
  const { code } = await run('ffmpeg', ['-version'])
  return code === 0
}

/**
 * Re-encodes to a web-friendly MP4.
 *
 * ffmpeg reads and writes files rather than streams here: MP4 needs a seekable
 * output to write its moov atom, so piping to stdout produces a file that will
 * not start playing until fully downloaded. `-movflags +faststart` then moves
 * that atom to the front so playback begins immediately.
 */
export async function processVideo(input: Buffer, originalName: string): Promise<ProcessedVideo> {
  if (!(await hasFfmpeg())) {
    throw new Error('Το ffmpeg δεν είναι διαθέσιμο στον server, οπότε δεν μπορεί να γίνει συμπίεση βίντεο.')
  }

  const dir = await mkdtemp(join(tmpdir(), 'woomakis-video-'))
  const inPath = join(dir, `in-${originalName.replace(/[^a-zA-Z0-9.]/g, '_')}`)
  const outPath = join(dir, 'out.mp4')

  try {
    await writeFile(inPath, input)

    const { code, stderr } = await run('ffmpeg', [
      '-i', inPath,
      // Cap the longest edge without upscaling, and force even dimensions —
      // H.264 with yuv420p rejects odd width or height.
      '-vf', `scale='if(gt(iw,ih),min(${MAX_EDGE},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_EDGE},ih))',scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '26',           // visually near-transparent for web, roughly half the size of 23
      '-pix_fmt', 'yuv420p',  // required for Safari and most hardware decoders
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y', outPath,
    ])
    if (code !== 0) {
      throw new Error(`Η συμπίεση βίντεο απέτυχε: ${stderr.split('\n').slice(-4).join(' ').slice(0, 300)}`)
    }

    const body = await readFile(outPath)
    const probe = await probeVideo(outPath)

    return {
      body,
      mimeType: 'video/mp4',
      ext: 'mp4',
      width: probe.width,
      height: probe.height,
      durationSeconds: probe.duration,
      originalBytes: input.byteLength,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function probeVideo(path: string): Promise<{ width: number; height: number; duration: number | null }> {
  return new Promise(resolve => {
    const p = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json', path,
    ])
    let out = ''
    p.stdout.on('data', d => { out += String(d) })
    p.on('error', () => resolve({ width: 0, height: 0, duration: null }))
    p.on('close', () => {
      try {
        const j = JSON.parse(out) as {
          streams?: { width?: number; height?: number }[]
          format?: { duration?: string }
        }
        const s = j.streams?.[0]
        const d = j.format?.duration ? Number(j.format.duration) : null
        resolve({
          width: s?.width ?? 0,
          height: s?.height ?? 0,
          duration: Number.isFinite(d) ? d : null,
        })
      } catch {
        resolve({ width: 0, height: 0, duration: null })
      }
    })
  })
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/')
}

export function isVideo(mime: string): boolean {
  return mime.startsWith('video/')
}
