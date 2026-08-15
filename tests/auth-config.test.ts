import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

const findUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))

const { verifyCredentials } = await import('@/auth.config')

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'a@b.gr',
    name: 'Test',
    passwordHash: bcrypt.hashSync('correct-horse', 4),
    active: true,
    trdrId: null,
    role: { name: 'SUPER_ADMIN', permissions: [{ permission: { key: 'product.view' } }] },
    ...over,
  }
}

beforeEach(() => findUnique.mockReset())

describe('verifyCredentials', () => {
  it('returns a payload for a valid email and password', async () => {
    findUnique.mockResolvedValue(userRow())
    const r = await verifyCredentials('a@b.gr', 'correct-horse')
    expect(r).toMatchObject({ id: 'u1', role: 'SUPER_ADMIN', permissions: ['product.view'] })
  })

  it('returns null for a wrong password', async () => {
    findUnique.mockResolvedValue(userRow())
    expect(await verifyCredentials('a@b.gr', 'wrong')).toBeNull()
  })

  it('returns null for an unknown email', async () => {
    findUnique.mockResolvedValue(null)
    expect(await verifyCredentials('nobody@b.gr', 'correct-horse')).toBeNull()
  })

  it('returns null for a deactivated user even with the right password', async () => {
    findUnique.mockResolvedValue(userRow({ active: false }))
    expect(await verifyCredentials('a@b.gr', 'correct-horse')).toBeNull()
  })
})
