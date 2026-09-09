import crypto from 'node:crypto';
import type { CheckoutRequest, CheckoutResult, PaymentGateway, RefundGateway, RefundRequest, RefundResult, VerifiedRefundWebhook, VerifiedWebhook } from './gateway.interface';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function text(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value : undefined; }
function amountInPesos(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value / 100 : undefined; }

/** Supports legacy `/v1` and current Hosted Checkout webhook envelopes. */
export function parsePayMongoWebhookPayload(body: JsonRecord): VerifiedWebhook {
  const envelope = record(body.data); const legacyAttributes = record(envelope.attributes);
  const eventType = text(legacyAttributes.type) ?? text(envelope.type) ?? text(body.type);
  const resource = record(legacyAttributes.data ?? envelope.data ?? legacyAttributes); const resourceAttributes = record(resource.attributes);
  const payments = Array.isArray(resourceAttributes.payments) ? resourceAttributes.payments : [];
  const latestPayment = record(payments.at(-1)); const latestPaymentAttributes = record(latestPayment.attributes);
  const paymentResource = Object.keys(latestPayment).length ? latestPayment : resource;
  const paymentAttributes = Object.keys(latestPayment).length ? latestPaymentAttributes : resourceAttributes;
  // RaceDeck stores the Checkout Session (`cs_…`) as gateway_payment_id. The
  // resulting `pay_…` is retained as the immutable transaction reference.
  const checkoutSessionId = text(resource.id) ?? text(resourceAttributes.checkout_session_id) ?? text(paymentAttributes.checkout_session_id);
  const paymentId = checkoutSessionId ?? text(paymentResource.id) ?? text(paymentAttributes.payment_intent_id);
  const eventId = text(envelope.id) ?? text(body.id) ?? checkoutSessionId;
  if (!eventId || !paymentId || !eventType) throw new Error('Invalid payment webhook payload');
  const normalizedType = eventType.toLowerCase();
  const status: VerifiedWebhook['status'] = /paid|succeeded|completed/.test(normalizedType) ? 'succeeded' : /expired/.test(normalizedType) ? 'expired' : /failed/.test(normalizedType) ? 'failed' : 'cancelled';
  return { eventId, eventType, paymentId, status, amount: amountInPesos(paymentAttributes.amount), gatewayTransactionId: text(paymentResource.id) ?? text(paymentAttributes.external_reference_number), raw: body };
}

export function parsePayMongoRefundWebhookPayload(body: JsonRecord): VerifiedRefundWebhook | null {
  const envelope = record(body.data); const legacyAttributes = record(envelope.attributes);
  const eventType = text(legacyAttributes.type) ?? text(envelope.type) ?? text(body.type);
  if (!eventType || !/^payment\.refund(?:ed|\.updated)$/i.test(eventType)) return null;
  const resource = record(legacyAttributes.data ?? envelope.data ?? legacyAttributes); const attributes = record(resource.attributes);
  const refunds = Array.isArray(attributes.refunds) ? attributes.refunds : [];
  const nested = record(refunds.at(-1)); const nestedAttributes = record(nested.attributes);
  const candidate = Object.keys(nested).length ? nested : resource; const candidateAttributes = Object.keys(nested).length ? nestedAttributes : attributes;
  const gatewayRefundId = text(candidate.id) ?? text(candidateAttributes.id);
  const eventId = text(envelope.id) ?? text(body.id);
  const status = text(candidateAttributes.status);
  if (!eventId || !gatewayRefundId || (status !== 'pending' && status !== 'processing' && status !== 'succeeded' && status !== 'failed')) throw new Error('Invalid refund webhook payload');
  return { eventId, eventType, gatewayRefundId, status, failureCode: text(candidateAttributes.failure_code), failureMessage: text(candidateAttributes.failure_message), raw: body };
}

export class PayMongoProvider implements PaymentGateway, RefundGateway {
  async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const key = process.env.PAYMONGO_SECRET_KEY; if (!key) throw new Error('Payment gateway is not configured');
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { attributes: { billing: {}, line_items: [{ currency: request.currency, amount: Math.round(request.amount * 100), description: request.description, quantity: 1 }], payment_method_types: ['gcash', 'card', 'paymaya'], description: request.description, success_url: request.successUrl, cancel_url: request.cancelUrl, reference_number: request.reference } } }) });
    if (!response.ok) throw new Error('Payment gateway checkout failed'); const body = await response.json(); const attributes = body?.data?.attributes;
    if (!attributes?.checkout_url || !body?.data?.id) throw new Error('Payment gateway returned an invalid checkout'); return { gatewayPaymentId: body.data.id, checkoutUrl: attributes.checkout_url };
  }

  verifyWebhook(rawBody: string, signature: string): VerifiedWebhook {
    const secret = process.env.PAYMONGO_WEBHOOK_SECRET; if (!secret) throw new Error('Payment webhook is not configured');
    const parts = Object.fromEntries(signature.split(',').map(part => part.split('='))); const timestamp = parts.t; const supplied = parts.v1;
    if (!timestamp || !supplied) throw new Error('Invalid payment webhook signature');
    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'); const expectedBuffer = Buffer.from(expected, 'hex'); const suppliedBuffer = Buffer.from(supplied, 'hex');
    if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) throw new Error('Invalid payment webhook signature');
    return parsePayMongoWebhookPayload(JSON.parse(rawBody) as JsonRecord);
  }

  async createRefund(request: RefundRequest): Promise<RefundResult> {
    const key = process.env.PAYMONGO_SECRET_KEY;
    if (!key) throw new Error('Payment gateway is not configured');
    const response = await fetch('https://api.paymongo.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': request.idempotencyKey,
      },
      body: JSON.stringify({ data: { attributes: { amount: Math.round(request.amount * 100), payment_id: request.gatewayPaymentId, reason: request.reason === 'requested_by_customer' ? 'others' : request.reason, notes: request.notes.slice(0, 255) } } }),
    });
    const body = await response.json().catch(() => ({})) as { data?: { id?: unknown; attributes?: Record<string, unknown> }; errors?: Array<{ code?: unknown; detail?: unknown }> };
    const attributes = body.data?.attributes ?? {};
    if (!response.ok || typeof body.data?.id !== 'string') {
      const first = body.errors?.[0];
      const detail = typeof first?.detail === 'string' ? first.detail : `Payment gateway refund failed (${response.status})`;
      const error = new Error(detail) as Error & { code?: string };
      error.code = typeof first?.code === 'string' ? first.code : undefined;
      throw error;
    }
    const status = attributes.status;
    if (status !== 'pending' && status !== 'processing' && status !== 'succeeded' && status !== 'failed') throw new Error('Payment gateway returned an invalid refund status');
    return { gatewayRefundId: body.data.id, status, failureCode: typeof attributes.failure_code === 'string' ? attributes.failure_code : undefined, failureMessage: typeof attributes.failure_message === 'string' ? attributes.failure_message : undefined };
  }
}
