import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/rbac'
import { requirePermission } from '@/lib/rbac-server'
import { CustomerEditor } from './customer-editor'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requirePermission('customer.view')

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { orders: { orderBy: { dateCreated: 'desc' } } },
  })
  if (!customer) notFound()

  return (
    <section className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href="/customers" className="hover:text-foreground">Πελάτες</Link>
        <span className="mx-1">/</span>
        <span>{customer.NAME}</span>
      </nav>

      <CustomerEditor
        id={customer.id}
        source={customer.source}
        wooCustomerId={customer.wooCustomerId}
        canEdit={can(session, 'customer.edit')}
        initial={{
          NAME: customer.NAME,
          firstName: customer.firstName ?? '',
          lastName: customer.lastName ?? '',
          company: customer.company ?? '',
          EMAIL: customer.EMAIL ?? '',
          PHONE01: customer.PHONE01 ?? '',
          AFM: customer.AFM ?? '',
          IRSDATA: customer.IRSDATA ?? '',
          JOBTYPETRD: customer.JOBTYPETRD ?? '',
          ADDRESS: customer.ADDRESS ?? '',
          ZIP: customer.ZIP ?? '',
          CITY: customer.CITY ?? '',
          DISTRICT: customer.DISTRICT ?? '',
          COUNTRY: customer.COUNTRY ?? '',
          REMARKS: customer.REMARKS ?? '',
          ISACTIVE: customer.ISACTIVE === 1,
        }}
        orders={customer.orders.map(o => ({
          id: o.id,
          number: o.number,
          status: o.status,
          total: Number(o.total),
          dateCreated: o.dateCreated.toISOString(),
        }))}
      />
    </section>
  )
}
