import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { requirePermission } from '@/lib/rbac-server'
import { isDeepSeekConfigured } from '@/lib/deepseek'
import { readGate } from '@/lib/woo/write'
import { BrandEditor } from './brand-editor'

export const dynamic = 'force-dynamic'

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requirePermission('brand.view')

  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      translations: { orderBy: { locale: 'asc' } },
      _count: { select: { products: true } },
    },
  })
  if (!brand) notFound()

  return (
    <section className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href="/brands" className="hover:text-foreground">Μάρκες</Link>
        <span className="mx-1">/</span>
        <span>{brand.translations.find(t => t.locale === 'el')?.name ?? brand.id}</span>
      </nav>

      <BrandEditor
        id={brand.id}
        subtitle={`Woo group #${brand.wooGroupKey} · ${brand._count.products} προϊόντα`}
        translations={brand.translations.map(t => ({
          locale: t.locale,
          wooId: t.wooId,
          name: t.name,
          slug: t.slug,
          description: t.description ?? '',
        }))}
        gate={readGate()}
        canEdit={can(session, 'brand.edit')}
        canPush={can(session, 'sync.push')}
        deepseekReady={isDeepSeekConfigured()}
      />
    </section>
  )
}
