import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { runFullPull } from '../src/lib/sync/run'

const withImages = !process.argv.includes('--no-images')

runFullPull({ withImages })
  .then(r => {
    console.log('Κατηγορίες:', r.categories)
    console.log('Προϊόντα:  ', r.products)
    console.log('Εικόνες:   ', r.images)
  })
  .catch(e => { console.error('Ο συγχρονισμός απέτυχε:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
