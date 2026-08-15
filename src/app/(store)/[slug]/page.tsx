import Link from 'next/link'
import { notFound } from 'next/navigation'
import { readCart } from '@/lib/cart'
import { getPage, parseBlocks } from '@/lib/content'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import { CANVAS, HAIRLINE, INK, INK_MUTED, SURFACE } from '@/components/store/tokens'

export const dynamic = 'force-dynamic'

/**
 * Every CMS page — terms, privacy, cookies, shipping, returns — renders here.
 *
 * This is the storefront's catch-all, so it must sit alongside the named
 * routes and lose to them: /proionta and /kalathi are real segments and Next
 * matches those first. Anything else falls through, and an unknown slug is a
 * 404 rather than an empty page.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { locale } = await getT()
  const page = await getPage(slug, locale)
  if (!page) return {}
  return { title: `${page.title} | mylens.gr`, description: page.summary ?? undefined }
}

export default async function ContentPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { locale, t } = await getT()

  const [page, cart, session] = await Promise.all([
    getPage(slug, locale),
    readCart(locale),
    getCustomerSession(),
  ])
  if (!page) notFound()

  const blocks = parseBlocks(page.body)

  return (
    <div className="min-h-screen font-store" style={{ background: CANVAS, color: INK }}>
      <StoreHeader
        cartCount={cart.lines.reduce((n, l) => n + l.quantity, 0)}
        locale={locale}
        customerName={session?.name}
      />

      <main className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8">
        <nav className="mb-6 text-[12.5px]" style={{ color: INK_MUTED }}>
          <Link href="/" className="hover:text-black">{t('nav.home')}</Link>
          <span className="mx-1.5">/</span>
          <span>{page.title}</span>
        </nav>

        <article
          className="mx-auto max-w-[68ch] rounded-3xl px-6 py-10 sm:px-10"
          style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
        >
          <h1 className="font-store-display text-[34px] font-black leading-[1.05] tracking-[-0.02em] sm:text-[44px]">
            {page.title}
          </h1>
          {page.summary && (
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: INK_MUTED }}>
              {page.summary}
            </p>
          )}
          <p className="mt-3 text-[12.5px]" style={{ color: INK_MUTED }}>
            {t('common.updated')}: {page.updatedAt.toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-GB')}
          </p>

          <div className="mt-8 space-y-4">
            {blocks.map((b, i) => {
              if (b.type === 'heading') {
                return (
                  <h2 key={i} className="pt-4 text-[19px] font-bold leading-snug">
                    {b.text}
                  </h2>
                )
              }
              if (b.type === 'list') {
                return (
                  <ul key={i} className="ml-5 list-disc space-y-1.5 text-[15px] leading-relaxed">
                    {b.items.map((item, j) => <li key={j}>{item}</li>)}
                  </ul>
                )
              }
              return (
                <p key={i} className="text-[15px] leading-relaxed">{b.text}</p>
              )
            })}
          </div>
        </article>
      </main>

      <StoreFooter locale={locale} />
    </div>
  )
}
