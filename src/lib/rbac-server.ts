import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { can } from '@/lib/rbac'

/** For server components and actions: returns the session or throws. */
export async function requirePermission(permission: string): Promise<Session> {
  const session = await auth()
  if (!can(session, permission)) throw new Error(`Forbidden: απαιτείται ${permission}`)
  return session!
}

/**
 * For actions needing the SUPER_ADMIN role specifically, not merely a permission.
 * Checks the permission first (can they see the screen at all), then the role name.
 */
export async function requireSuperAdmin(permission: string): Promise<Session> {
  const session = await requirePermission(permission)
  if (session.user.role !== 'SUPER_ADMIN') throw new Error('Forbidden: απαιτείται ρόλος SUPER_ADMIN')
  return session
}
