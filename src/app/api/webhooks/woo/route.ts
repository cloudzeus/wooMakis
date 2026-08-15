import { prisma } from '@/lib/prisma'
import { extractWooId, isPing, verifyWebhook } from '@/lib/woo/webhook'

/**
 * WooCommerce webhook receiver.
 *
 * Verifies, persists, returns 200. Nothing else happens here — no pull, no
 * image mirroring, no database walk. WooCommerce times a delivery out and
 * retries what it considers failed, so a receiver that does real work turns one
 * product edit into a retry storm, and a crash halfway through loses the event
 * because the 200 was already sent. Draining the inbox is the worker's job.
 *
 * Status codes are deliberate:
 *   200  accepted, or a replay, or a ping — anything WooCommerce should stop retrying
 *   401  signature missing or wrong — a security event, and not retryable
 *   500  our fault; WooCommerce may retry and we want it to
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  // Raw bytes FIRST. The signature covers exactly what was sent, so parsing
  // before verifying would both defeat the check and expose the parser.
  const rawBody = await request.text()

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value })

  const verdict = verifyWebhook(rawBody, headers)

  if (!verdict.ok) {
    if (verdict.reason === 'no_secret') {
      // Our misconfiguration, not theirs — let WooCommerce retry once the
      // secret is in place rather than dropping the event.
      console.error('[webhook] WOO_WEBHOOK_SECRET is not set; rejecting delivery')
      return new Response('webhook secret not configured', { status: 500 })
    }
    console.warn(`[webhook] rejected: ${verdict.reason}`)
    return new Response(verdict.reason, { status: 401 })
  }

  // The activation ping carries `webhook_id=123`, not JSON.
  if (isPing(rawBody)) {
    return new Response('pong', { status: 200 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    // Signed by us but unparseable: store nothing, and do not ask for a retry
    // that would only fail the same way.
    console.warn(`[webhook] signed but non-JSON body on ${verdict.topic}`)
    return new Response('unparseable body', { status: 200 })
  }

  try {
    await prisma.webhookEvent.create({
      data: {
        deliveryId: verdict.deliveryId,
        topic: verdict.topic,
        resource: verdict.resource,
        event: verdict.event,
        wooId: extractWooId(payload),
        payload: payload as object,
      },
    })
  } catch (err) {
    // A duplicate delivery id is a retry of something already banked. That is
    // the replay guard, and it is a success from WooCommerce's point of view —
    // answering anything else invites an endless retry loop.
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return new Response('duplicate', { status: 200 })
    }
    console.error('[webhook] could not store delivery', err)
    return new Response('storage error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
}

/** A GET makes it easy to confirm the endpoint is reachable before wiring it up. */
export async function GET() {
  return Response.json({
    endpoint: 'woo',
    configured: !!process.env.WOO_WEBHOOK_SECRET,
    method: 'POST only',
  })
}
