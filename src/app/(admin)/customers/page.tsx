import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { CustomersTable, type CustomerRow } from './customers-table'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  await requirePermission('customer.view')

  const customers = await prisma.customer.findMany({
    orderBy: [{ totalSpent: 'desc' }, { NAME: 'asc' }],
  })

  const rows: CustomerRow[] = customers.map(c => ({
    id: c.id,
    name: c.NAME,
    email: c.EMAIL,
    phone: c.PHONE01,
    company: c.company,
    city: c.CITY,
    postcode: c.ZIP,
    address: c.ADDRESS,
    country: c.COUNTRY,
    source: c.source,
    wooCustomerId: c.wooCustomerId,
    orderCount: c.orderCount,
    totalSpent: Number(c.totalSpent),
    lastOrderAt: c.lastOrderAt?.toISOString() ?? null,
    afm: c.AFM,
  }))

  const registered = rows.filter(r => r.source === 'WOO').length
  const guests = rows.filter(r => r.source === 'GUEST').length
  const revenue = rows.reduce((n, r) => n + r.totalSpent, 0)

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Πελάτες</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} συνολικά · {registered} με λογαριασμό · {guests} επισκέπτες ·{' '}
          <span className="tabular-nums">{revenue.toFixed(2)} €</span> συνολική αξία
        </p>
      </header>

      <CustomersTable rows={rows} wooBaseUrl={process.env.WOO_BASE_URL?.replace(/\/+$/, '') ?? null} />
    </section>
  )
}
