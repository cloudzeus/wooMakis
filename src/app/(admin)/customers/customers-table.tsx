'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'

export type CustomerRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  city: string | null
  postcode: string | null
  address: string | null
  country: string | null
  source: 'WOO' | 'GUEST' | 'LOCAL'
  wooCustomerId: number | null
  orderCount: number
  totalSpent: number
  lastOrderAt: string | null
  afm: string | null
}

function SourceBadge({ source }: { source: CustomerRow['source'] }) {
  // Icon plus word, never colour alone.
  const map = {
    WOO: { icon: '✓', label: 'Λογαριασμός', cls: 'bg-[var(--success)]/12 text-[var(--success)]' },
    GUEST: { icon: '◇', label: 'Επισκέπτης', cls: 'bg-muted text-muted-foreground' },
    LOCAL: { icon: '✎', label: 'Τοπικός', cls: 'bg-[var(--info)]/12 text-[var(--info)]' },
  } as const
  const s = map[source]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>{s.label}
    </span>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('el-GR')
}

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const columns = useMemo<ColumnDef<CustomerRow, unknown>[]>(() => [
    {
      id: 'name',
      header: 'Όνομα',
      accessorFn: r => r.name,
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <div className="font-medium">{row.original.name}</div>
          {row.original.company && (
            <div className="text-xs text-muted-foreground">{row.original.company}</div>
          )}
        </div>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      accessorFn: r => r.email ?? '',
      cell: ({ row }) => row.original.email
        ? <a href={`mailto:${row.original.email}`} className="hover:underline">{row.original.email}</a>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'phone',
      header: 'Τηλέφωνο',
      accessorFn: r => r.phone ?? '',
      cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span>,
    },
    { id: 'city', header: 'Πόλη', accessorFn: r => r.city ?? '' },
    {
      id: 'source',
      header: 'Τύπος',
      accessorFn: r => r.source,
      cell: ({ row }) => <SourceBadge source={row.original.source} />,
    },
    {
      id: 'orders',
      header: 'Παραγγελίες',
      accessorKey: 'orderCount',
      cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
    },
    {
      id: 'spent',
      header: 'Σύνολο',
      accessorKey: 'totalSpent',
      cell: ({ getValue }) => (
        <span className="tabular-nums font-medium">{(getValue() as number).toFixed(2)} €</span>
      ),
    },
    {
      id: 'last',
      header: 'Τελευταία',
      accessorFn: r => r.lastOrderAt ?? '',
      cell: ({ row }) => <span className="tabular-nums">{fmtDate(row.original.lastOrderAt)}</span>,
    },
  ], [])

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Αναζήτηση ονόματος, email, τηλεφώνου…"
      emptyMessage="Δεν υπάρχουν πελάτες. Τρέξε συγχρονισμό πελατών."
      renderDetail={row => (
        <div className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Woo customer id" value={row.wooCustomerId ? String(row.wooCustomerId) : 'χωρίς λογαριασμό'} />
          <Field label="ΑΦΜ" value={row.afm ?? '—'} />
          <Field label="Διεύθυνση" value={row.address ?? '—'} />
          <Field label="Τ.Κ." value={row.postcode ?? '—'} />
          <Field label="Πόλη" value={row.city ?? '—'} />
          <Field label="Χώρα" value={row.country ?? '—'} />
          <Field label="Παραγγελίες" value={String(row.orderCount)} />
          <Field label="Συνολική αξία" value={`${row.totalSpent.toFixed(2)} €`} />
          {row.source === 'GUEST' && (
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
              Δεν έχει λογαριασμό στο WooCommerce. Τα στοιχεία προέρχονται από τις
              παραγγελίες του και δεν στέλνονται πίσω.
            </p>
          )}
        </div>
      )}
    />
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
