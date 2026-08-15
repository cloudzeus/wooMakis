'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'
import { RowActions } from '@/components/admin/row-actions'
import { sortPrescription } from '@/lib/lens-fields'

export type OrderLineRow = {
  name: string
  sku: string | null
  quantity: number
  total: number
  productId: string | null
  /** The prescription, as WooCommerce recorded it on the line. */
  meta: Record<string, string> | null
}

export type OrderRow = {
  id: string
  wooId: number
  number: string
  status: string
  total: number
  currency: string
  billingName: string
  email: string | null
  phone: string | null
  city: string | null
  paymentMethodTitle: string | null
  customerId: string | null
  customerNote: string | null
  dateCreated: string
  datePaid: string | null
  lines: OrderLineRow[]
}

/**
 * WooCommerce's own status vocabulary. Colour is never the only signal — each
 * carries a glyph and a Greek word, because "which of these greys is refunded"
 * is not a question a list should ask.
 */
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

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, icon: '•', cls: 'bg-muted text-muted-foreground' }
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>{s.label}
    </span>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('el-GR')
}

export function OrdersTable({ rows, wooBaseUrl }: { rows: OrderRow[]; wooBaseUrl: string | null }) {
  const columns = useMemo<ColumnDef<OrderRow, unknown>[]>(() => [
    {
      id: 'number',
      header: 'Αρ.',
      accessorFn: r => r.number,
      cell: ({ row }) => <span className="font-medium tabular-nums">#{row.original.number}</span>,
    },
    {
      id: 'date',
      header: 'Ημερομηνία',
      accessorFn: r => r.dateCreated,
      cell: ({ row }) => <span className="tabular-nums">{fmtDate(row.original.dateCreated)}</span>,
    },
    {
      id: 'customer',
      header: 'Πελάτης',
      accessorFn: r => `${r.billingName} ${r.email ?? ''}`,
      cell: ({ row }) => (
        <div className="min-w-[170px]">
          <div className="font-medium">{row.original.billingName}</div>
          {row.original.email && (
            <div className="text-xs text-muted-foreground">{row.original.email}</div>
          )}
        </div>
      ),
    },
    { id: 'city', header: 'Πόλη', accessorFn: r => r.city ?? '' },
    {
      id: 'status',
      header: 'Κατάσταση',
      accessorFn: r => STATUS[r.status]?.label ?? r.status,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'items',
      header: 'Είδη',
      accessorFn: r => r.lines.reduce((n, l) => n + l.quantity, 0),
      cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
    },
    {
      id: 'payment',
      header: 'Πληρωμή',
      accessorFn: r => r.paymentMethodTitle ?? '',
      cell: ({ getValue }) =>
        (getValue() as string) || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'total',
      header: 'Σύνολο',
      accessorKey: 'total',
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-medium tabular-nums">
          {row.original.total.toFixed(2)} €
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const o = row.original
        return (
          <div className="flex justify-end">
            <RowActions
              label={`Ενέργειες για την παραγγελία #${o.number}`}
              actions={[
                { label: 'Λεπτομέρειες', href: `/orders/${o.id}` },
                {
                  label: 'Καρτέλα πελάτη',
                  href: o.customerId ? `/customers/${o.customerId}` : undefined,
                  disabled: !o.customerId,
                  hint: o.customerId ? undefined : 'Η παραγγελία δεν συνδέθηκε με πελάτη',
                },
                {
                  label: 'Αποστολή email',
                  href: o.email ? `mailto:${o.email}` : undefined,
                  disabled: !o.email,
                  hint: o.email ? undefined : 'Δεν υπάρχει email στη χρέωση',
                },
                {
                  label: 'Άνοιγμα στο WooCommerce',
                  href: wooBaseUrl ? `${wooBaseUrl}/wp-admin/post.php?post=${o.wooId}&action=edit` : undefined,
                  external: true,
                  disabled: !wooBaseUrl,
                  hint: 'Οι αλλαγές κατάστασης γίνονται στο WooCommerce — εδώ είναι μόνο αντίγραφο',
                },
              ]}
            />
          </div>
        )
      },
    },
  ], [wooBaseUrl])

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Αναζήτηση αριθμού, ονόματος, email, πόλης…"
      emptyMessage="Δεν υπάρχουν παραγγελίες. Τρέξε συγχρονισμό παραγγελιών."
      renderDetail={row => <OrderDetail order={row} />}
    />
  )
}

function OrderDetail({ order }: { order: OrderRow }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Woo id" value={`#${order.wooId}`} />
        <Field label="Πληρώθηκε" value={fmtDate(order.datePaid)} />
        <Field label="Τρόπος πληρωμής" value={order.paymentMethodTitle ?? '—'} />
        <Field label="Τηλέφωνο" value={order.phone ?? '—'} />
        <Field label="Πόλη" value={order.city ?? '—'} />
      </div>

      {order.customerNote && (
        <p className="rounded-xl bg-card px-3 py-2 text-[13px]">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Σημείωση πελάτη: </span>
          {order.customerNote}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Προϊόν</th>
              <th className="px-3 py-2">Συνταγή</th>
              <th className="px-3 py-2 text-right">Ποσ.</th>
              <th className="px-3 py-2 text-right">Σύνολο</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l, i) => (
              <tr key={i} className="border-b border-border/60 align-top last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{l.name}</div>
                  {l.sku && <div className="text-[11px] text-muted-foreground">SKU {l.sku}</div>}
                </td>
                <td className="px-3 py-2">
                  {l.meta && Object.keys(l.meta).length > 0 ? (
                    <dl className="flex flex-wrap gap-x-4 gap-y-0.5">
                      {sortPrescription(l.meta).map(([k, v]) => (
                        <div key={k} className="flex items-baseline gap-1">
                          <dt className="text-[11px] text-muted-foreground">{k}</dt>
                          <dd className="font-medium tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.total.toFixed(2)} €</td>
              </tr>
            ))}
            {order.lines.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                  Η παραγγελία δεν έχει γραμμές.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div>{value}</div>
    </div>
  )
}
