import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { readGate } from '@/lib/woo/write'
import { NewProductForm, type Option } from './new-product-form'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requirePermission('product.edit')

  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ include: { translations: true }, orderBy: { menuOrder: 'asc' } }),
    prisma.brand.findMany({ include: { translations: true } }),
  ])

  const label = (translations: { locale: string; name: string }[]) =>
    translations.find(t => t.locale === 'el')?.name ?? translations[0]?.name ?? '—'

  const categoryOptions: Option[] = categories
    .map(c => ({ id: c.id, name: label(c.translations) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'el'))

  const brandOptions: Option[] = brands
    .map(b => ({ id: b.id, name: label(b.translations) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'el'))

  const gate = readGate()

  return (
    <section className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">Προϊόντα</Link>
        <span className="mx-1">/</span>
        <span>Νέο προϊόν</span>
      </nav>

      <header>
        <h1 className="font-display text-xl font-semibold">Νέο προϊόν</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Δημιουργία στον τοπικό κατάλογο. Εικόνες και χαρακτηριστικά προστίθενται
          μετά, από τη σελίδα του προϊόντος.
        </p>
      </header>

      <NewProductForm
        categories={categoryOptions}
        brands={brandOptions}
        writesLocked={!gate.allowWrites || gate.dryRun}
      />
    </section>
  )
}
