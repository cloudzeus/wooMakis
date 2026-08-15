import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PERMISSIONS, ROLE_DEFAULTS, SYSTEM_ROLE_NAMES } from '../src/lib/permissions'
import { prisma } from '../src/lib/prisma'

async function main() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    })
  }

  for (const [name, permKeys] of Object.entries(ROLE_DEFAULTS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, system: SYSTEM_ROLE_NAMES.has(name) },
    })
    const perms = await prisma.permission.findMany({ where: { key: { in: permKeys } } })
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: perms.map(p => ({ roleId: role.id, permissionId: p.id })),
      }),
    ])
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } })
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password) throw new Error('SEED_ADMIN_PASSWORD δεν έχει οριστεί στο .env')

  await prisma.user.upsert({
    where: { email: 'gkozyris@i4ria.com' },
    update: {},
    create: {
      email: 'gkozyris@i4ria.com',
      name: 'Giannis Kozyris',
      passwordHash: await bcrypt.hash(password, 12),
      roleId: superAdminRole.id,
    },
  })
  console.log('Seed ολοκληρώθηκε. Admin: gkozyris@i4ria.com (SUPER_ADMIN)')
}

main()
  .catch(e => { console.error('Seed απέτυχε:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
