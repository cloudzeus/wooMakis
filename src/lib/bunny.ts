/**
 * Bunny Storage raw HTTP API (PUT/GET/DELETE with an AccessKey header). There is
 * no S3 client dependency here, matching the idiom used in the damask reference.
 *
 * NOTE: the storage zone name is lowercase `woomakis`. The capitalised form
 * returns HTTP 401.
 */
function config() {
  const storageApi = process.env.BUNNY_STORAGE_API?.replace(/\/+$/, '')
  const zone = process.env.BUNNY_STORAGE_ZONE
  const password = process.env.BUNNY_STORAGE_PASSWORD
  const pullZone = process.env.BUNNY_PULL_ZONE_URL?.replace(/\/+$/, '')
  if (!storageApi || !zone || !password || !pullZone) {
    throw new Error('Λείπουν ρυθμίσεις BunnyCDN (BUNNY_STORAGE_* / BUNNY_PULL_ZONE_URL).')
  }
  return { storageApi, zone, password, pullZone }
}

function assertSafeKey(key: string): string {
  const trimmed = key.replace(/^\/+/, '')
  if (!trimmed || trimmed.includes('..')) throw new Error(`Μη έγκυρο storage key: ${key}`)
  return trimmed
}

function objectUrl(key: string): string {
  const { storageApi, zone } = config()
  return `${storageApi}/${zone}/${assertSafeKey(key)}`
}

export function cdnUrlFor(key: string): string {
  const { pullZone } = config()
  return `${pullZone}/${assertSafeKey(key)}`
}

export async function bunnyUpload(key: string, body: Buffer, contentType: string): Promise<string> {
  const url = objectUrl(key)
  const { password } = config()
  const res = await fetch(url, {
    method: 'PUT',
    headers: { AccessKey: password, 'Content-Type': contentType },
    body: new Uint8Array(body),
  })
  if (!res.ok) {
    throw new Error(`Bunny upload ${res.status} για ${key}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  }
  return cdnUrlFor(key)
}

export async function bunnyExists(key: string): Promise<boolean> {
  const res = await fetch(objectUrl(key), {
    method: 'GET',
    headers: { AccessKey: config().password },
  })
  return res.ok
}
