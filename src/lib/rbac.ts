import type { Session } from 'next-auth'

/** Pure and client-safe — must never import from '@/auth'. */
export function can(session: Session | null, permission: string): boolean {
  return !!session?.user?.permissions?.includes(permission)
}
