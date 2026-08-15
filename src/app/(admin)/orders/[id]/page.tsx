import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { sortPrescription } from '@/lib/lens-fields'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; icon: string; cls: string }> = {
  pending:    { label: 'Εκκρεμεί πληρωμή', icon: '○', cls: 'bg-muted text-muted-foreground' },
  processing: { label: 'Σε επεξεργασία',   icon: '◐', cls: 'bg-[var(--info)]/12 text-[var(--info)]' },
  'on-hold':  { label: 'Σε αναμονή',       icon: '‖', cls: 'bg-[var(--warning)]/12 text-[var(--warning)]' },
  completed:  { label: 'Ολοκληρωμένη',     icon: '✓', cls: 'bg-[var(--success)]/12 text-[var(--success)]' },
  cancelled:  { label: 'Ακυρωμένη',        icon: '✕', cls: 'bg-muted text-muted-foreground' },
  refunded:   { label: 'Επιστροφή χρημάτων', icon: '↩', cls: 'bg-muted text-muted-foreground' },
  failed:     { label: 'Απέτυχε',          icon: '⚠', cls: 'bg-destructive/10 text-destructive' },
  trash:      { label: 'Διαγραμμένη',      icon: '␡', cls: 'bg-muted text-muted-foreground' },
}

/** The billing/shipping block as WooCommerce stores it inside wooSnapshot. */
type Address = {
  first_name?: string; last_name?: string; company?: string
  address_1?: string; address_2?: string; postcode?: string
  city?: string; state?: string; country?: string
  email?: string; phone?: string
}

