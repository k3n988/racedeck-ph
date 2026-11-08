import { createAdminClient } from '@/lib/supabase/admin';
import { createPostPaymentArtifacts } from '@/lib/payments/payment.service';
import type { VerifiedWebhook } from '@/lib/payments/gateway.interface';
import type { Database } from '@/types/database.types';

type PaymentAdmin = ReturnType<typeof createAdminClient>;
type ServerRpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> };

export class PermanentWebhookError extends Error {}

export async function processPayMongoWebhook(admin: PaymentAdmin, webhook: VerifiedWebhook): Promise<'processed' | 'ignored'> {
  const { data: payment } = await admin.from('payments').select('*').eq('gateway', 'paymongo').eq('gateway_payment_id', webhook.paymentId).maybeSingle();
  if (!payment) {
    await admin.from('payment_webhook_events').update({ status: 'ignored', processed_at: new Date().toISOString(), error_message: 'No matching RaceDeck payment' }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
    return 'ignored';
  }
  if (webhook.status === 'succeeded' && webhook.amount !== undefined && Math.round(webhook.amount * 100) !== Math.round(Number(payment.amount_due) * 100)) throw new PermanentWebhookError('Webhook amount does not match the payment intent');
  const metadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata) ? payment.metadata as Record<string, unknown> : {};
  const requestedRegistrationIds = Array.isArray(metadata.registration_ids) ? metadata.registration_ids.filter((id): id is string => typeof id === 'string') : [payment.registration_id];
  const registrationIds = Array.from(new Set([payment.registration_id, ...requestedRegistrationIds]));
  const { data: groupRegistrations } = await admin.from('registrations').select('id,event_id,user_id,checkout_group_id').in('id', registrationIds).eq('event_id', payment.event_id);
  const registration = (groupRegistrations ?? []).find((row) => row.id === payment.registration_id) ?? null;
  if (!registration || (groupRegistrations ?? []).length !== registrationIds.length) throw new PermanentWebhookError('Payment registrations do not match the payment event');
  if (groupRegistrations?.some((row) => row.user_id !== registration.user_id || row.checkout_group_id !== registration.checkout_group_id)) throw new PermanentWebhookError('Grouped registrations do not share the same account and checkout');
  if (webhook.status !== 'succeeded' && ['succeeded', 'partially_refunded', 'refunded'].includes(payment.status)) {
    await admin.from('payment_webhook_events').update({ status: 'processed', payment_id: payment.id, registration_id: registration?.id ?? null, event_id: payment.event_id, organization_id: payment.organization_id, processed_at: new Date().toISOString(), next_retry_at: null, error_message: null }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
    return 'processed';
  }
  const transactionStatus = webhook.status === 'succeeded' ? 'succeeded' : webhook.status === 'expired' ? 'failed' : webhook.status;
  const { data: transaction, error: transactionError } = await admin.from('payment_transactions').upsert({ payment_id: payment.id, registration_id: payment.registration_id, event_id: payment.event_id, organization_id: payment.organization_id, attempt_number: 1, gateway: 'paymongo', gateway_transaction_id: webhook.gatewayTransactionId ?? webhook.paymentId, idempotency_key: `webhook:${webhook.eventId}`, transaction_type: 'payment', status: transactionStatus, amount: webhook.amount ?? payment.amount_due, currency: payment.currency, processed_at: new Date().toISOString(), gateway_response: webhook.raw as unknown as Database['public']['Tables']['payment_transactions']['Insert']['gateway_response'] }, { onConflict: 'gateway,idempotency_key' }).select('id').single();
  if (transactionError) throw new Error(`Payment transaction could not be recorded: ${transactionError.message}`);
  const paymentStatus = webhook.status === 'succeeded' ? 'succeeded' : webhook.status === 'expired' ? 'expired' : webhook.status === 'failed' ? 'failed' : 'cancelled';
  const currentMetadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
    ? payment.metadata as Record<string, unknown>
    : {};
  const { error: paymentError } = await admin.from('payments').update({ status: paymentStatus, amount_paid: webhook.status === 'succeeded' ? (webhook.amount ?? payment.amount_due) : payment.amount_paid, paid_at: webhook.status === 'succeeded' ? new Date().toISOString() : payment.paid_at, failure_message: webhook.status === 'succeeded' ? null : `Gateway payment ${paymentStatus}`, ...(webhook.status === 'succeeded' && webhook.paymentMethod ? { metadata: { ...currentMetadata, payment_method: webhook.paymentMethod } } : {}) }).eq('id', payment.id);
  if (paymentError) throw new Error(`Payment status could not be updated: ${paymentError.message}`);
  if (webhook.status !== 'succeeded') await (admin as unknown as ServerRpcClient).rpc('reverse_promo_redemption', { p_payment_id: payment.id, p_registration_id: payment.registration_id });
  if (!registration) {
    await admin.from('payment_webhook_events').update({ status: 'ignored', payment_id: payment.id, event_id: payment.event_id, organization_id: payment.organization_id, processed_at: new Date().toISOString(), next_retry_at: null, error_message: 'Payment registration no longer exists' }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
    return 'ignored';
  }
  await admin.from('payment_webhook_events').update({ status: 'processing', payment_id: payment.id, transaction_id: transaction?.id ?? null, registration_id: registration.id, event_id: registration.event_id, organization_id: payment.organization_id }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
  if (webhook.status === 'succeeded') {
    for (const member of groupRegistrations ?? []) {
      const { data: confirmed, error: confirmationError } = await admin.rpc('confirm_registration', { p_registration_id: member.id });
      if (confirmationError || !confirmed) throw new Error('Payment received but a grouped registration could not be confirmed');
    }
    await createPostPaymentArtifacts(payment.id);
  }
  await admin.from('payment_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString(), next_retry_at: null, error_message: null }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
  return 'processed';
}

export function retryDelay(attempt: number) { return Math.min(60 * 60_000, Math.max(60_000, 2 ** Math.min(attempt, 10) * 60_000)); }
