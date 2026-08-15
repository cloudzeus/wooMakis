import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { UsersTable, type UserRow } from './users-table'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  await requirePermission('user.manage')

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: { role: { include: { _count: { select: { permissions: true } } } } },
    }),
    prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { permissions: true, users: true } } },
    }),
  ])

  const rows: UserRow[] = users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    active: u.active,
    roleId: u.roleId,
    roleName: u.role.name,
    permissionCount: u.role._count.permissions,
    createdAt: u.createdAt.toISOString(),
  }))

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Χρήστες</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} χρήστες προσωπικού. Οι πελάτες δεν έχουν λογαριασμό εδώ,
          συνδέονται στο mylens.gr.
        </p>
      </header>

      <UsersTable
        rows={rows}
        roles={roles.map(r => ({
          id: r.id,
          name: r.name,
          permissionCount: r._count.permissions,
          userCount: r._count.users,
          system: r.system,
        }))}
      />
    </section>
  )
}
