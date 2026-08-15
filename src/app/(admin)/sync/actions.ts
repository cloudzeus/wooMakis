'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { runFullPull } from '@/lib/sync/run'
import { pullCustomers } from '@/lib/sync/customers'
import { pullOrders, recomputeCustomerTotals } from '@/lib/sync/orders'

export type SyncResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * Every job is wrapped so a failure is recorded rather than thrown at the
 * screen. A sync that dies silently is the worst outcome here: the operator
 * assumes the mirror is current and it is not.
 */
async function run(
  target: string,
  job: () => Promise<{ created?: number; updated?: number; skipped?: number; failed?: number; summary: string }>,
): Promise<SyncResult> {
  const startedAt = new Date()
  const log = await prisma.syncLog.create({
    data: { target, direction: 'PULL', outcome: 'FAILED', startedAt },
  })
  try {
    const r = await job()
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        outcome: (r.failed ?? 0) > 0 ? 'PARTIAL' : 'SUCCESS',
        finishedAt: new Date(),
        created: r.created ?? 0,
        updated: r.updated ?? 0,
        skipped: r.skipped ?? 0,
        failed: r.failed ?? 0,
      },
    })
    revalidatePath('/sync')
    revalidatePath('/dashboard')
    return { ok: true, message: r.summary }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { outcome: 'FAILED', finishedAt: new Date(), error: message.slice(0, 1000) },
    })
    revalidatePath('/sync')
    return { ok: false, error: message }
  }
}

export async function syncCatalog(withImages: boolean): Promise<SyncResult> {
  await requirePermission('sync.run')
  return run('catalog', async () => {
    const r = await runFullPull({ withImages })
    return {
      created: r.categories.created + r.brands.created + r.products.created,
      updated: r.categories.updated + r.brands.updated + r.products.updated,
      skipped: r.images.skipped,
      failed: r.images.failed,
      summary:
        `Κατηγορίες ${r.categories.created}+${r.categories.updated}, ` +
        `μάρκες ${r.brands.created}+${r.brands.updated}, ` +
        `προϊόντα ${r.products.created}+${r.products.updated}, ` +
        `εικόνες ${r.images.mirrored} νέες / ${r.images.skipped} υπήρχαν / ${r.images.failed} απέτυχαν, ` +
        `συνδέσεις ${r.links.linked} (${r.links.unresolved} ανεπίλυτες).`,
    }
  })
}

export async function syncCustomers(): Promise<SyncResult> {
  await requirePermission('sync.run')
  return run('customers', async () => {
    const r = await pullCustomers()
    return {
      created: r.registered + r.guests,
      updated: r.updated,
      summary: `${r.registered} λογαριασμοί, ${r.guests} επισκέπτες από παραγγελίες, ${r.updated} ενημερώθηκαν.`,
    }
  })
}

export async function syncOrders(): Promise<SyncResult> {
  await requirePermission('sync.run')
  return run('orders', async () => {
    const r = await pullOrders()
    const t = await recomputeCustomerTotals()
    return {
      created: r.created,
      updated: r.updated,
      summary:
        `${r.fetched} παραγγελίες (${r.created} νέες, ${r.updated} ενημερώθηκαν), ` +
        `${r.linesWritten} γραμμές, ${r.linkedToProduct} συνδέθηκαν με προϊόν, ` +
        `${t.updated} πελάτες ενημερώθηκαν με σύνολα.`,
    }
  })
}
