import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { OrdersTable, type OrderRow } from './orders-table'

export const dynamic = 'force-dynamic'

/** Statuses that do not represent money taken. Kept in step with sync/orders.ts. */
const NON_REVENUE = ['cancelled', 'refunded', 'failed', 'trash']

export default async function OrdersPage() {
  await requirePermission('order.view')

  const orders = await prisma.order.findMany({
    orderBy: { dateCreated: 'desc' },
    include: { lines: true },
  })

  const rows: OrderRow[] = orders.map(o => ({
    id: o.id,
    wooId: o.wooId,
    number: o.number,
    status: o.status,
    total: Number(o.total),
    currency: o.currency,
    billingName: o.billingName,
    email: o.email,
    phone: o.phone,
    city: o.city,
    paymentMethodTitle: o.paymentMethodTitle,
    customerId: o.customerId,
    customerNote: o.customerNote,
    dateCreated: o.dateCreated.toISOString(),
    datePaid: o.datePaid?.toISOString() ?? null,
    lines: o.lines.map(l => ({
      name: l.name,
      sku: l.sku,
      quantity: l.quantity,
      total: Number(l.total),
      productId: l.productId,
      meta: (l.meta as Record<string, string> | null) ?? null,
    })),
  }))

  const revenue = rows
    .filter(r => !NON_REVENUE.includes(r.status))
    .reduce((n, r) => n + r.total, 0)

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Παραγγελίες</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} παραγγελίες · τζίρος {revenue.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          {' '}(εξαιρούνται ακυρωμένες, επιστροφές και αποτυχημένες)
        </p>
      </header>

      <p className="rounded-2xl bg-muted px-4 py-2.5 text-[13px] text-muted-foreground">
        Οι παραγγελίες είναι αντίγραφο από το WooCommerce και δεν επεξεργάζονται εδώ.
        Αλλαγή κατάστασης, επιστροφές και ακυρώσεις γίνονται στο WooCommerce, ώστε να
        μη διαφωνούν τα δύο συστήματα για το τι πληρώθηκε.
      </p>

      <OrdersTable rows={rows} wooBaseUrl={process.env.WOO_BASE_URL?.replace(/\/+$/, '') ?? null} />
    </section>
  )
}
