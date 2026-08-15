import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { can } from '@/lib/rbac'
import { NAV_ITEMS } from '@/lib/nav'
import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const items = NAV_ITEMS.filter(i => can(session, i.permission))

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar name={session.user.name} role={session.user.role} />
      <div className="flex flex-1">
        <Sidebar items={items} />
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  )
}
