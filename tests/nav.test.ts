import { describe, it, expect } from 'vitest'
import type { Session } from 'next-auth'
import { NAV_ITEMS } from '@/lib/nav'
import { can } from '@/lib/rbac'
import { ROLE_DEFAULTS, PERMISSIONS } from '@/lib/permissions'

/**
 * The sidebar filters itself by permission in (admin)/layout.tsx. These assert
 * that filtering actually restricts, rather than only that it runs — a nav that
 * silently showed every item to every role would still pass a smoke test.
 */
function sessionFor(role: keyof typeof ROLE_DEFAULTS): Session {
  return {
    user: {
      id: 'u1', email: 'a@b.gr', name: 'T',
      role, permissions: ROLE_DEFAULTS[role], trdrId: null,
    },
    expires: '2099-01-01',
  } as Session
}

const visibleTo = (role: keyof typeof ROLE_DEFAULTS) =>
  NAV_ITEMS.filter(i => can(sessionFor(role), i.permission)).map(i => i.href)

describe('nav permission filtering', () => {
  it('shows every item to SUPER_ADMIN', () => {
    expect(visibleTo('SUPER_ADMIN')).toHaveLength(NAV_ITEMS.length)
  })

  it('hides user, role and settings management from VIEWER', () => {
    const hrefs = visibleTo('VIEWER')
    expect(hrefs).not.toContain('/users')
    expect(hrefs).not.toContain('/roles')
    expect(hrefs).not.toContain('/settings')
  })

  it('gives VIEWER only read-only screens', () => {
    expect(visibleTo('VIEWER').sort()).toEqual(
      ['/categories', '/customers', '/dashboard', '/media', '/products', '/sync'].sort(),
    )
  })

  it('hides administration from CATALOG_MANAGER but keeps the catalog', () => {
    const hrefs = visibleTo('CATALOG_MANAGER')
    expect(hrefs).toContain('/products')
    expect(hrefs).toContain('/media')
    expect(hrefs).not.toContain('/roles')
  })

  it('never shows an item whose permission is absent from the registry', () => {
    const known = new Set(PERMISSIONS.map(p => p.key))
    for (const item of NAV_ITEMS) {
      expect(known.has(item.permission), `${item.href} → unknown ${item.permission}`).toBe(true)
    }
  })
})
