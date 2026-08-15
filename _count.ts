import 'dotenv/config'
import { prisma } from './src/lib/prisma'
async function main() {
  console.log('MediaAsset mirrored:', await prisma.mediaAsset.count({ where: { mirroredAt: { not: null } } }))
}
main().finally(() => prisma.$disconnect())
