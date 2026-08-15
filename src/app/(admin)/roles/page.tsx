import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { requirePermission } from '@/lib/rbac-server'
import { PERMISSIONS, SYSTEM_ROLE_NAMES } from '@/lib/permissions'
import { RolesMatrix, type PermRow, type RoleCol } from './roles-matrix'

export const dynamic = 'force-dynamic'

/** Groups the matrix by the part of the key before the dot. */
const GROUP_LABELS: Record<string, string> = {
  product: 'Προϊόντα',
  category: 'Κατηγορίες',
  brand: 'Μάρκες',
  media: 'Πολυμέσα',
  customer: 'Πελάτες',
  order: 'Παραγγελίες',
  sync: 'Συγχρονισμός',
  user: 'Χρήστες',
  role: 'Ρόλοι',
  settings: 'Ρυθμίσεις',
}

export default async function RolesPage() {
  const session = await requirePermission('role.manage')

  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  })

  const permissions: PermRow[] = PERMISSIONS.map(p => ({
    key: p.key,
    description: p.description,
    group: GROUP_LABELS[p.key.split('.')[0]] ?? 'Άλλα',
  }))

  const cols: RoleCol[] = roles.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    system: SYSTEM_ROLE_NAMES.has(r.name),
    userCount: r._count.users,
    // SUPER_ADMIN is all-powerful by definition rather than by grant rows, so
    // the matrix shows it as such instead of reflecting whatever the join
    // table happens to hold.
    granted: r.name === 'SUPER_ADMIN'
      ? PERMISSIONS.map(p => p.key)
      : r.permissions.map(rp => rp.permission.key),
  }))

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Ρόλοι και δικαιώματα</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ποιος μπορεί τι. Η αλλαγή δικαιωμάτων απαιτεί ρόλο SUPER_ADMIN, ώστε να μην
          μπορεί κανείς να δώσει στον εαυτό του περισσότερη πρόσβαση απ&apos; όση έχει.
        </p>
      </header>

      <RolesMatrix
        permissions={permissions}
        roles={cols}
        canManage={can(session, 'role.manage') && session.user.role === 'SUPER_ADMIN'}
      />
    </section>
  )
}
