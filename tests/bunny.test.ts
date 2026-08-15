import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv('BUNNY_STORAGE_API', 'https://storage.example')
  vi.stubEnv('BUNNY_STORAGE_ZONE', 'woomakis')
  vi.stubEnv('BUNNY_STORAGE_PASSWORD', 'pw-test')
  vi.stubEnv('BUNNY_PULL_ZONE_URL', 'https://woomakis.b-cdn.net')
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllEnvs())

describe('bunny storage', () => {
  it('PUTs to zone-scoped path with the AccessKey header', async () => {
    const { bunnyUpload } = await import('@/lib/bunny')
    fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => '' })
    await bunnyUpload('products/abc/original.jpg', Buffer.from('x'), 'image/jpeg')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://storage.example/woomakis/products/abc/original.jpg')
    expect((init as RequestInit).method).toBe('PUT')
    expect(new Headers((init as RequestInit).headers).get('accesskey')).toBe('pw-test')
  })

  it('returns the pull-zone CDN url for a key', async () => {
    const { cdnUrlFor } = await import('@/lib/bunny')
    expect(cdnUrlFor('products/abc/original.jpg'))
      .toBe('https://woomakis.b-cdn.net/products/abc/original.jpg')
  })

  it('throws on a failed upload rather than returning silently', async () => {
    const { bunnyUpload } = await import('@/lib/bunny')
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' })
    await expect(bunnyUpload('k', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(/401/)
  })

  it('rejects keys containing traversal segments', async () => {
    const { bunnyUpload } = await import('@/lib/bunny')
    await expect(bunnyUpload('../escape.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a missing object as not existing instead of throwing', async () => {
    const { bunnyExists } = await import('@/lib/bunny')
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => '' })
    expect(await bunnyExists('products/none.jpg')).toBe(false)
  })
})
