'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePermission, requireSuperAdmin } from '@/lib/rbac-server'

export type UserResult = { ok: true; message: string } | { ok: false; error: string }

const MIN_PASSWORD = 10

function checkPassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Ο κωδικός πρέπει να έχει τουλάχιστον ${MIN_PASSWORD} χαρακτήρες.`
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Ο κωδικός πρέπει να έχει γράμματα και αριθμούς.'
  return null
}

export async function createUser(input: {
  name: string
  email: string
  password: string
  roleId: string
}): Promise<UserResult> {
  await requirePermission('user.manage')

  const email = input.email.trim().toLowerCase()
  if (!input.name.trim()) return { ok: false, error: 'Συμπλήρωσε όνομα.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Μη έγκυρο email.' }

  const pwError = checkPassword(input.password)
  if (pwError) return { ok: false, error: pwError }

  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, error: 'Υπάρχει ήδη χρήστης με αυτό το email.' }
  }

  await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash: await bcrypt.hash(input.password, 12),
      roleId: input.roleId,
    },
  })

  revalidatePath('/users')
  return { ok: true, message: `Δημιουργήθηκε ο χρήστης ${email}.` }
}

/**
 * Role changes require SUPER_ADMIN, not merely user.manage: an ADMIN who could
 * hand out roles could promote themselves.
 */
export async function setUserRole(userId: string, roleId: string): Promise<UserResult> {
  const session = await requireSuperAdmin('user.manage')

  if (userId === session.user.id) {
    return { ok: false, error: 'Δεν μπορείς να αλλάξεις τον δικό σου ρόλο.' }
  }

  const role = await prisma.role.findUnique({ where: { id: roleId } })
  if (!role) return { ok: false, error: 'Ο ρόλος δεν βρέθηκε.' }

  await prisma.user.update({ where: { id: userId }, data: { roleId } })
  revalidatePath('/users')
  return { ok: true, message: `Ο ρόλος άλλαξε σε ${role.name}.` }
}

export async function setUserActive(userId: string, active: boolean): Promise<UserResult> {
  const session = await requirePermission('user.manage')

  if (userId === session.user.id) {
    return { ok: false, error: 'Δεν μπορείς να απενεργοποιήσεις τον εαυτό σου.' }
  }

  // Losing every super admin would lock everyone out of role management.
  if (!active) {
    const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } })
    if (target?.role.name === 'SUPER_ADMIN') {
      const remaining = await prisma.user.count({
        where: { active: true, role: { name: 'SUPER_ADMIN' }, NOT: { id: userId } },
      })
      if (remaining === 0) {
        return { ok: false, error: 'Είναι ο τελευταίος ενεργός SUPER_ADMIN και δεν απενεργοποιείται.' }
      }
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { active } })
  revalidatePath('/users')
  return { ok: true, message: active ? 'Ο χρήστης ενεργοποιήθηκε.' : 'Ο χρήστης απενεργοποιήθηκε.' }
}

export async function resetUserPassword(userId: string, password: string): Promise<UserResult> {
  await requirePermission('user.manage')

  const pwError = checkPassword(password)
  if (pwError) return { ok: false, error: pwError }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  })
  revalidatePath('/users')
  return { ok: true, message: 'Ο κωδικός άλλαξε.' }
}
