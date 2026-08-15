import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readCartCount } from '@/lib/cart'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import { CANVAS, INK, INK_MUTED, TEAL_DEEP } from '@/components/store/tokens'
import type { StoreProduct } from '@/components/store/types'
import { ProductView } from './product-view'

export const dynamic = 'force-dynamic'

type WooAttribute = { name?: string; options?: string[] }

const pick = <T extends { locale: string }>(t: T[]) => t.find(x => x.locale === 'el') ?? t[0]

const INCLUDE = {
  translations: true,
  images: { include: { asset: true }, orderBy: { position: 'asc' as const } },
  categories: { include: { category: { include: { translations: true } } } },
  brands: { include: { brand: { include: { translations: true } } } },
  _count: { select: { variations: true } },
}

type Row = Awaited<ReturnType<typeof loadBySlug>>

async function loadBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { status: 'publish', translations: { some: { slug } } },
    include: INCLUDE,
  })
}

function toStoreProduct(p: NonNullable<Row>): StoreProduct {
  const el = pick(p.translations)
  const en = p.translations.find(t => t.locale === 'en')
  const attrs = Array.isArray(p.attributes) ? (p.attributes as WooAttribute[]) : []
  return {
    id: p.id,
    name: el?.name ?? '',
    nameEn: en?.name ?? null,
    slug: el?.slug ?? '',
    sku: p.sku,
    brand: p.brands[0] ? pick(p.brands[0].brand.translations)?.name ?? null : null,
    categories: p.categories.map(pc => pick(pc.category.translations)?.name ?? '').filter(Boolean),
    price: p.price ? Number(p.price) : null,
    regularPrice: p.regularPrice ? Number(p.regularPrice) : null,
    onSale: p.onSale,
    stockStatus: p.stockStatus,
    type: p.type,
    shortDescription: el?.shortDescription ?? null,
    description: el?.description ?? null,
    permalink: el?.permalink ?? null,
    images: p.images.map(pi => ({ url: pi.asset.cdnUrl, alt: pi.alt })),
    attributes: attrs.filter(a => a.name && a.options?.length).map(a => ({ name: a.name!, options: a.options! })),
    variationCount: p._count.variations,
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = await loadBySlug(decodeURIComponent(slug))
  if (!p) return { title: 'Το προϊόν δεν βρέθηκε | mylens.gr' }

  const el = pick(p.translations)
  const plain = (el?.shortDescription ?? el?.description ?? '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155)

  return {
    title: `${el?.name} | mylens.gr`,
    description: plain || undefined,
    openGraph: {
      title: el?.name,
      description: plain || undefined,
      images: p.images[0] ? [{ url: p.images[0].asset.cdnUrl }] : undefined,
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { locale } = await getT()
  const customer = await getCustomerSession()

  const { slug } = await params
  const row = await loadBySlug(decodeURIComponent(slug))
  if (!row) notFound()

  const product = toStoreProduct(row)
  const categoryIds = row.categories.map(c => c.categoryId)
  const brandIds = row.brands.map(b => b.brandId)

  /**
   * Related products: same brand first, then same category, never itself.
   *
   * Two queries rather than one OR, because the brand matches are genuinely
   * better suggestions and should lead. Deduped and capped afterwards.
   */
  const [sameBrand, sameCategory, cartCount] = await Promise.all([
    brandIds.length
      ? prisma.product.findMany({
          where: {
            status: 'publish',
            id: { not: row.id },
            images: { some: {} },
            brands: { some: { brandId: { in: brandIds } } },
          },
          orderBy: { totalSales: 'desc' },
          take: 8,
          include: INCLUDE,
        })
      : Promise.resolve([]),
    categoryIds.length
      ? prisma.product.findMany({
          where: {
            status: 'publish',
            id: { not: row.id },
            images: { some: {} },
            categories: { some: { categoryId: { in: categoryIds } } },
          },
          orderBy: { totalSales: 'desc' },
          take: 12,
          include: INCLUDE,
        })
      : Promise.resolve([]),
    readCartCount(),
  ])

  const seen = new Set<string>([row.id])
  const related: StoreProduct[] = []
  for (const r of [...sameBrand, ...sameCategory]) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    related.push(toStoreProduct(r))
    if (related.length === 8) break
  }

  return (
    <div className="min-h-dvh font-store" style={{ background: CANVAS }}>
      <StoreHeader cartCount={cartCount} locale={locale} customerName={customer?.name} />

      <main className="mx-auto max-w-[1440px] px-5 pb-24 pt-6 sm:px-8">
        <nav aria-label="Διαδρομή" className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px]">
          <Link href="/" style={{ color: INK_MUTED }} className="hover:text-black">Αρχική</Link>
          <span aria-hidden style={{ color: INK_MUTED }}>/</span>
          <Link href="/proionta" style={{ color: INK_MUTED }} className="hover:text-black">Προϊόντα</Link>
          {product.categories[0] && (
            <>
              <span aria-hidden style={{ color: INK_MUTED }}>/</span>
              <Link
                href={`/proionta?category=${encodeURIComponent(product.categories[0])}`}
                style={{ color: TEAL_DEEP }}
                className="hover:underline"
              >
                {product.categories[0]}
              </Link>
            </>
          )}
          <span aria-hidden style={{ color: INK_MUTED }}>/</span>
          <span style={{ color: INK }}>{product.name}</span>
        </nav>

        <ProductView product={product} related={related} />
      </main>

      <StoreFooter locale={locale} />
    </div>
  )
}
