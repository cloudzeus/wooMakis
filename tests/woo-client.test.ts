import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FORBIDDEN_FIELDS } from '@/lib/woo/fields'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv('WOO_BASE_URL', 'https://example.test')
  vi.stubEnv('WOO_CONSUMER_KEY', 'ck_test')
  vi.stubEnv('WOO_CONSUMER_SECRET', 'cs_test')
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllEnvs())

function page(body: unknown, total = '1', totalPages = '1') {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'x-wp-total': total, 'x-wp-totalpages': totalPages }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

describe('woo client', () => {
  it('always sends a _fields parameter that excludes the crashing fields', async () => {
    const { listCategories } = await import('@/lib/woo/client')
    fetchMock.mockResolvedValue(page([]))
    await listCategories()
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    const fields = url.searchParams.get('_fields')
    expect(fields).toBeTruthy()
    for (const f of FORBIDDEN_FIELDS) expect(fields!.split(',')).not.toContain(f)
  })

  it('sends basic auth built from the env credentials', async () => {
    const { listCategories } = await import('@/lib/woo/client')
    fetchMock.mockResolvedValue(page([]))
    await listCategories()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const auth = new Headers(init.headers).get('authorization')
    expect(auth).toBe(`Basic ${Buffer.from('ck_test:cs_test').toString('base64')}`)
  })

  it('follows pagination until totalPages is reached', async () => {
    const { listCategories } = await import('@/lib/woo/client')
    fetchMock
      .mockResolvedValueOnce(page([{ id: 1 }], '2', '2'))
      .mockResolvedValueOnce(page([{ id: 2 }], '2', '2'))
    const all = await listCategories()
    expect(all.map((c: { id: number }) => c.id)).toEqual([1, 2])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops at maxPages rather than looping forever', async () => {
    const { listCategories } = await import('@/lib/woo/client')
    fetchMock.mockResolvedValue(page([{ id: 1 }], '10000', '100'))
    await listCategories({ maxPages: 3 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws a typed error carrying the status on a non-ok response', async () => {
    const { listCategories, WooHttpError } = await import('@/lib/woo/client')
    fetchMock.mockResolvedValue({
      ok: false, status: 500, headers: new Headers(),
      text: async () => 'critical error', json: async () => ({}),
    })
    await expect(listCategories()).rejects.toBeInstanceOf(WooHttpError)
  })

  it('exposes no mutation method — this phase is read-only', async () => {
    const mod = await import('@/lib/woo/client')
    for (const name of Object.keys(mod)) {
      expect(name).not.toMatch(/^(create|update|delete|put|post|patch)/i)
    }
  })
})
