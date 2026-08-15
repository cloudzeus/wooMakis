import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'

export const dynamic = 'force-dynamic'

export default async function BrandsPage() {
  await requirePermission('brand.view')

  const brands = await prisma.brand.findMany({
    include: {
      translations: { orderBy: { locale: 'asc' } },
      _count: { select: { products: true } },
    },
  })

  const rows = brands
    .map(b => ({
      id: b.id,
      wooGroupKey: b.wooGroupKey,
      name: b.translations.find(t => t.locale === 'el')?.name ?? b.translations[0]?.name ?? '—',
      locales: b.translations.map(t => t.locale),
      products: b._count.products,
      count: b.count,
    }))
    .sort((a, b) => b.products - a.products || a.name.localeCompare(b.name, 'el'))

  const singleLanguage = rows.filter(r => r.locales.length < 2).length

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Μάρκες</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} μάρκες · {rows.reduce((n, r) => n + r.locales.length, 0)} μεταφράσεις
          {singleLanguage > 0 && ` · ${singleLanguage} με μία μόνο γλώσσα`}
        </p>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Μάρκα</th>
              <th className="px-4 py-3">Γλώσσες</th>
              <th className="px-4 py-3 text-right">Προϊόντα</th>
              <th className="px-4 py-3 text-right">Woo group</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/brands/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {r.locales.map(l => (
                      <span key={l} className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase">
                        {l}
                      </span>
                    ))}
                    {r.locales.length < 2 && (
                      <span
                        className="rounded-full bg-[var(--warning)]/12 px-2 py-0.5 text-[11px] text-[var(--warning)]"
                        title="Το Polylang δεν έχει συνδέσει δεύτερη γλώσσα για αυτή τη μάρκα"
                      >
                        ⚠ ασύνδετη
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.products}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">#{r.wooGroupKey}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
