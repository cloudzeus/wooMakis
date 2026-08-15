'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/rbac-server'
import { PERMISSIONS, SYSTEM_ROLE_NAMES } from '@/lib/permissions'

export type RoleResult = { ok: true; message: string } | { ok: false; error: string }

const VALID = new Set(PERMISSIONS.map(p => p.key))

/**
 * Everything here requires SUPER_ADMIN, not merely role.manage.
 *
 * Granting permissions is the one operation that can manufacture more
 * authority than the caller has; gating it on a permission that could itself
 * be granted makes the whole model circular.
 */

export async function createRole(name: string, description: string): Promise<RoleResult> {
  await requireSuperAdmin('role.manage')

  const clean = name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  if (clean.length < 3) return { ok: false, error: 'Το όνομα ρόλου θέλει τουλάχιστον 3 χαρακτήρες.' }
  if (await prisma.role.findUnique({ where: { name: clean } })) {
    return { ok: false, error: `Υπάρχει ήδη ρόλος «${clean}».` }
  }

  await prisma.role.create({ data: { name: clean, description: description.trim() || null } })
  revalidatePath('/roles')
  return { ok: true, message: `Δημιουργήθηκε ο ρόλος ${clean}. Δεν έχει ακόμα δικαιώματα.` }
}

export async function setRolePermission(
  roleId: string,
  permissionKey: string,
  granted: boolean,
): Promise<RoleResult> {
  const session = await requireSuperAdmin('role.manage')

  if (!VALID.has(permissionKey)) return { ok: false, error: `Άγνωστο δικαίωμα: ${permissionKey}` }

  const role = await prisma.role.findUnique({ where: { id: roleId } })
  if (!role) return { ok: false, error: 'Ο ρόλος δεν βρέθηκε.' }

  // Removing a permission from your own role can lock you out mid-session; the
  // JWT refreshes permissions every 60s and the next navigation would be a 403.
  if (role.name === session.user.role && !granted) {
    return { ok: false, error: 'Δεν μπορείς να αφαιρέσεις δικαίωμα από τον δικό σου ρόλο.' }
  }

  // SUPER_ADMIN is the recovery path when another role is misconfigured. It
  // holds everything by definition and is not editable.
  if (role.name === 'SUPER_ADMIN') {
    return { ok: false, error: 'Ο SUPER_ADMIN έχει πάντα όλα τα δικαιώματα και δεν τροποποιείται.' }
  }

  const permission = await prisma.permission.findUnique({ where: { key: permissionKey } })
  if (!permission) return { ok: false, error: `Το δικαίωμα ${permissionKey} λείπει από τη βάση.` }

  if (granted) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
      update: {},
      create: { roleId, permissionId: permission.id },
    })
  } else {
    await prisma.rolePermission.deleteMany({ where: { roleId, permissionId: permission.id } })
  }

  revalidatePath('/roles')
  revalidatePath('/users')
  return {
    ok: true,
    message: `${granted ? 'Δόθηκε' : 'Αφαιρέθηκε'} το «${permissionKey}» ${granted ? 'στον' : 'από τον'} ${role.name}.`,
  }
}

export async function deleteRole(roleId: string): Promise<RoleResult> {
  await requireSuperAdmin('role.manage')

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  })
  if (!role) return { ok: false, error: 'Ο ρόλος δεν βρέθηκε.' }
  if (SYSTEM_ROLE_NAMES.has(role.name)) {
    return { ok: false, error: `Ο ${role.name} είναι ρόλος συστήματος και δεν διαγράφεται.` }
  }
  if (role._count.users > 0) {
    return {
      ok: false,
      error: `Ο ρόλος έχει ${role._count.users} χρήστες. Μετακίνησέ τους πρώτα σε άλλον ρόλο.`,
    }
  }

  await prisma.role.delete({ where: { id: roleId } })
  revalidatePath('/roles')
  return { ok: true, message: `Ο ρόλος ${role.name} διαγράφηκε.` }
}
