import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { extractWooId, isPing, signBody, verifyWebhook } from '@/lib/woo/webhook'

const SECRET = 'test secret with a space & symbols ?|;('
const BODY = JSON.stringify({ id: 4321, name: 'Acuvue Oasys' })

function headersFor(body: string, secret = SECRET, extra: Record<string, string> = {}) {
  return {
    'x-wc-webhook-signature': signBody(body, secret),
    'x-wc-webhook-topic': 'product.updated',
    'x-wc-webhook-resource': 'product',
    'x-wc-webhook-event': 'updated',
    'x-wc-webhook-delivery-id': 'delivery-1',
    ...extra,
  }
}

describe('verifyWebhook', () => {
  beforeEach(() => { process.env.WOO_WEBHOOK_SECRET = SECRET })
  afterEach(() => { delete process.env.WOO_WEBHOOK_SECRET })

  it('accepts a correctly signed body', () => {
    const v = verifyWebhook(BODY, headersFor(BODY))
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.topic).toBe('product.updated')
      expect(v.deliveryId).toBe('delivery-1')
    }
  })

  it('rejects a body that was altered after signing', () => {
    const headers = headersFor(BODY)
    const tampered = JSON.stringify({ id: 4321, name: 'Something else' })
    expect(verifyWebhook(tampered, headers)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a signature made with a different secret', () => {
    // The classic mistake this guards: signing with the REST consumer secret
    // instead of the webhook's own delivery secret.
    const headers = headersFor(BODY, 'the wrong secret')
    expect(verifyWebhook(BODY, headers)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a missing signature rather than passing it through', () => {
    const headers = headersFor(BODY)
    delete (headers as Record<string, string>)['x-wc-webhook-signature']
    expect(verifyWebhook(BODY, headers)).toEqual({ ok: false, reason: 'no_signature' })
  })

  it('rejects when no secret is configured', () => {
    delete process.env.WOO_WEBHOOK_SECRET
    expect(verifyWebhook(BODY, headersFor(BODY))).toEqual({ ok: false, reason: 'no_secret' })
  })

  it('requires a delivery id, since that is the replay guard', () => {
    const headers = headersFor(BODY)
    delete (headers as Record<string, string>)['x-wc-webhook-delivery-id']
    expect(verifyWebhook(BODY, headers)).toEqual({ ok: false, reason: 'no_delivery_id' })
  })

  it('reads headers whatever their casing', () => {
    const signed = signBody(BODY, SECRET)
    const v = verifyWebhook(BODY, {
      'X-WC-Webhook-Signature': signed,
      'X-WC-Webhook-Topic': 'order.created',
      'X-WC-Webhook-Delivery-Id': 'd-9',
    })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.resource).toBe('order')
  })

  it('handles a secret containing spaces and shell metacharacters', () => {
    // The live secret has a space in it, which is exactly the kind of value a
    // careless .env write would corrupt.
    const odd = 'Jnx2mc /,uTcZkk9PQ?-hn&J(2D|(W@c~LK_)i@uZN?PP@Up;p'
    process.env.WOO_WEBHOOK_SECRET = odd
    expect(verifyWebhook(BODY, headersFor(BODY, odd)).ok).toBe(true)
  })

  it('does not accept a truncated signature of the right prefix', () => {
    const full = signBody(BODY, SECRET)
    const headers = headersFor(BODY)
    headers['x-wc-webhook-signature'] = full.slice(0, -2)
    expect(verifyWebhook(BODY, headers)).toEqual({ ok: false, reason: 'bad_signature' })
  })
})

describe('isPing', () => {
  it('recognises the activation ping, which is not JSON', () => {
    expect(isPing('webhook_id=42')).toBe(true)
    expect(isPing(' webhook_id=42 ')).toBe(true)
    expect(isPing(BODY)).toBe(false)
  })
})

describe('extractWooId', () => {
  it('pulls the upstream id out of a payload', () => {
    expect(extractWooId({ id: 77 })).toBe(77)
    expect(extractWooId({ id: 0 })).toBeNull()
    expect(extractWooId({})).toBeNull()
    expect(extractWooId(null)).toBeNull()
  })
})
