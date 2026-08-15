'use client'

import { useState, useTransition } from 'react'
import { processWebhooks, pruneWebhooks } from './webhook-actions'

export type WebhookStats = {
  pending: number
  done: number
  failed: number
  ignored: number
  lastReceivedAt: string | null
  recent: { deliveryId: string; topic: string; status: string; receivedAt: string; error: string | null }[]
}

const STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  PENDING: { label: 'Σε αναμονή', icon: '○', cls: 'bg-muted text-muted-foreground' },
  DONE:    { label: 'Έγινε',     icon: '✓', cls: 'bg-[var(--success)]/12 text-[var(--success)]' },
  IGNORED: { label: 'Αγνοήθηκε', icon: '–', cls: 'bg-muted text-muted-foreground' },
  FAILED:  { label: 'Απέτυχε',   icon: '⚠', cls: 'bg-destructive/10 text-destructive' },
}

export function WebhookPanel({
  stats, endpoint, configured, canRun,
}: {
  stats: WebhookStats
  endpoint: string
  configured: boolean
  canRun: boolean
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const r = await fn()
      setMsg(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error! })
    })
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Webhooks</h2>
          <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">
            Το WooCommerce μας ειδοποιεί όταν αλλάζει κάτι. Η ειδοποίηση αποθηκεύεται
            αμέσως και η ενημέρωση γίνεται μετά, ξεχωριστά — αλλιώς μια αργή ενημέρωση
            θα έκανε το WooCommerce να ξαναστέλνει το ίδιο event ξανά και ξανά.
          </p>
        </div>
        {canRun && (
          <button
            onClick={() => run(processWebhooks)}
            disabled={pending}
            className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Επεξεργασία…' : 'Επεξεργασία τώρα'}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 ${
          configured
            ? 'bg-[var(--success)]/12 text-[var(--success)]'
            : 'bg-destructive/10 text-destructive'
        }`}>
          {configured ? '✓ Μυστικό ρυθμισμένο' : '⚠ Λείπει το WOO_WEBHOOK_SECRET'}
        </span>
        <code className="rounded-full bg-muted px-3 py-1 text-muted-foreground">{endpoint}</code>
        {stats.lastReceivedAt && (
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            τελευταίο {when(stats.lastReceivedAt)}
          </span>
        )}
      </div>

      {msg && (
        <p
          role="status"
          className={`mt-3 rounded-xl px-3 py-2 text-[13px] ${
            msg.ok ? 'bg-[var(--success)]/12 text-[var(--success)]' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {msg.ok ? '✓ ' : '⚠ '}{msg.text}
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {([
          ['Σε αναμονή', stats.pending],
          ['Ολοκληρωμένα', stats.done],
          ['Αγνοημένα', stats.ignored],
          ['Απέτυχαν', stats.failed],
        ] as const).map(([label, n]) => (
          <div key={label} className="rounded-xl border border-border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </div>

      {stats.recent.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
          Δεν έχει φτάσει καμία ειδοποίηση ακόμα. Αν μόλις τα ενεργοποίησες, κάνε μια
          αλλαγή σε ένα προϊόν στο WooCommerce και ξαναφόρτωσε αυτή τη σελίδα.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Πότε</th>
                <th className="px-3 py-2">Γεγονός</th>
                <th className="px-3 py-2">Κατάσταση</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map(e => {
                const s = STATUS[e.status] ?? STATUS.PENDING
                return (
                  <tr key={e.deliveryId} className="border-b border-border/60 align-top last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{when(e.receivedAt)}</td>
                    <td className="px-3 py-2 font-mono">{e.topic}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${s.cls}`}>
                        <span aria-hidden>{s.icon}</span>{s.label}
                      </span>
                      {e.error && (
                        <p className="mt-1 max-w-[46ch] text-[11.5px] text-destructive">{e.error}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {canRun && stats.done + stats.ignored > 0 && (
        <button
          onClick={() => run(pruneWebhooks)}
          disabled={pending}
          className="mt-3 cursor-pointer text-xs text-muted-foreground underline hover:text-foreground"
        >
          Καθαρισμός events παλαιότερων των 30 ημερών
        </button>
      )}
    </section>
  )
}
