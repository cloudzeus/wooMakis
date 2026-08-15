'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/rbac-server'
import { drainWebhookInbox, pruneWebhookInbox } from '@/lib/woo/webhook-worker'

export type WebhookActionResult = { ok: true; message: string } | { ok: false; error: string }

/**
 * Drains the inbox on demand.
 *
 * In production this should be a cron hitting the same worker every minute or
 * two; this button exists so the queue can be pushed through by hand and so
 * the mechanism is testable without waiting for a scheduler.
 */
export async function processWebhooks(): Promise<WebhookActionResult> {
  await requirePermission('sync.run')
  try {
    const r = await drainWebhookInbox()
    revalidatePath('/sync')
    if (r.claimed === 0) return { ok: true, message: 'Δεν υπάρχουν νέα events προς επεξεργασία.' }
    return {
      ok: true,
      message:
        `${r.claimed} events: ${r.done} ολοκληρώθηκαν, ${r.ignored} αγνοήθηκαν, ${r.failed} απέτυχαν.` +
        (r.ran.length ? ` Έτρεξαν: ${[...new Set(r.ran)].join(', ')}.` : ''),
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function pruneWebhooks(): Promise<WebhookActionResult> {
  await requirePermission('sync.run')
  const r = await pruneWebhookInbox()
  revalidatePath('/sync')
  return { ok: true, message: `Διαγράφηκαν ${r.deleted} παλιά events.` }
}
