import { createAdminClient } from '@/lib/supabase/admin';
import { PayMongoProvider } from '@/lib/payments/paymongo.provider';
import type { RefundResult, VerifiedRefundWebhook } from '@/lib/payments/gateway.interface';
import type { Database } from '@/types/database.types';

type RefundRow = Database['public']['Tables']['refunds']['Row'];
type RefundAdmin = ReturnType<typeof createAdminClient>;
type RefundRpc = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: RefundRow | null; error: { message: string; code?: string } | null }>;
};

export async function notifyRefundSuccess(admin: RefundAdmin, refund: RefundRow) {
  const [{ data: registration }, { data: event }] = await Promise.all([
    admin.from('registrations').select('id,user_id,email,registration_number').eq('id', refund.registration_id).maybeSingle(),
    admin.from('events').select('id,name').eq('id', refund.event_id).maybeSingle(),
  ]);
  if (!registration || !event || !registration.user_id) return;
  const idempotency = `refund-completed:${refund.id}`;
  await admin.from('notifications').upsert({ recipient_user_id: registration.user_id, organization_id: refund.organization_id, event_id: refund.event_id, registration_id: refund.registration_id, notification_type: 'refund_completed', title: `Refund processed - ${event.name}`, body: `Your ${refund.currency} ${refund.amount.toFixed(2)} refund has been processed.`, metadata: { refund_id: refund.id, payment_id: refund.payment_id, registration_number: registration.registration_number }, idempotency_key: idempotency }, { onConflict: 'idempotency_key' });
  if (registration.email) await admin.from('email_messages').upsert({ recipient_email: registration.email, recipient_user_id: registration.user_id, organization_id: refund.organization_id, event_id: refund.event_id, registration_id: refund.registration_id, payment_id: refund.payment_id, email_type: 'refund_processed', template_version: 1, template_snapshot: { type: 'refund_processed', refund_id: refund.id, amount: refund.amount, currency: refund.currency }, subject: `Refund processed - ${event.name}`, status: 'queued', idempotency_key: `${idempotency}:email` }, { onConflict: 'idempotency_key' });
}

export async function applyRefundGatewayResult(admin: RefundAdmin, refundId: string, result: RefundResult) {
  const { data: refund, error } = await (admin as unknown as RefundRpc).rpc('apply_refund_gateway_result', { p_refund_id: refundId, p_gateway_refund_id: result.gatewayRefundId, p_status: result.status, p_failure_code: result.failureCode ?? null, p_failure_message: result.failureMessage ?? null });
  if (error || !refund) throw new Error(error?.message ?? 'Refund result could not be recorded');
  if (refund.status === 'succeeded') await notifyRefundSuccess(admin, refund);
  return refund;
}

export async function requestPayMongoRefund(input: { paymentId: string; amount: number; reason: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'others'; idempotencyKey: string; requestedBy: string; notes: string }) {
  const admin = createAdminClient();
  const { data: reserved, error: reservationError } = await (admin as unknown as RefundRpc).rpc('create_refund_request', { p_payment_id: input.paymentId, p_amount: input.amount, p_reason: input.reason, p_idempotency_key: input.idempotencyKey, p_requested_by: input.requestedBy });
  if (reservationError || !reserved) throw new Error(reservationError?.message ?? 'Refund could not be reserved');
  if (reserved.status === 'succeeded' || reserved.status === 'failed' || reserved.status === 'cancelled') return reserved;

  const { data: originalTransaction } = await admin.from('payment_transactions').select('gateway_transaction_id').eq('id', reserved.transaction_id ?? '').maybeSingle();
  if (!originalTransaction?.gateway_transaction_id) throw new Error('Verified PayMongo payment reference is unavailable');
  if (reserved.gateway !== 'paymongo') throw new Error(`Unsupported refund gateway: ${reserved.gateway}`);

  // Transport uncertainty must remain pending: retrying with the same PayMongo
  // idempotency key is safer than recording a failed refund that may have been
  // accepted by the gateway after a timeout.
  const result = await new PayMongoProvider().createRefund({ gatewayPaymentId: originalTransaction.gateway_transaction_id, amount: Number(reserved.amount), reason: input.reason, notes: input.notes || `RaceDeck refund ${reserved.id}`, idempotencyKey: input.idempotencyKey });
  return applyRefundGatewayResult(admin, reserved.id, result);
}

export async function processPayMongoRefundWebhook(admin: RefundAdmin, webhook: VerifiedRefundWebhook) {
  const { data: refund } = await admin.from('refunds').select('*').eq('gateway', 'paymongo').eq('gateway_refund_id', webhook.gatewayRefundId).maybeSingle();
  if (!refund) {
    await admin.from('payment_webhook_events').update({ status: 'ignored', processed_at: new Date().toISOString(), error_message: 'No matching RaceDeck refund' }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
    return 'ignored' as const;
  }
  const updated = await applyRefundGatewayResult(admin, refund.id, { gatewayRefundId: webhook.gatewayRefundId, status: webhook.status, failureCode: webhook.failureCode, failureMessage: webhook.failureMessage });
  await admin.from('payment_webhook_events').update({ status: 'processed', payment_id: updated.payment_id, transaction_id: updated.transaction_id, registration_id: updated.registration_id, event_id: updated.event_id, organization_id: updated.organization_id, processed_at: new Date().toISOString(), next_retry_at: null, error_message: null }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
  return 'processed' as const;
}
