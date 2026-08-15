'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'

export type ProductRow = {
  id: string
  wooGroupKey: number
  sku: string | null
  type: string
  status: string
  price: string | null
  regularPrice: string | null
  onSale: boolean
  stockStatus: string
  stockQuantity: number | null
  totalSales: number
  nameEl: string | null
  nameEn: string | null
  slugEl: string | null
  permalinkEl: string | null
  locales: string[]
  categories: string[]
  thumbUrl: string | null
  imageCount: number
}

function Money({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return <span className="tabular-nums">{Number(value).toFixed(2)} €</span>
}

function StatusBadge({ status }: { status: string }) {
  // Colour never carries meaning alone — always icon + word (design system §2).
  const map: Record<string, { icon: string; label: string; cls: string }> = {
    publish: { icon: '✓', label: 'Δημοσιευμένο', cls: 'bg-[var(--success)]/12 text-[var(--success)]' },
    draft: { icon: '✎', label: 'Πρόχειρο', cls: 'bg-muted text-muted-foreground' },
    private: { icon: '🔒', label: 'Ιδιωτικό', cls: 'bg-muted text-muted-foreground' },
  }
  const s = map[status] ?? { icon: '•', label: status, cls: 'bg-muted text-muted-foreground' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>{s.label}
    </span>
  )
}

export function ProductsTable({ rows }: { rows: ProductRow[] }) {
  const columns = useMemo<ColumnDef<ProductRow, unknown>[]>(() => [
    {
      id: 'image',
      header: 'Εικόνα',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.thumbUrl ? (
          <Image
            src={row.original.thumbUrl}
            alt=""
            width={36}
            height={36}
            className="rounded-[10px] object-cover"
            unoptimized
          />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-muted text-[10px] text-muted-foreground">
            —
          </div>
        ),
    },
    {
      id: 'name',
      header: 'Όνομα',
      accessorFn: r => r.nameEl ?? r.nameEn ?? '',
      cell: ({ row }) => (
        <div className="min-w-[220px]">
          <Link href={`/products/${row.original.id}`} className="font-medium hover:underline">
            {row.original.nameEl ?? row.original.nameEn}
          </Link>
          {row.original.nameEn && row.original.nameEl && (
            <div className="text-xs text-muted-foreground">{row.original.nameEn}</div>
          )}
        </div>
      ),
    },
    { id: 'sku', header: 'SKU', accessorFn: r => r.sku ?? '', cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span> },
    { id: 'type', header: 'Τύπος', accessorKey: 'type' },
    { id: 'status', header: 'Κατάσταση', accessorKey: 'status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'price',
      header: 'Τιμή',
      accessorFn: r => Number(r.price ?? 0),
      cell: ({ row }) => (
        <div className="text-right">
          <Money value={row.original.price} />
          {row.original.onSale && (
            <div className="text-xs text-[var(--coral)] line-through tabular-nums">
              {Number(row.original.regularPrice).toFixed(2)} €
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'stock',
      header: 'Απόθεμα',
      accessorFn: r => r.stockStatus,
      cell: ({ row }) => (
        <span className={row.original.stockStatus === 'instock' ? '' : 'text-[var(--warning)]'}>
          {row.original.stockStatus === 'instock' ? '✓ Διαθέσιμο' : '⚠ Εξαντλημένο'}
          {row.original.stockQuantity !== null && (
            <span className="ml-1 tabular-nums text-muted-foreground">({row.original.stockQuantity})</span>
          )}
        </span>
      ),
    },
    {
      id: 'locales',
      header: 'Γλώσσες',
      accessorFn: r => r.locales.join(','),
      cell: ({ row }) => {
        const has = (l: string) => row.original.locales.includes(l)
        return (
          <span className="flex gap-1">
            {['el', 'en'].map(l => (
              <span
                key={l}
                title={has(l) ? `Υπάρχει μετάφραση ${l}` : `Λείπει μετάφραση ${l}`}
                className={`rounded-full px-1.5 py-0.5 text-[11px] uppercase ${
                  has(l) ? 'bg-[var(--navy)]/10 text-[var(--navy)]' : 'bg-muted text-muted-foreground line-through'
                }`}
              >
                {l}
              </span>
            ))}
          </span>
        )
      },
    },
    { id: 'sales', header: 'Πωλήσεις', accessorKey: 'totalSales', cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span> },
  ], [])

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Αναζήτηση προϊόντος, SKU…"
      emptyMessage="Δεν υπάρχουν προϊόντα. Τρέξε συγχρονισμό για να τα κατεβάσεις από το WooCommerce."
      renderDetail={row => (
        <div className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Woo group key" value={String(row.wooGroupKey)} />
          <Field label="Slug (el)" value={row.slugEl ?? '—'} />
          <Field label="Κατηγορίες" value={row.categories.length ? row.categories.join(', ') : '—'} />
          <Field label="Εικόνες" value={String(row.imageCount)} />
          <Field label="Κανονική τιμή" value={row.regularPrice ? `${Number(row.regularPrice).toFixed(2)} €` : '—'} />
          <Field label="Σε προσφορά" value={row.onSale ? 'Ναι' : 'Όχι'} />
          {row.permalinkEl && (
            <div className="sm:col-span-2 lg:col-span-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Στο mylens.gr</span>
              <div>
                <a href={row.permalinkEl} target="_blank" rel="noopener noreferrer"
                   className="text-[var(--info)] underline underline-offset-2">
                  {row.permalinkEl}
                </a>
              </div>
            </div>
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
