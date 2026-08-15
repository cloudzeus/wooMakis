import { prisma } from '@/lib/prisma'
import { pullOrders, recomputeCustomerTotals } from '@/lib/sync/orders'
import { pullCustomers } from '@/lib/sync/customers'
import { runFullPull } from '@/lib/sync/run'

/**
 * Drains the webhook inbox.
 *
 * Deliberately coarse. WooCommerce tells us *that* a product changed; it does
 * not tell us anything the existing pull cannot fetch more reliably, and the
 * payload it sends is a snapshot that may already be stale by the time we act
 * on it. So an event marks what needs refreshing and the normal sync does the
 * refreshing — one code path for both manual and event-driven updates, rather
 * than a second, subtly different importer that only runs on webhooks.
 *
 * Events are also COALESCED: fifty product updates in a minute become one
 * catalogue pull, not fifty. That is the whole reason for batching by topic
 * rather than processing row by row.
 */

export type DrainResult = {
  claimed: number
  done: number
  failed: number
  ignored: number
  ran: string[]
}

/** Topics we act on, mapped to the sync each one triggers. */
type Job = 'catalog' | 'orders' | 'customers'

function jobFor(topic: string): Job | null {
  const resource = topic.split('.')[0]
  if (resource === 'product') return 'catalog'
  if (resource === 'order') return 'orders'
  if (resource === 'customer') return 'customers'
  return null
}

/**
 * @param max how many events to claim in one pass. A cap keeps a backlog from
 *        turning into one enormous transaction after an outage.
 */
export async function drainWebhookInbox({ max = 200 } = {}): Promise<DrainResult> {
  const pending = await prisma.webhookEvent.findMany({
    where: { status: 'PENDING' },
    orderBy: { receivedAt: 'asc' },
    take: max,
  })

  const result: DrainResult = { claimed: pending.length, done: 0, failed: 0, ignored: 0, ran: [] }
  if (pending.length === 0) return result

  const actionable = new Map<Job, string[]>()
  const ignored: string[] = []

  for (const e of pending) {
    const job = jobFor(e.topic)
    if (!job) { ignored.push(e.id); continue }
    actionable.set(job, [...(actionable.get(job) ?? []), e.id])
  }

  if (ignored.length) {
    await prisma.webhookEvent.updateMany({
      where: { id: { in: ignored } },
      data: { status: 'IGNORED', processedAt: new Date() },
    })
    result.ignored = ignored.length
  }

  for (const [job, ids] of actionable) {
    try {
      // Images are skipped on a webhook-driven catalogue pull: mirroring to
      // Bunny is minutes of work and would hold the worker open while more
      // events pile up behind it. The scheduled full sync picks them up.
      if (job === 'catalog') await runFullPull({ withImages: false })
      if (job === 'orders') { await pullOrders(); await recomputeCustomerTotals() }
      if (job === 'customers') await pullCustomers()

      await prisma.webhookEvent.updateMany({
        where: { id: { in: ids } },
        data: { status: 'DONE', processedAt: new Date(), attempts: { increment: 1 } },
      })
      result.done += ids.length
      result.ran.push(job)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Left PENDING so the next pass retries, unless it has failed enough
      // times to look permanent — a poisoned event must not block the queue
      // behind it for ever.
      await prisma.webhookEvent.updateMany({
        where: { id: { in: ids }, attempts: { lt: 4 } },
        data: { error: message.slice(0, 1000), attempts: { increment: 1 } },
      })
      await prisma.webhookEvent.updateMany({
        where: { id: { in: ids }, attempts: { gte: 4 } },
        data: { status: 'FAILED', error: message.slice(0, 1000), processedAt: new Date() },
      })
      result.failed += ids.length
    }
  }

  return result
}

/** Deletes processed events older than `days`, so the table stays small. */
export async function pruneWebhookInbox({ days = 30 } = {}): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const { count } = await prisma.webhookEvent.deleteMany({
    where: { status: { in: ['DONE', 'IGNORED'] }, processedAt: { lt: cutoff } },
  })
  return { deleted: count }
}
