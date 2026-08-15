import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { can } from '@/lib/rbac'
import { readGate } from '@/lib/woo/write'
import { normalizeAttributes } from '@/lib/woo/attributes'
import { isDeepSeekConfigured } from '@/lib/deepseek'
import { ProductEditor } from './product-editor'

export const dynamic = 'force-dynamic'

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requirePermission('product.view')

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      translations: { orderBy: { locale: 'asc' } },
      images: { include: { asset: true }, orderBy: { position: 'asc' } },
      categories: { include: { category: { include: { translations: true } } } },
    },
  })
  if (!product) notFound()

  const gate = readGate()

  return (
    <section className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">Προϊόντα</Link>
        <span className="mx-1">/</span>
        <span>{product.translations.find(t => t.locale === 'el')?.name ?? product.sku ?? product.id}</span>
      </nav>

      <ProductEditor
        canEdit={can(session, 'product.edit')}
        canUpload={can(session, 'media.upload')}
        canDelete={can(session, 'media.delete')}
        canPush={can(session, 'sync.push')}
        deepseekReady={isDeepSeekConfigured()}
        gate={gate}
        product={{
          id: product.id,
          wooGroupKey: product.wooGroupKey,
          sku: product.sku ?? '',
          type: product.type,
          status: product.status,
          price: product.price?.toString() ?? '',
          regularPrice: product.regularPrice?.toString() ?? '',
          onSale: product.onSale,
          stockStatus: product.stockStatus,
          stockQuantity: product.stockQuantity,
          categories: product.categories.map(pc =>
            pc.category.translations.find(t => t.locale === 'el')?.name
            ?? pc.category.translations[0]?.name ?? ''),
          translations: product.translations.map(t => ({
            locale: t.locale,
            wooId: t.wooId,
            name: t.name,
            shortDescription: t.shortDescription ?? '',
            permalink: t.permalink,
          })),
          attributes: normalizeAttributes(product.attributes),
          images: product.images.map(pi => ({
            assetId: pi.asset.id,
            cdnUrl: pi.asset.cdnUrl,
            mimeType: pi.asset.mimeType,
            bytes: pi.asset.bytes,
            width: pi.asset.width,
            height: pi.asset.height,
            position: pi.position,
            alt: pi.alt,
          })),
        }}
      />
    </section>
  )
}
