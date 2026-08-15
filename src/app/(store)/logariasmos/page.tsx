import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readCart } from '@/lib/cart'
import { ORDER_STATUS, pickTranslation } from '@/lib/i18n'
import { sortPrescription } from '@/lib/lens-fields'
import { getT } from '@/lib/locale-server'
import { getCustomerSession } from '@/lib/customer-auth'
import { StoreFooter, StoreHeader } from '@/components/store/store-header'
import {
  CANVAS, CREAM, HAIRLINE, INK, INK_MUTED, PRIMARY, SURFACE,
} from '@/components/store/tokens'
import { SignOutButton } from './sign-out-button'

export const dynamic = 'force-dynamic'

/** No money was taken, so it does not count towards what someone has spent. */
const NON_REVENUE = ['cancelled', 'refunded', 'failed', 'trash']

export default async function AccountPage() {
  const session = await getCustomerSession()
  if (!session) redirect('/sindesi?next=/logariasmos')

  const { locale, t } = await getT()
  const statusName = ORDER_STATUS[locale]

  const [customer, cart] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: session.customerId },
      include: {
        orders: {
          orderBy: { dateCreated: 'desc' },
          include: {
            lines: {
              orderBy: { wooLineId: 'asc' },
              // The reorder link needs the slug: /proionta is keyed by slug,
              // not by the product id.
              include: { product: { include: { translations: true } } },
            },
          },
        },
      },
    }),
    readCart(locale),
  ])
  if (!customer) redirect('/sindesi')

  const orders = customer.orders
  const spent = orders
    .filter(o => !NON_REVENUE.includes(o.status))
    .reduce((n, o) => n + Number(o.total), 0)

  /**
   * The most recent prescription per product.
   *
   * This is the single most useful thing an account page can show a contact
   * lens buyer: reordering means knowing the power, base curve and diameter,
   * and those live on the order line rather than anywhere the customer can
   * easily look up. Newest order first, so the first time a product is seen is
   * its latest prescription.
   */
  const lastPrescription = new Map<string, {
    name: string; slug: string | null; meta: Record<string, string>; when: Date
  }>()
  for (const order of orders) {
    for (const line of order.lines) {
      const meta = line.meta as Record<string, string> | null
      if (!meta || Object.keys(meta).length === 0) continue
      if (lastPrescription.has(line.name)) continue
      lastPrescription.set(line.name, {
        name: line.name,
        slug: pickTranslation(line.product?.translations ?? [], locale)?.slug ?? null,
        meta,
        when: order.dateCreated,
      })
    }
  }
  const lenses = [...lastPrescription.values()].slice(0, 6)

  const fmtDate = (d: Date) => d.toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-GB')

  return (
    <div className="min-h-screen font-store" style={{ background: CANVAS, color: INK }}>
      <StoreHeader
        cartCount={cart.lines.reduce((n, l) => n + l.quantity, 0)}
        locale={locale}
        customerName={session.name}
      />

      <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-store-display text-[32px] font-black leading-[1.05] tracking-[-0.02em] sm:text-[40px]">
              {t('account.title')}
            </h1>
            <p className="mt-2 text-[14px]" style={{ color: INK_MUTED }}>
              {customer.NAME} · {session.email}
            </p>
          </div>
          <SignOutButton label={t('nav.signOut')} />
        </header>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <Stat label={t('account.totalOrders')} value={String(orders.length)} />
          <Stat label={t('account.totalSpent')} value={`${spent.toFixed(2)} €`} />
          <Stat
            label={t('account.lastOrder')}
            value={orders[0] ? fmtDate(orders[0].dateCreated) : '—'}
          />
        </div>

        {lenses.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[19px] font-bold">{t('account.myLenses')}</h2>
            <p className="mb-4 mt-1 text-[13.5px]" style={{ color: INK_MUTED }}>
              {t('account.myLensesHelp')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {lenses.map(l => (
                <div
                  key={l.name}
                  className="rounded-2xl p-4"
                  style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[14.5px] font-semibold">{l.name}</span>
                    <span className="text-[11.5px]" style={{ color: INK_MUTED }}>{fmtDate(l.when)}</span>
                  </div>
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {sortPrescription(l.meta).map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-1.5">
                        <dt className="text-[11px] uppercase tracking-[0.08em]" style={{ color: INK_MUTED }}>{k}</dt>
                        <dd className="text-[13px] font-semibold tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {l.slug && (
                    <Link
                      href={`/proionta/${l.slug}`}
                      className="mt-3 inline-block text-[13px] underline hover:no-underline"
                      style={{ color: PRIMARY }}
                    >
                      {t('account.reorder')}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-[19px] font-bold">{t('account.orders')}</h2>

          {orders.length === 0 ? (
            <p
              className="rounded-2xl border border-dashed px-6 py-12 text-center text-[14px]"
              style={{ borderColor: 'rgb(20 24 26 / 18%)', color: INK_MUTED }}
            >
              {t('account.noOrders')}
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map(o => (
                <details
                  key={o.id}
                  className="group rounded-2xl px-5 py-4"
                  style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[15px] font-semibold tabular-nums">#{o.number}</span>
                    <span className="text-[13px]" style={{ color: INK_MUTED }}>
                      {fmtDate(o.dateCreated)}
                    </span>
                    <span className="text-[13px]" style={{ color: INK_MUTED }}>
                      {statusName[o.status] ?? o.status}
                    </span>
                    <span className="ml-auto text-[15px] font-semibold tabular-nums">
                      {Number(o.total).toFixed(2)} €
                    </span>
                    <span aria-hidden className="transition-transform group-open:rotate-45" style={{ color: INK_MUTED }}>+</span>
                  </summary>

                  <ul className="mt-4 space-y-3">
                    {o.lines.map(line => {
                      const meta = line.meta as Record<string, string> | null
                      return (
                        <li key={line.id} className="rounded-xl p-3" style={{ background: CREAM }}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-[14px] font-semibold">{line.name}</span>
                            <span className="text-[13px] tabular-nums" style={{ color: INK_MUTED }}>
                              × {line.quantity} · {Number(line.total).toFixed(2)} €
                            </span>
                          </div>
                          {meta && Object.keys(meta).length > 0 && (
                            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                              {sortPrescription(meta).map(([k, v]) => (
                                <div key={k} className="flex items-baseline gap-1.5">
                                  <dt className="text-[11px] uppercase tracking-[0.08em]" style={{ color: INK_MUTED }}>{k}</dt>
                                  <dd className="text-[13px] font-semibold tabular-nums">{v}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </section>
      </main>

      <StoreFooter locale={locale} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: INK_MUTED }}>
        {label}
      </p>
      <p className="mt-1 font-store-display text-[26px] font-black tabular-nums">{value}</p>
    </div>
  )
}
