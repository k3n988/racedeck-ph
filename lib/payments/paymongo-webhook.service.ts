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
  const { data: registration } = await admin.from('registrations').select('id,event_id').eq('id', payment.registration_id).maybeSingle();
  if (registration && registration.event_id !== payment.event_id) throw new PermanentWebhookError('Payment registration does not belong to the payment event');
  if (webhook.status !== 'succeeded' && ['succeeded', 'partially_refunded', 'refunded'].includes(payment.status)) {
    await admin.from('payment_webhook_events').update({ status: 'processed', payment_id: payment.id, registration_id: registration?.id ?? null, event_id: payment.event_id, organization_id: payment.organization_id, processed_at: new Date().toISOString(), next_retry_at: null, error_message: null }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
    return 'processed';
  }
  const transactionStatus = webhook.status === 'succeeded' ? 'succeeded' : webhook.status === 'expired' ? 'failed' : webhook.status;
  const { data: transaction, error: transactionError } = await admin.from('payment_transactions').upsert({ payment_id: payment.id, registration_id: payment.registration_id, event_id: payment.event_id, organization_id: payment.organization_id, attempt_number: 1, gateway: 'paymongo', gateway_transaction_id: webhook.gatewayTransactionId ?? webhook.paymentId, idempotency_key: `webhook:${webhook.eventId}`, transaction_type: 'payment', status: transactionStatus, amount: webhook.amount ?? payment.amount_due, currency: payment.currency, processed_at: new Date().toISOString(), gateway_response: webhook.raw as unknown as Database['public']['Tables']['payment_transactions']['Insert']['gateway_response'] }, { onConflict: 'gateway,idempotency_key' }).select('id').single();
  if (transactionError) throw new Error(`Payment transaction could not be recorded: ${transactionError.message}`);
  const paymentStatus = webhook.status === 'succeeded' ? 'succeeded' : webhook.status === 'expired' ? 'expired' : webhook.status === 'failed' ? 'failed' : 'cancelled';
  const { error: paymentError } = await admin.from('payments').update({ status: paymentStatus, amount_paid: webhook.status === 'succeeded' ? (webhook.amount ?? payment.amount_due) : payment.amount_paid, paid_at: webhook.status === 'succeeded' ? new Date().toISOString() : payment.paid_at, failure_message: webhook.status === 'succeeded' ? null : `Gateway payment ${paymentStatus}` }).eq('id', payment.id);
  if (paymentError) throw new Error(`Payment status could not be updated: ${paymentError.message}`);
  if (webhook.status !== 'succeeded') await (admin as unknown as ServerRpcClient).rpc('reverse_promo_redemption', { p_payment_id: payment.id, p_registration_id: payment.registration_id });
  if (!registration) {
    await admin.from('payment_webhook_events').update({ status: 'ignored', payment_id: payment.id, event_id: payment.event_id, organization_id: payment.organization_id, processed_at: new Date().toISOString(), next_retry_at: null, error_message: 'Payment registration no longer exists' }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
    return 'ignored';
  }
  await admin.from('payment_webhook_events').update({ status: 'processing', payment_id: payment.id, transaction_id: transaction?.id ?? null, registration_id: registration.id, event_id: registration.event_id, organization_id: payment.organization_id }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
  if (webhook.status === 'succeeded') {
    const { data: confirmed, error: confirmationError } = await admin.rpc('confirm_registration', { p_registration_id: registration.id });
    if (confirmationError || !confirmed) throw new Error('Payment received but registration could not be confirmed');
    await createPostPaymentArtifacts(payment.id);
  }
  await admin.from('payment_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString(), next_retry_at: null, error_message: null }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
  return 'processed';
}

export function retryDelay(attempt: number) { return Math.min(60 * 60_000, Math.max(60_000, 2 ** Math.min(attempt, 10) * 60_000)); }
