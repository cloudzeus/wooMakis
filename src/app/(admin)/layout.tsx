import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { can } from '@/lib/rbac'
import { NAV_GROUPS } from '@/lib/nav'
import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  // Filter items first, then drop any group left with nothing in it, so an
  // empty heading never advertises a section the user cannot open.
  const groups = NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => can(session, i.permission)) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar name={session.user.name} role={session.user.role} />
      <div className="flex flex-1">
        <Sidebar groups={groups} />
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  )
}
