import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * WooCommerce webhook verification.
 *
 * Four rules, and each exists because getting it wrong is a real hole:
 *
 * 1. The signature is HMAC-SHA256 over the RAW REQUEST BYTES, keyed with the
 *    webhook's DELIVERY secret — the "Secret" field on the webhook in
 *    WP-Admin, NOT the REST API consumer secret. Different value, different
 *    purpose, and confusing them produces a mismatch that looks like a bug in
 *    the crypto.
 *
 * 2. Verify BEFORE parsing. `JSON.parse` on unverified input is the one thing
 *    an attacker gets for free, and once a body has been parsed and
 *    re-serialised the bytes no longer match the signature anyway.
 *
 * 3. Compare in constant time. A plain `===` on an HMAC leaks the correct
 *    prefix through timing, one byte at a time.
 *
 * 4. A missing or malformed header is a failure, never a pass. The default
 *    when anything is absent is reject.
 */

export type WebhookHeaders = Record<string, string | null | undefined>

export type WebhookVerdict =
  | { ok: true; topic: string; resource: string; event: string; deliveryId: string }
  | { ok: false; reason: 'no_secret' | 'no_signature' | 'bad_signature' | 'no_delivery_id' }

/** Lower-cased lookup, since header casing is not guaranteed. */
function header(headers: WebhookHeaders, name: string): string {
  const direct = headers[name] ?? headers[name.toLowerCase()]
  if (direct) return String(direct)
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === name.toLowerCase() && v) return String(v)
  }
  return ''
}

export function signBody(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
}

export function verifyWebhook(rawBody: string, headers: WebhookHeaders): WebhookVerdict {
  const secret = process.env.WOO_WEBHOOK_SECRET
  if (!secret) return { ok: false, reason: 'no_secret' }

  const signature = header(headers, 'x-wc-webhook-signature')
  if (!signature) return { ok: false, reason: 'no_signature' }

  const expected = signBody(rawBody, secret)

  // Length must match before timingSafeEqual, which throws on unequal buffers
  // — and that throw would itself be a timing signal.
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' }
  }

  const deliveryId = header(headers, 'x-wc-webhook-delivery-id')
  if (!deliveryId) return { ok: false, reason: 'no_delivery_id' }

  const topic = header(headers, 'x-wc-webhook-topic')
  return {
    ok: true,
    deliveryId,
    topic,
    resource: header(headers, 'x-wc-webhook-resource') || topic.split('.')[0] || '',
    event: header(headers, 'x-wc-webhook-event') || topic.split('.')[1] || '',
  }
}

/**
 * WooCommerce sends a plain ping when a webhook is first activated, and its
 * body is `webhook_id=123` rather than JSON. Treating that as a parse failure
 * would mark a perfectly healthy webhook as broken in the admin.
 */
export function isPing(rawBody: string): boolean {
  return /^webhook_id=\d+$/.test(rawBody.trim())
}

/** The upstream object id, for looking an event up later. */
export function extractWooId(payload: unknown): number | null {
  if (payload && typeof payload === 'object' && 'id' in payload) {
    const id = Number((payload as { id: unknown }).id)
    return Number.isFinite(id) && id > 0 ? id : null
  }
  return null
}
