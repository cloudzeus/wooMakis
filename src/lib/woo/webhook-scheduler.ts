import { drainWebhookInbox, type DrainResult } from '@/lib/woo/webhook-worker'

/**
 * Runs the inbox worker automatically, right after a delivery is stored.
 *
 * This is what makes webhooks self-driving: the receiver answers WooCommerce
 * in a few milliseconds, and the actual sync happens immediately afterwards,
 * outside the request. No cron, no button.
 *
 * Two properties matter, and both are the reason this is not just
 * `void drainWebhookInbox()` at the end of the handler:
 *
 * SINGLE FLIGHT. Fifty product edits arrive as fifty separate requests. Fifty
 * concurrent catalogue pulls would hammer mylens.gr and race each other into
 * the same rows. Only one drain runs at a time; anything that arrives while it
 * is working sets a flag and the drain simply goes round again when it
 * finishes.
 *
 * DEBOUNCE. Saving a product in WordPress usually fires several webhooks in a
 * second or two. Waiting a moment before starting lets that burst land first,
 * so it collapses into one pull instead of one-then-another-then-another.
 *
 * Scope: the flags are per process. With more than one container each would
 * drain independently — wasteful, not harmful, since every sync is an
 * idempotent upsert. If this is ever scaled horizontally, move the lock into
 * Postgres (an advisory lock is enough).
 */

/**
 * A burst of related webhooks lands well inside this window.
 *
 * Short, because the work behind it is now a single-object fetch rather than a
 * full catalogue pull — the whole drain finishes in well under a second, so a
 * long wait would only delay the update for no benefit.
 */
const DEBOUNCE_MS = 1200

/** Guards against a pathological loop if events never stop arriving. */
const MAX_ROUNDS = 5

let running = false
let again = false

export type ScheduleOutcome =
  | { started: false; reason: 'already-running' }
  | { started: true; rounds: number; results: DrainResult[] }

/**
 * Awaited by the caller (inside `after()`), so the runtime keeps the process
 * alive until the work is done rather than killing it mid-sync.
 */
export async function scheduleWebhookDrain(): Promise<ScheduleOutcome> {
  if (running) {
    // Someone is already on it. Tell them there is more and return at once —
    // blocking here would hold the request context open for no reason.
    again = true
    return { started: false, reason: 'already-running' }
  }

  running = true
  const results: DrainResult[] = []

  try {
    let rounds = 0
    do {
      again = false
      await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS))
      results.push(await drainWebhookInbox())
      rounds++
    } while (again && rounds < MAX_ROUNDS)

    return { started: true, rounds, results }
  } catch (err) {
    // Never rethrow into `after()`: the response has already gone out, and an
    // unhandled rejection here would take the process down for an event that
    // is still safely PENDING in the inbox and will be retried.
    console.error('[webhook] automatic drain failed', err)
    return { started: true, rounds: results.length, results }
  } finally {
    running = false
  }
}

/** Exposed for the admin panel, so it can say whether a drain is in progress. */
export function isDraining(): boolean {
  return running
}
