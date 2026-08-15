'use client'

import { useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

/**
 * The one table used by every list screen. Screens supply columns only.
 *
 * Implemented: global search, sorting, column show/hide, page-size selector,
 * numbered pagination, expandable detail rows.
 * Deferred (spec §4α): column resize, inline edit, bulk actions, Excel export,
 * per-user persisted view state.
 */
type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  searchPlaceholder?: string
  /** Renders under a row when its chevron is clicked. Omit to disable expansion. */
  renderDetail?: (row: T) => React.ReactNode
  emptyMessage?: string
}

const PAGE_SIZES = [25, 50, 100]

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = 'Αναζήτηση…',
  renderDetail,
  emptyMessage = 'Δεν βρέθηκαν εγγραφές.',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [showColumns, setShowColumns] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const total = table.getFilteredRowModel().rows.length
  const from = total === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, total)
  const pageCount = table.getPageCount()

  return (
    <div className="space-y-3">
      {/* Toolbar: search left, column picker right */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-72 rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumns(v => !v)}
            aria-expanded={showColumns}
            className="h-9 cursor-pointer rounded-full border border-border bg-card px-4 text-sm hover:bg-accent"
          >
            Στήλες ▾
          </button>
          {showColumns && (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-2xl border border-border bg-card p-2 shadow-lg">
              {table.getAllLeafColumns().map(col => (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                  />
                  {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-card">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-border">
                {renderDetail && <th className="w-8" />}
                {hg.headers.map(header => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex cursor-pointer items-center gap-1 hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden>{sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}</span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length + (renderDetail ? 1 : 0)}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row, i) => (
              <tr key={row.id} className="h-10 border-b border-border/60 last:border-0 hover:bg-accent/40">
                {renderDetail && (
                  <td className="px-2">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                      aria-expanded={expanded === i}
                      aria-label={expanded === i ? 'Σύμπτυξη' : 'Ανάπτυξη'}
                      className="cursor-pointer px-1 text-muted-foreground hover:text-foreground"
                    >
                      {expanded === i ? '▾' : '▸'}
                    </button>
                  </td>
                )}
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {renderDetail &&
              expanded !== null &&
              table.getRowModel().rows[expanded] && (
                <tr>
                  <td
                    colSpan={table.getAllLeafColumns().length + 1}
                    className="bg-muted/50 px-5 py-4"
                  >
                    {renderDetail(table.getRowModel().rows[expanded].original)}
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      {/* Footer: page size, range, numbered pager */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <label className="flex items-center gap-2">
          Εγγραφές:
          <select
            value={pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            className="h-8 cursor-pointer rounded-full border border-border bg-card px-3"
          >
            {PAGE_SIZES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <span>{from}–{to} από {total}</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 cursor-pointer rounded-full border border-border bg-card px-3 disabled:opacity-40"
          >
            Προηγούμενη
          </button>
          <span className="px-2">{pageIndex + 1} / {Math.max(pageCount, 1)}</span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 cursor-pointer rounded-full border border-border bg-card px-3 disabled:opacity-40"
          >
            Επόμενη
          </button>
        </div>
      </div>
    </div>
  )
}