function AddressBlock({ title, a }: { title: string; a: Address | null }) {
  const lines = a
    ? [
        [a.first_name, a.last_name].filter(Boolean).join(' '),
        a.company,
        [a.address_1, a.address_2].filter(Boolean).join(', '),
        [a.postcode, a.city].filter(Boolean).join(' '),
        [a.state, a.country].filter(Boolean).join(', '),
        a.phone,
        a.email,
      ].filter((l): l is string => !!l && l.trim().length > 0)
    : []

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-2 font-display text-base font-semibold">{title}</h2>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Δεν έχει καταχωρηθεί.</p>
      ) : (
        <address className="space-y-0.5 text-[13px] not-italic">
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </address>
      )}
    </div>
  )
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePermission('order.view')

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { wooLineId: 'asc' } },
      customer: { select: { id: true, NAME: true, orderCount: true, totalSpent: true } },
    },
  })
  if (!order) notFound()

  const snap = (order.wooSnapshot ?? {}) as { billing?: Address; shipping?: Address }
  const s = STATUS[order.status] ?? { label: order.status, icon: '•', cls: 'bg-muted text-muted-foreground' }

  const itemsTotal = order.lines.reduce((n, l) => n + Number(l.total), 0)
  const wooBase = process.env.WOO_BASE_URL?.replace(/\/+$/, '')

  const money = (n: number) => `${n.toFixed(2)} €`

  return (
    <section className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href="/orders" className="hover:text-foreground">Παραγγελίες</Link>
        <span className="mx-1">/</span>
        <span>#{order.number}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-display text-xl font-semibold">
            Παραγγελία #{order.number}
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-normal ${s.cls}`}>
              <span aria-hidden>{s.icon}</span>{s.label}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.dateCreated.toLocaleString('el-GR', { dateStyle: 'long', timeStyle: 'short' })}
            {order.datePaid && ` · πληρώθηκε ${order.datePaid.toLocaleDateString('el-GR')}`}
          </p>
        </div>
        {wooBase && (
          <a
            href={`${wooBase}/wp-admin/post.php?post=${order.wooId}&action=edit`}
            target="_blank"
            rel="noreferrer"
            className="h-10 cursor-pointer rounded-full border border-border px-5 text-sm leading-10 hover:bg-accent"
          >
            Άνοιγμα στο WooCommerce ↗
          </a>
        )}
      </header>

      <p className="rounded-2xl bg-muted px-4 py-2.5 text-[13px] text-muted-foreground">
        Μόνο για ανάγνωση. Η αλλαγή κατάστασης, οι επιστροφές και οι ακυρώσεις γίνονται
        στο WooCommerce ώστε τα δύο συστήματα να μη διαφωνούν για το τι πληρώθηκε.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <AddressBlock title="Χρέωση" a={snap.billing ?? null} />
        <AddressBlock title="Αποστολή" a={snap.shipping ?? null} />

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 font-display text-base font-semibold">Πληρωμή</h2>
          <dl className="space-y-1 text-[13px]">
            <Pair k="Τρόπος" v={order.paymentMethodTitle ?? order.paymentMethod ?? '—'} />
            <Pair k="Κωδικός συναλλαγής" v={order.transactionId ?? '—'} />
            <Pair k="Woo id" v={`#${order.wooId}`} />
            <Pair
              k="Πελάτης"
              v={order.customer
                ? `${order.customer.NAME} · ${order.customer.orderCount} παραγγελίες`
                : 'δεν συνδέθηκε'}
              href={order.customer ? `/customers/${order.customer.id}` : undefined}
            />
          </dl>
        </div>
      </div>

      {order.customerNote && (
        <p className="rounded-2xl border border-border bg-card p-5 text-[13px]">
          <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
            Σημείωση πελάτη
          </span>
          {order.customerNote}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <h2 className="border-b border-border px-5 py-3 font-display text-base font-semibold">
          Είδη <span className="text-muted-foreground">({order.lines.length})</span>
        </h2>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2">Προϊόν</th>
              <th className="px-5 py-2">Συνταγή</th>
              <th className="px-5 py-2 text-right">Ποσ.</th>
              <th className="px-5 py-2 text-right">Σύνολο</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map(l => (
              <tr key={l.id} className="border-b border-border/60 align-top last:border-0">
                <td className="px-5 py-3">
                  {l.productId ? (
                    <Link href={`/products/${l.productId}`} className="font-medium hover:underline">
                      {l.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{l.name}</span>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {l.sku ? `SKU ${l.sku}` : 'χωρίς SKU'}
                    {!l.productId && ' · δεν υπάρχει στον τοπικό κατάλογο'}
                  </div>
                </td>
                <td className="px-5 py-3">
                  {l.meta && Object.keys(l.meta as object).length > 0 ? (
                    <dl className="grid gap-x-5 gap-y-0.5 sm:grid-cols-2">
                      {sortPrescription(l.meta as Record<string, string>).map(([k, v]) => (
                        <div key={k} className="flex items-baseline gap-1.5">
                          <dt className="text-[11px] text-muted-foreground">{k}</dt>
                          <dd className="font-medium tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{l.quantity}</td>
                <td className="px-5 py-3 text-right tabular-nums">{money(Number(l.total))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border">
            <tr><td colSpan={3} className="px-5 py-1.5 text-right text-muted-foreground">Είδη</td>
                <td className="px-5 py-1.5 text-right tabular-nums">{money(itemsTotal)}</td></tr>
            <tr><td colSpan={3} className="px-5 py-1.5 text-right text-muted-foreground">Μεταφορικά</td>
                <td className="px-5 py-1.5 text-right tabular-nums">{money(Number(order.shippingTotal ?? 0))}</td></tr>
            {Number(order.discountTotal ?? 0) > 0 && (
              <tr><td colSpan={3} className="px-5 py-1.5 text-right text-muted-foreground">Έκπτωση</td>
                  <td className="px-5 py-1.5 text-right tabular-nums">−{money(Number(order.discountTotal))}</td></tr>
            )}
            <tr><td colSpan={3} className="px-5 py-1.5 text-right text-muted-foreground">ΦΠΑ</td>
                <td className="px-5 py-1.5 text-right tabular-nums">{money(Number(order.totalTax ?? 0))}</td></tr>
            <tr className="border-t border-border">
              <td colSpan={3} className="px-5 py-2.5 text-right font-semibold">Σύνολο</td>
              <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{money(Number(order.total))}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </section>
  )
}

function Pair({ k, v, href }: { k: string; v: string; href?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">
        {href ? <Link href={href} className="hover:underline">{v}</Link> : v}
      </dd>
    </div>
  )
}
