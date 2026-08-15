import { describe, it, expect } from 'vitest'
import { PERMISSIONS, ROLE_DEFAULTS } from '@/lib/permissions'

describe('permission registry', () => {
  it('has unique keys', () => {
    const keys = PERMISSIONS.map(p => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every permission a non-empty description', () => {
    for (const p of PERMISSIONS) expect(p.description.length).toBeGreaterThan(0)
  })

  it('only grants roles permissions that exist in the registry', () => {
    const known = new Set(PERMISSIONS.map(p => p.key))
    for (const [role, keys] of Object.entries(ROLE_DEFAULTS)) {
      for (const k of keys) {
        expect(known.has(k), `role ${role} grants unknown permission ${k}`).toBe(true)
      }
    }
  })

  it('grants SUPER_ADMIN every permission', () => {
    expect(new Set(ROLE_DEFAULTS.SUPER_ADMIN)).toEqual(new Set(PERMISSIONS.map(p => p.key)))
  })

  it('restricts sync.push to SUPER_ADMIN only', () => {
    for (const [role, keys] of Object.entries(ROLE_DEFAULTS)) {
      if (role !== 'SUPER_ADMIN') expect(keys).not.toContain('sync.push')
    }
  })
})
