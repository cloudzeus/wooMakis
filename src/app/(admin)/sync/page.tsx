import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { requirePermission } from '@/lib/rbac-server'
import { readGate } from '@/lib/woo/write'
import { SyncPanel, type SyncJob } from './sync-panel'
import { WebhookPanel, type WebhookStats } from './webhook-panel'

export const dynamic = 'force-dynamic'

const OUTCOME: Record<string, { icon: string; label: string; cls: string }> = {
  SUCCESS: { icon: '✓', label: 'Επιτυχία', cls: 'bg-[var(--success)]/12 text-[var(--success)]' },
  PARTIAL: { icon: '◐', label: 'Μερική',   cls: 'bg-[var(--warning)]/12 text-[var(--warning)]' },
  FAILED:  { icon: '⚠', label: 'Αποτυχία', cls: 'bg-destructive/10 text-destructive' },
}

function when(d: Date): string {
  return d.toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })
}

function duration(from: Date, to: Date | null): string {
  if (!to) return '—'
  const s = Math.round((to.getTime() - from.getTime()) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

export default async function SyncPage() {
  const session = await requirePermission('sync.view')

  const [logs, products, categories, brands, customers, orders, assets, hooks, lastHook] = await Promise.all([
    prisma.syncLog.findMany({ orderBy: { startedAt: 'desc' }, take: 25 }),
    prisma.product.count(),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.customer.count(),
    prisma.order.count(),
    prisma.mediaAsset.count(),
    prisma.webhookEvent.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.webhookEvent.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 8,
      select: { deliveryId: true, topic: true, status: true, receivedAt: true, error: true },
    }),
  ])

  const countOf = (status: string) =>
    hooks.find(h => h.status === status)?._count._all ?? 0

  const webhookStats: WebhookStats = {
    pending: countOf('PENDING'),
    done: countOf('DONE'),
    failed: countOf('FAILED'),
    ignored: countOf('IGNORED'),
    lastReceivedAt: lastHook[0]?.receivedAt.toISOString() ?? null,
    recent: lastHook.map(e => ({
      deliveryId: e.deliveryId,
      topic: e.topic,
      status: e.status,
      receivedAt: e.receivedAt.toISOString(),
      error: e.error,
    })),
  }

  const lastOk = (target: string) =>
    logs.find(l => l.target === target && l.outcome !== 'FAILED')?.startedAt ?? null

  const jobs: SyncJob[] = [
    {
      key: 'catalog',
      title: 'Κατάλογος',
      description:
        'Κατηγορίες, μάρκες και προϊόντα, με τις μεταφράσεις τους ενωμένες σε ομάδες Polylang. '
        + 'Προαιρετικά κατεβάζει και τις εικόνες στο Bunny CDN.',
      lastRun: lastOk('catalog') ? when(lastOk('catalog')!) : null,
      count: products,
      countLabel: `προϊόντα · ${categories} κατηγορίες · ${brands} μάρκες · ${assets} αρχεία`,
    },
    {
      key: 'customers',
      title: 'Πελάτες',
      description:
        'Λογαριασμοί από το endpoint πελατών, συν όσοι αγόρασαν ως επισκέπτες και '
        + 'υπάρχουν μόνο στα στοιχεία χρέωσης των παραγγελιών τους.',
      lastRun: lastOk('customers') ? when(lastOk('customers')!) : null,
      count: customers,
      countLabel: 'πελάτες',
    },
    {
      key: 'orders',
      title: 'Παραγγελίες',
      description:
        'Όλες οι καταστάσεις, μαζί με τις γραμμές και τη συνταγή κάθε γραμμής. '
        + 'Ενημερώνει και τα σύνολα των πελατών.',
      lastRun: lastOk('orders') ? when(lastOk('orders')!) : null,
      count: orders,
      countLabel: 'παραγγελίες',
    },
  ]

  const gate = readGate()

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Συγχρονισμός</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Λήψη από το WooCommerce. Κάθε εκτέλεση καταγράφεται παρακάτω.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-3 py-1">
          {process.env.WOO_BASE_URL?.replace(/^https?:\/\//, '') ?? 'χωρίς WOO_BASE_URL'}
        </span>
        <span
          className={`rounded-full px-3 py-1 ${
            gate.environment === 'production'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          env={gate.environment}
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
          εγγραφές {gate.allowWrites && !gate.dryRun ? 'ενεργές' : 'κλειδωμένες'}
        </span>
      </div>

      <SyncPanel jobs={jobs} canRun={can(session, 'sync.run')} />

      <WebhookPanel
        stats={webhookStats}
        endpoint={`${process.env.AUTH_URL ?? ''}/api/webhooks/woocommerce`}
        configured={!!process.env.WOO_WEBHOOK_SECRET}
        canRun={can(session, 'sync.run')}
      />

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold">Ιστορικό</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Πότε</th>
                <th className="px-4 py-3">Στόχος</th>
                <th className="px-4 py-3">Έκβαση</th>
                <th className="px-4 py-3 text-right">Νέα</th>
                <th className="px-4 py-3 text-right">Ενημ.</th>
                <th className="px-4 py-3 text-right">Παραλ.</th>
                <th className="px-4 py-3 text-right">Απέτυχαν</th>
                <th className="px-4 py-3 text-right">Διάρκεια</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Δεν έχει τρέξει κανένας συγχρονισμός ακόμα.
                  </td>
                </tr>
              )}
              {logs.map(l => {
                const o = OUTCOME[l.outcome] ?? OUTCOME.FAILED
                return (
                  <tr key={l.id} className="border-b border-border/60 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{when(l.startedAt)}</td>
                    <td className="px-4 py-2.5">{l.target}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${o.cls}`}>
                        <span aria-hidden>{o.icon}</span>{o.label}
                      </span>
                      {l.error && (
                        <p className="mt-1 max-w-[42ch] text-[11.5px] text-destructive">{l.error}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.created}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.updated}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.skipped}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.failed}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      {duration(l.startedAt, l.finishedAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
