import { prisma } from '@/lib/prisma'
import {
  markProductDeleted, syncCustomer, syncOrder, syncProduct, type TargetedResult,
} from '@/lib/sync/targeted'

/**
 * Drains the webhook inbox, one object at a time.
 *
 * The first version answered every event with a FULL catalogue pull. That was
 * wrong three ways: minutes of work for a one-field edit, needless load on
 * mylens.gr, and — the fatal one — far too long to finish in the window the
 * runtime keeps a request alive after responding, so it was killed mid-run and
 * nothing was ever marked done.
 *
 * A webhook already names the object that changed. Fetching just that object
 * takes a few hundred milliseconds, which comfortably fits, and it reuses the
 * same writers as the full sync so the two cannot disagree.
 *
 * Events for the same object are collapsed: five saves of one product become
 * one fetch, because only the latest state matters.
 */

export type DrainResult = {
  claimed: number
  done: number
  failed: number
  ignored: number
  details: string[]
}

/** Deletion events must not re-fetch — the object is gone. */
function isDeletion(topic: string): boolean {
  return topic.endsWith('.deleted') || topic.endsWith('.trashed')
}

async function handle(topic: string, wooId: number): Promise<TargetedResult> {
  const resource = topic.split('.')[0]

  if (resource === 'product') {
    return isDeletion(topic) ? markProductDeleted(wooId) : syncProduct(wooId)
  }
  if (resource === 'order') {
    // A deleted order is left in place: it is a financial record, and the
    // admin screen is a mirror of history rather than of current state.
    return isDeletion(topic)
      ? { synced: false, detail: `order ${wooId} deleted upstream; local copy kept` }
      : syncOrder(wooId)
  }
  if (resource === 'customer') {
    return isDeletion(topic)
      ? { synced: false, detail: `customer ${wooId} deleted upstream; local copy kept` }
      : syncCustomer(wooId)
  }

  return { synced: false, detail: `no handler for ${topic}` }
}

/** How many attempts before an event is parked as FAILED. */
const MAX_ATTEMPTS = 4

export async function drainWebhookInbox({ max = 100 } = {}): Promise<DrainResult> {
  const pending = await prisma.webhookEvent.findMany({
    where: { status: 'PENDING' },
    orderBy: { receivedAt: 'asc' },
    take: max,
  })

  const result: DrainResult = { claimed: pending.length, done: 0, failed: 0, ignored: 0, details: [] }
  if (pending.length === 0) return result

  // Collapse by object: five saves of one product need one fetch. The newest
  // event wins, and the older ones are closed out alongside it.
  const groups = new Map<string, typeof pending>()
  const unhandled: string[] = []

  for (const e of pending) {
    const resource = e.topic.split('.')[0]
    if (!['product', 'order', 'customer'].includes(resource) || !e.wooId) {
      unhandled.push(e.id)
      continue
    }
    const key = `${resource}:${e.wooId}:${isDeletion(e.topic) ? 'del' : 'upd'}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }

  if (unhandled.length) {
    await prisma.webhookEvent.updateMany({
      where: { id: { in: unhandled } },
      data: { status: 'IGNORED', processedAt: new Date() },
    })
    result.ignored = unhandled.length
  }

  for (const events of groups.values()) {
    const latest = events[events.length - 1]
    const ids = events.map(e => e.id)

    try {
      const outcome = await handle(latest.topic, latest.wooId!)
      await prisma.webhookEvent.updateMany({
        where: { id: { in: ids } },
        data: {
          // "Not found upstream" is a real answer, not a failure to retry.
          status: 'DONE',
          processedAt: new Date(),
          attempts: { increment: 1 },
          error: outcome.synced ? null : outcome.detail,
        },
      })
      result.done += ids.length
      result.details.push(outcome.detail)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      // Left PENDING so the next delivery retries it, until it has failed
      // enough times to look permanent — one poisoned event must not block
      // the queue behind it for ever.
      await prisma.webhookEvent.updateMany({
        where: { id: { in: ids }, attempts: { lt: MAX_ATTEMPTS - 1 } },
        data: { error: message.slice(0, 1000), attempts: { increment: 1 } },
      })
      await prisma.webhookEvent.updateMany({
        where: { id: { in: ids }, attempts: { gte: MAX_ATTEMPTS - 1 } },
        data: { status: 'FAILED', error: message.slice(0, 1000), processedAt: new Date() },
      })
      result.failed += ids.length
      result.details.push(`${latest.topic} #${latest.wooId}: ${message.slice(0, 120)}`)
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
