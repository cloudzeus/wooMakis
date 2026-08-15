import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { requirePermission } from '@/lib/rbac-server'
import { readGate } from '@/lib/woo/write'
import { BarList, MonthlyBars, Panel, Stat, type Bar } from '@/components/admin/charts'

export const dynamic = 'force-dynamic'

/** Kept in step with sync/orders.ts — statuses where no money was taken. */
const NON_REVENUE = ['cancelled', 'refunded', 'failed', 'trash']

const STATUS_LABEL: Record<string, string> = {
  pending: 'Εκκρεμεί πληρωμή',
  processing: 'Σε επεξεργασία',
  'on-hold': 'Σε αναμονή',
  completed: 'Ολοκληρωμένη',
  cancelled: 'Ακυρωμένη',
  refunded: 'Επιστροφή',
  failed: 'Απέτυχε',
  trash: 'Διαγραμμένη',
}

const eur = (n: number) =>
  `${n.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`

const MONTHS = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ']

export default async function DashboardPage() {
  const session = await requirePermission('product.view')
  const gate = readGate()

  const [
    products, categories, brands, customers, assets,
    orders, orderAgg, byStatus, recent, lastSync,
    noImages, singleLang, topLines,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.customer.count(),
    prisma.mediaAsset.count(),
    prisma.order.findMany({
      where: { status: { notIn: NON_REVENUE } },
      select: { total: true, dateCreated: true },
    }),
    prisma.order.aggregate({
      where: { status: { notIn: NON_REVENUE } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true }, _sum: { total: true } }),
    prisma.order.findMany({
      orderBy: { dateCreated: 'desc' },
      take: 8,
      select: { id: true, number: true, billingName: true, total: true, status: true, dateCreated: true },
    }),
    prisma.syncLog.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.product.count({ where: { images: { none: {} } } }),
    prisma.product.count({ where: { translations: { some: {} }, NOT: { translations: { some: { locale: 'en' } } } } }),
    prisma.orderLine.groupBy({
      by: ['name'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 8,
    }),
  ])

  const revenue = Number(orderAgg._sum.total ?? 0)
  const orderCount = orderAgg._count._all
  const aov = orderCount ? revenue / orderCount : 0

  // Last 12 months, oldest first. Built from the newest order rather than from
  // today: this is a mirror of a store whose last order may predate now, and a
  // chart of twelve empty months would read as "sales stopped".
  const newest = orders.reduce<Date | null>(
    (a, o) => (!a || o.dateCreated > a ? o.dateCreated : a), null,
  ) ?? new Date()

  const buckets = new Map<string, { total: number; count: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(newest.getFullYear(), newest.getMonth() - i, 1)
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, { total: 0, count: 0 })
  }
  for (const o of orders) {
    const k = `${o.dateCreated.getFullYear()}-${o.dateCreated.getMonth()}`
    const b = buckets.get(k)
    if (b) { b.total += Number(o.total); b.count++ }
  }
  const monthly = [...buckets.entries()].map(([k, v]) => {
    const [, m] = k.split('-').map(Number)
    return { label: MONTHS[m], value: Math.round(v.total), secondary: v.count }
  })

  const statusBars: Bar[] = byStatus
    .map(s => ({
      label: STATUS_LABEL[s.status] ?? s.status,
      value: s._count._all,
      hint: `${s.status}: ${Number(s._sum.total ?? 0).toFixed(2)} €`,
    }))
    .sort((a, b) => b.value - a.value)

  const topProducts: Bar[] = topLines.map(l => ({
    label: l.name,
    value: l._sum.quantity ?? 0,
    hint: `${l.name} — ${Number(l._sum.total ?? 0).toFixed(2)} €`,
  }))

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  const catalogWarnings = [
    noImages > 0 && {
      text: `${plural(noImages, 'προϊόν', 'προϊόντα')} χωρίς εικόνα`,
      href: '/products',
      cta: 'Δες τα προϊόντα',
    },
    singleLang > 0 && {
      text: `${plural(singleLang, 'προϊόν', 'προϊόντα')} χωρίς αγγλική μετάφραση`,
      href: '/products',
      cta: 'Μετάφραση με DeepSeek',
    },
    orderCount === 0 && {
      text: 'Δεν έχουν συγχρονιστεί παραγγελίες',
      href: '/sync',
      cta: 'Τρέξε συγχρονισμό',
    },
  ].filter(Boolean) as { text: string; href: string; cta: string }[]

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Πίνακας ελέγχου</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Καλώς ήρθες, {session.user.name}. Ρόλος {session.user.role}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 ${
            gate.environment === 'production'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}>
            env={gate.environment}
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            εγγραφές {gate.allowWrites && !gate.dryRun ? 'ενεργές' : 'κλειδωμένες'}
          </span>
          {lastSync && (
            <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
              τελευταίος συγχρονισμός {lastSync.startedAt.toLocaleDateString('el-GR')}
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Τζίρος"
          value={eur(revenue)}
          sub="χωρίς ακυρωμένες, επιστροφές, αποτυχημένες"
        />
        <Stat
          label="Παραγγελίες"
          value={orderCount.toLocaleString('el-GR')}
          sub={`μέση αξία ${aov.toFixed(2)} €`}
        />
        <Stat
          label="Πελάτες"
          value={customers.toLocaleString('el-GR')}
          sub={`${products} προϊόντα · ${brands} μάρκες`}
        />
        <Stat
          label="Χωρίς εικόνα"
          value={String(noImages)}
          tone={noImages > 0 ? 'warn' : 'good'}
          sub={`${assets} αρχεία στο Bunny`}
        />
      </div>

      {catalogWarnings.length > 0 && (
        <section className="rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning)]/8 p-4">
          <h2 className="text-[13px] font-semibold text-[var(--warning)]">Χρειάζονται προσοχή</h2>
          <ul className="mt-2 space-y-1.5">
            {catalogWarnings.map(w => (
              <li key={w.text} className="flex flex-wrap items-baseline gap-2 text-[13px]">
                <span aria-hidden className="text-[var(--warning)]">!</span>
                {w.text}
                <Link href={w.href} className="text-[12.5px] underline hover:no-underline">
                  {w.cta}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Τζίρος ανά μήνα"
            hint={
              orderCount === 0
                ? 'Δεν υπάρχουν παραγγελίες ακόμα.'
                : `Οι τελευταίοι 12 μήνες μέχρι ${newest.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' })}.`
            }
          >
            <MonthlyBars months={monthly} format={eur} />
          </Panel>
        </div>

        <Panel title="Παραγγελίες ανά κατάσταση">
          <BarList bars={statusBars} emptyMessage="Τρέξε συγχρονισμό παραγγελιών." />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Κορυφαία προϊόντα"
          hint="Κατά τεμάχια που πουλήθηκαν, σε όλες τις παραγγελίες."
          action={<Link href="/orders" className="text-[12.5px] underline hover:no-underline">Παραγγελίες</Link>}
        >
          <BarList
            bars={topProducts}
            format={v => `${v} τεμ.`}
            emptyMessage="Τρέξε συγχρονισμό παραγγελιών."
          />
        </Panel>

        <Panel
          title="Πρόσφατες παραγγελίες"
          action={<Link href="/orders" className="text-[12.5px] underline hover:no-underline">Όλες</Link>}
        >
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Καμία παραγγελία ακόμα.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recent.map(o => (
                <li key={o.id} className="flex items-baseline justify-between gap-3 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="tabular-nums text-muted-foreground">#{o.number}</span>{' '}
                    <span className="font-medium">{o.billingName}</span>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {STATUS_LABEL[o.status] ?? o.status} · {o.dateCreated.toLocaleDateString('el-GR')}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {Number(o.total).toFixed(2)} €
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Γρήγορες ενέργειες">
        <div className="flex flex-wrap gap-2">
          {[
            can(session, 'sync.run') && { href: '/sync', label: 'Συγχρονισμός' },
            can(session, 'product.view') && { href: '/products', label: 'Προϊόντα' },
            can(session, 'order.view') && { href: '/orders', label: 'Παραγγελίες' },
            can(session, 'customer.view') && { href: '/customers', label: 'Πελάτες' },
            can(session, 'media.view') && { href: '/media', label: 'Πολυμέσα' },
            can(session, 'user.manage') && { href: '/users', label: 'Χρήστες' },
            can(session, 'role.manage') && { href: '/roles', label: 'Ρόλοι' },
            can(session, 'settings.manage') && { href: '/settings', label: 'Ρυθμίσεις' },
          ]
            .filter(Boolean)
            .map(l => {
              const link = l as { href: string; label: string }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-border px-4 py-2 text-[13px] hover:bg-accent"
                >
                  {link.label}
                </Link>
              )
            })}
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          {categories} κατηγορίες · {brands} μάρκες · {products} προϊόντα · {assets} αρχεία
        </p>
      </Panel>
    </section>
  )
}
