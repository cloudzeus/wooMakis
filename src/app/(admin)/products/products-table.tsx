'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/data-table'

export type ProductTranslationDetail = {
  locale: string
  /** Null for a locally created translation with no WooCommerce post yet. */
  wooId: number | null
  name: string
  slug: string
  shortDescription: string | null
  description: string | null
  permalink: string | null
  wooModifiedAt: string | null
}

export type ProductRow = {
  id: string
  wooGroupKey: number
  sku: string | null
  type: string
  status: string
  featured: boolean
  price: string | null
  regularPrice: string | null
  onSale: boolean
  manageStock: boolean
  stockStatus: string
  stockQuantity: number | null
  menuOrder: number
  totalSales: number
  createdAt: string
  updatedAt: string
  nameEl: string | null
  nameEn: string | null
  slugEl: string | null
  permalinkEl: string | null
  locales: string[]
  categories: string[]
  thumbUrl: string | null
  imageCount: number
  images: { assetId: string; cdnUrl: string; mimeType: string; bytes: number; width: number | null; height: number | null }[]
  translations: ProductTranslationDetail[]
  variationCount: number
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
      renderDetail={row => <ProductDetail row={row} />}
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

/** Strips WooCommerce's HTML so descriptions read as text in a table row. */
function plain(html: string | null): string {
  if (!html) return '—'
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || '—'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('el-GR')
}

function ProductDetail({ row }: { row: ProductRow }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/products/${row.id}`}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Επεξεργασία προϊόντος
        </Link>
        {row.permalinkEl && (
          <a href={row.permalinkEl} target="_blank" rel="noopener noreferrer"
             className="rounded-full border border-border px-4 py-1.5 text-xs hover:bg-accent">
            Άνοιγμα στο mylens.gr ↗
          </a>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Γενικά στοιχεία
        </h4>
        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Woo group key" value={String(row.wooGroupKey)} />
          <Field label="SKU" value={row.sku ?? '—'} />
          <Field label="Τύπος" value={row.type} />
          <Field label="Κατάσταση" value={row.status} />
          <Field label="Προβεβλημένο" value={row.featured ? 'Ναι' : 'Όχι'} />
          <Field label="Τιμή" value={row.price ? `${Number(row.price).toFixed(2)} €` : '—'} />
          <Field label="Κανονική τιμή" value={row.regularPrice ? `${Number(row.regularPrice).toFixed(2)} €` : '—'} />
          <Field label="Σε προσφορά" value={row.onSale ? 'Ναι' : 'Όχι'} />
          <Field label="Διαχείριση αποθέματος" value={row.manageStock ? 'Ναι' : 'Όχι'} />
          <Field label="Απόθεμα" value={`${row.stockStatus}${row.stockQuantity !== null ? ` (${row.stockQuantity})` : ''}`} />
          <Field label="Σειρά" value={String(row.menuOrder)} />
          <Field label="Πωλήσεις" value={String(row.totalSales)} />
          <Field label="Παραλλαγές" value={String(row.variationCount)} />
          <Field label="Κατηγορίες" value={row.categories.length ? row.categories.join(', ') : '—'} />
          <Field label="Τοπικά ενημερώθηκε" value={fmtDate(row.updatedAt)} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Μεταφράσεις ({row.translations.length})
        </h4>
        <div className="grid gap-3 lg:grid-cols-2">
          {row.translations.map(t => (
            <div key={t.locale} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-[var(--navy)]/10 px-2 py-0.5 text-[11px] uppercase text-[var(--navy)]">
                  {t.locale}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.wooId ? `Woo #${t.wooId}` : 'τοπική'}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  Woo: {fmtDate(t.wooModifiedAt)}
                </span>
              </div>
              <div className="space-y-1.5">
                <Field label="Όνομα" value={t.name} />
                <Field label="Slug" value={t.slug} />
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Σύντομη περιγραφή</span>
                  <p className="text-muted-foreground">{plain(t.shortDescription)}</p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Περιγραφή</span>
                  <p className="line-clamp-4 text-muted-foreground">{plain(t.description)}</p>
                </div>
              </div>
            </div>
          ))}
          {row.translations.length < 2 && (
            <div className="rounded-xl border border-dashed border-[var(--warning)]/40 bg-[var(--warning)]/5 p-3 text-sm text-[var(--warning)]">
              ⚠ Λείπει μετάφραση — το προϊόν υπάρχει μόνο στα «{row.translations[0]?.locale}».
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Εικόνες ({row.imageCount})
        </h4>
        {row.images.length === 0 ? (
          <p className="text-sm text-muted-foreground">Καμία εικόνα.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {row.images.map(img => (
              <li key={img.assetId} className="w-28">
                <Image
                  src={img.cdnUrl}
                  alt=""
                  width={112}
                  height={112}
                  className="aspect-square w-full rounded-[10px] border border-border object-cover"
                  unoptimized
                />
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {img.mimeType.replace('image/', '').toUpperCase()} · {Math.round(img.bytes / 1024)} KB
                  {img.width && img.height && <><br />{img.width}×{img.height}</>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
