import { describe, it, expect } from 'vitest'
import type { Session } from 'next-auth'
import { can } from '@/lib/rbac'

function session(permissions: string[]): Session {
  return {
    user: { id: 'u1', email: 'a@b.gr', name: 'T', role: 'VIEWER', permissions, trdrId: null },
    expires: '2099-01-01',
  } as Session
}

describe('can', () => {
  it('is true when the permission is held', () => {
    expect(can(session(['product.view']), 'product.view')).toBe(true)
  })

  it('is false when the permission is absent', () => {
    expect(can(session(['product.view']), 'product.edit')).toBe(false)
  })

  it('is false for a null session', () => {
    expect(can(null, 'product.view')).toBe(false)
  })

  it('does not treat a prefix match as a grant', () => {
    expect(can(session(['product.view']), 'product')).toBe(false)
  })
})
