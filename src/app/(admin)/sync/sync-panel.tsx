'use client'

import { useState, useTransition } from 'react'
import { syncCatalog, syncCustomers, syncOrders, type SyncResult } from './actions'

export type SyncJob = {
  key: 'catalog' | 'customers' | 'orders'
  title: string
  description: string
  /** What the last successful run of this target produced. */
  lastRun: string | null
  count: number
  countLabel: string
}

export function SyncPanel({ jobs, canRun }: { jobs: SyncJob[]; canRun: boolean }) {
  const [pending, start] = useTransition()
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<{ key: string; ok: boolean; text: string } | null>(null)
  const [withImages, setWithImages] = useState(false)

  function fire(key: SyncJob['key']) {
    setRunning(key)
    setResult(null)
    start(async () => {
      const r: SyncResult =
        key === 'catalog' ? await syncCatalog(withImages)
        : key === 'customers' ? await syncCustomers()
        : await syncOrders()
      setResult({ key, ok: r.ok, text: r.ok ? r.message : r.error })
      setRunning(null)
    })
  }

  return (
    <div className="space-y-3">
      {jobs.map(j => (
        <section key={j.key} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[16rem] flex-1">
              <h2 className="font-display text-base font-semibold">{j.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{j.description}</p>
              <p className="mt-2 text-[13px]">
                <strong className="tabular-nums">{j.count.toLocaleString('el-GR')}</strong>
                {' '}{j.countLabel}
                <span className="text-muted-foreground">
                  {' · '}
                  {j.lastRun ? `τελευταίος συγχρονισμός ${j.lastRun}` : 'δεν έχει τρέξει ποτέ'}
                </span>
              </p>

              {j.key === 'catalog' && (
                <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={withImages}
                    onChange={e => setWithImages(e.target.checked)}
                    className="size-4 cursor-pointer accent-[var(--navy)]"
                  />
                  Κατέβασμα εικόνων στο Bunny
                  <span className="text-muted-foreground">(αργό — μόνο νέες εικόνες κατεβαίνουν)</span>
                </label>
              )}
            </div>

            <button
              type="button"
              onClick={() => fire(j.key)}
              disabled={!canRun || pending}
              title={canRun ? undefined : 'Χρειάζεται το δικαίωμα sync.run'}
              className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running === j.key ? 'Εκτελείται…' : 'Εκτέλεση'}
            </button>
          </div>

          {running === j.key && (
            <p role="status" className="mt-3 rounded-xl bg-muted px-3 py-2 text-[13px] text-muted-foreground">
              Τρέχει. Οι παραγγελίες κατεβαίνουν σε σελίδες των 100 και θέλουν αρκετά
              λεπτά — μην κλείσεις τη σελίδα.
            </p>
          )}

          {result?.key === j.key && (
            <p
              role="status"
              className={`mt-3 rounded-xl px-3 py-2 text-[13px] ${
                result.ok
                  ? 'bg-[var(--success)]/12 text-[var(--success)]'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {result.ok ? '✓ ' : '⚠ '}{result.text}
            </p>
          )}
        </section>
      ))}
    </div>
  )
}
