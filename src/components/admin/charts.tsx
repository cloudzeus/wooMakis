/**
 * Charts for the dashboard.
 *
 * Plain SVG, rendered on the server, no charting library. Three reasons: the
 * shapes here are bars and a sparkline, which is a few lines of arithmetic; a
 * library would push these panels into client components and ship a bundle to
 * draw eleven rectangles; and every value is also printed as text, so the
 * picture is a shortcut rather than the only way to read the number.
 *
 * Colour is never the sole carrier of meaning — each series is labelled.
 */

export function Stat({
  label, value, sub, tone = 'plain',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'plain' | 'good' | 'warn' | 'bad'
}) {
  const tint = {
    plain: 'text-foreground',
    good: 'text-[var(--success)]',
    warn: 'text-[var(--warning)]',
    bad: 'text-destructive',
  }[tone]
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${tint}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

export type Bar = { label: string; value: number; hint?: string }

/**
 * Horizontal bars. Used where the labels are words — statuses, product names —
 * because vertical bars would either rotate the text or truncate it.
 */
export function BarList({
  bars, format = v => String(v), emptyMessage = 'Χωρίς δεδομένα.',
}: {
  bars: Bar[]
  format?: (v: number) => string
  emptyMessage?: string
}) {
  const max = Math.max(1, ...bars.map(b => b.value))
  if (bars.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }
  return (
    <ul className="space-y-1.5">
      {bars.map(b => (
        <li key={b.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
          <span className="truncate text-[13px]" title={b.hint ?? b.label}>{b.label}</span>
          <span className="text-[13px] font-medium tabular-nums">{format(b.value)}</span>
          <span
            className="col-span-2 h-1.5 rounded-full bg-muted"
            role="presentation"
          >
            <span
              className="block h-1.5 rounded-full bg-[var(--navy)]"
              style={{ width: `${Math.max(2, (b.value / max) * 100)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Monthly columns. Bars are drawn with plain divs rather than SVG so they
 * reflow with the container instead of needing a fixed viewBox.
 */
export function MonthlyBars({
  months, format,
}: {
  months: { label: string; value: number; secondary?: number }[]
  format: (v: number) => string
}) {
  const max = Math.max(1, ...months.map(m => m.value))
  return (
    <div>
      {/* Each column is h-full so the bar's percentage height resolves against
          a known box. Against an auto-height flex column it resolves to zero
          and the chart renders as a row of labels with no bars. */}
      <div className="flex h-40 items-end gap-1.5">
        {months.map(m => (
          <div key={m.label} className="flex h-full flex-1 flex-col justify-end gap-1">
            <span className="text-center text-[10px] tabular-nums text-muted-foreground">
              {m.value > 0 ? format(m.value) : ''}
            </span>
            <div
              className="w-full rounded-t bg-[var(--navy)]"
              style={{ height: `${Math.max(2, (m.value / max) * 100)}%` }}
              title={`${m.label}: ${format(m.value)}${m.secondary != null ? ` (${m.secondary} παραγγελίες)` : ''}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {months.map(m => (
          <span key={m.label} className="flex-1 text-center text-[10px] text-muted-foreground">
            {m.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Panel({
  title, hint, children, action,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {action}
      </div>
      {hint && <p className="mb-3 -mt-2 text-[12.5px] text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}
