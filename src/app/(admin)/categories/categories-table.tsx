'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'

export type CategoryRow = {
  id: string
  wooGroupKey: number
  parentName: string | null
  menuOrder: number
  count: number
  nameEl: string | null
  nameEn: string | null
  slugEl: string | null
  slugEn: string | null
  descriptionEl: string | null
  locales: string[]
  productCount: number
}

export function CategoriesTable({ rows }: { rows: CategoryRow[] }) {
  const columns = useMemo<ColumnDef<CategoryRow, unknown>[]>(() => [
    {
      id: 'name',
      header: 'Όνομα (el)',
      accessorFn: r => r.nameEl ?? '',
      cell: ({ row }) => <span className="font-medium">{row.original.nameEl ?? '—'}</span>,
    },
    { id: 'nameEn', header: 'Όνομα (en)', accessorFn: r => r.nameEn ?? '', cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span> },
    { id: 'slug', header: 'Slug', accessorFn: r => r.slugEl ?? '' },
    {
      id: 'parent',
      header: 'Γονική',
      accessorFn: r => r.parentName ?? '',
      cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">— (ριζική)</span>,
    },
    {
      id: 'productCount',
      header: 'Προϊόντα',
      accessorKey: 'productCount',
      cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
    },
    {
      id: 'wooCount',
      header: 'Woo count',
      accessorKey: 'count',
      cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue() as number}</span>,
    },
    { id: 'menuOrder', header: 'Σειρά', accessorKey: 'menuOrder', cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span> },
  ], [])

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Αναζήτηση κατηγορίας…"
      emptyMessage="Δεν υπάρχουν κατηγορίες. Τρέξε συγχρονισμό."
      renderDetail={row => (
        <div className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Woo group key</span>
            <div>{row.wooGroupKey}</div>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Slug (en)</span>
            <div>{row.slugEn ?? '—'}</div>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Γλώσσες</span>
            <div>{row.locales.join(', ')}</div>
          </div>
          {row.descriptionEl && (
            <div className="sm:col-span-2 lg:col-span-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Περιγραφή</span>
              <div className="text-muted-foreground">{row.descriptionEl}</div>
            </div>
          )}
        </div>
      )}
    />
  )
}
