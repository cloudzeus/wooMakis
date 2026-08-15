import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readCart } from '@/lib/cart'
import { ORDER_STATUS } from '@/lib/i18n'
import { sortPrescription } from '@/lib/lens-fields'
import { getT } from '@/lib/locale-server'
import { getCustomerSession, hasOrderAccess } from '@/lib/customer-auth'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import { CANVAS, CREAM, HAIRLINE, INK, INK_MUTED, SURFACE } from '@/components/store/tokens'

export const dynamic = 'force-dynamic'

/**
 * One order, for the person who placed it.
 *
 * Two ways in, and nothing else: a signed-in customer whose account owns the
 * order, or a one-hour grant issued by the guest lookup form. A bare id is not
 * enough — order ids end up in browser history and shared links, and the page
 * carries a full name, address and phone number.
 *
 * A refused request 404s rather than 403s, so the page cannot be used to
 * confirm that an order id exists.
 */
export default async function GuestOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { locale, t } = await getT()

  const [session, granted] = await Promise.all([getCustomerSession(), hasOrderAccess(id)])

  const order = await prisma.order.findUnique({
    where: { id },
    include: { lines: { orderBy: { wooLineId: 'asc' } } },
  })
  if (!order) notFound()

  const owns = !!session && order.customerId === session.customerId
  if (!owns && !granted) notFound()

  const cart = await readCart(locale)
  const statusName = ORDER_STATUS[locale]
  const snap = (order.wooSnapshot ?? {}) as {
    billing?: Record<string, string>
    shipping?: Record<string, string>
  }

  const addressLines = (a: Record<string, string> | undefined) =>
    a
      ? [
          [a.first_name, a.last_name].filter(Boolean).join(' '),
          a.company,
          [a.address_1, a.address_2].filter(Boolean).join(', '),
          [a.postcode, a.city].filter(Boolean).join(' '),
          a.country,
          a.phone,
        ].filter(l => l && l.trim())
      : []

  const money = (n: number) => `${n.toFixed(2)} €`

  return (
    <div className="min-h-screen font-store" style={{ background: CANVAS, color: INK }}>
      <StoreHeader
        cartCount={cart.lines.reduce((n, l) => n + l.quantity, 0)}
        locale={locale}
        customerName={session?.name}
      />

      <main className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
        <nav className="mb-6 text-[12.5px]" style={{ color: INK_MUTED }}>
          <Link href={session ? '/logariasmos' : '/'} className="hover:text-black">
            {session ? t('account.title') : t('nav.home')}
          </Link>
          <span className="mx-1.5">/</span>
          <span>#{order.number}</span>
        </nav>

        <header className="mb-6">
          <h1 className="font-store-display text-[30px] font-black leading-[1.05] tracking-[-0.02em] sm:text-[38px]">
            #{order.number}
          </h1>
          <p className="mt-2 text-[14px]" style={{ color: INK_MUTED }}>
            {order.dateCreated.toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-GB')}
            {' · '}{statusName[order.status] ?? order.status}
            {order.paymentMethodTitle && ` · ${order.paymentMethodTitle}`}
          </p>
        </header>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {([['billing', snap.billing], ['shipping', snap.shipping]] as const).map(([kind, a]) => {
            const lines = addressLines(a)
            if (lines.length === 0) return null
            return (
              <div
                key={kind}
                className="rounded-2xl p-5"
                style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
              >
                <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: INK_MUTED }}>
                  {kind === 'billing'
                    ? (locale === 'el' ? 'Χρέωση' : 'Billing')
                    : (locale === 'el' ? 'Αποστολή' : 'Shipping')}
                </h2>
                <address className="space-y-0.5 text-[13.5px] not-italic">
                  {lines.map((l, i) => <div key={i}>{l}</div>)}
                </address>
              </div>
            )
          })}
        </div>

        <section
          className="overflow-hidden rounded-2xl"
          style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
        >
          <h2 className="border-b px-5 py-3 text-[15px] font-bold" style={{ borderColor: HAIRLINE }}>
            {t('common.items')}
          </h2>

          <ul className="divide-y" style={{ borderColor: HAIRLINE }}>
            {order.lines.map(line => {
              const meta = line.meta as Record<string, string> | null
              return (
                <li key={line.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[14.5px] font-semibold">{line.name}</span>
                    <span className="text-[13.5px] tabular-nums" style={{ color: INK_MUTED }}>
                      × {line.quantity} · {money(Number(line.total))}
                    </span>
                  </div>
                  {meta && Object.keys(meta).length > 0 && (
                    <div className="mt-2 rounded-xl p-3" style={{ background: CREAM }}>
                      <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: INK_MUTED }}>
                        {t('account.prescription')}
                      </p>
                      <dl className="flex flex-wrap gap-x-4 gap-y-1">
                        {sortPrescription(meta).map(([k, v]) => (
                          <div key={k} className="flex items-baseline gap-1.5">
                            <dt className="text-[11px]" style={{ color: INK_MUTED }}>{k}</dt>
                            <dd className="text-[13px] font-semibold tabular-nums">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <dl className="space-y-1 border-t px-5 py-4 text-[13.5px]" style={{ borderColor: HAIRLINE }}>
            <Row k={locale === 'el' ? 'Μεταφορικά' : 'Shipping'} v={money(Number(order.shippingTotal ?? 0))} />
            <Row k={locale === 'el' ? 'ΦΠΑ' : 'VAT'} v={money(Number(order.totalTax ?? 0))} />
            <Row k={t('common.total')} v={money(Number(order.total))} strong />
          </dl>
        </section>
      </main>

      <StoreFooter locale={locale} />
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'pt-1 text-[15px] font-bold' : ''}`}>
      <dt style={strong ? undefined : { color: INK_MUTED }}>{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  )
}
