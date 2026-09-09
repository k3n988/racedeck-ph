import { NextResponse } from 'next/server';
import { PayMongoProvider } from '@/lib/payments/paymongo.provider';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPostPaymentArtifacts } from '@/lib/payments/payment.service';
import type { Database } from '@/types/database.types';
type ServerRpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> };

export async function POST(request: Request) {
  const rawBody = await request.text(); const signature = request.headers.get('Paymongo-Signature') ?? '';
  let webhook; try { webhook = new PayMongoProvider().verifyWebhook(rawBody, signature); } catch { return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 }); }
  const admin = createAdminClient(); const payload = JSON.parse(rawBody) as unknown as Database['public']['Tables']['payment_webhook_events']['Insert']['payload'];
  const { data: existing } = await admin.from('payment_webhook_events').select('id,status').eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId).maybeSingle();
  if (existing?.status === 'processed') return NextResponse.json({ received: true });
  if (!existing) { const { error } = await admin.from('payment_webhook_events').insert({ gateway: 'paymongo', gateway_event_id: webhook.eventId, event_type: webhook.eventType, payload }); if (error && error.code !== '23505') return NextResponse.json({ error: 'Webhook could not be recorded' }, { status: 500 }); }
  const { data: payment } = await admin.from('payments').select('*').eq('gateway', 'paymongo').eq('gateway_payment_id', webhook.paymentId).maybeSingle(); if (!payment) return NextResponse.json({ received: true });
  if (webhook.status === 'succeeded' && webhook.amount !== undefined && Math.round(webhook.amount * 100) !== Math.round(Number(payment.amount_due) * 100)) return NextResponse.json({ error: 'Webhook amount does not match the payment intent' }, { status: 400 });
  const { data: registration } = await admin.from('registrations').select('id,event_id').eq('id', payment.registration_id).maybeSingle();
  const transactionStatus = webhook.status === 'succeeded' ? 'succeeded' : webhook.status === 'expired' ? 'failed' : webhook.status;
  const { data: transaction } = await admin.from('payment_transactions').upsert({ payment_id: payment.id, registration_id: payment.registration_id, event_id: payment.event_id, organization_id: payment.organization_id, attempt_number: 1, gateway: 'paymongo', gateway_transaction_id: webhook.gatewayTransactionId ?? webhook.paymentId, idempotency_key: `webhook:${webhook.eventId}`, transaction_type: 'payment', status: transactionStatus, amount: webhook.amount ?? payment.amount_due, currency: payment.currency, processed_at: new Date().toISOString(), gateway_response: webhook.raw as unknown as Database['public']['Tables']['payment_transactions']['Insert']['gateway_response'] }, { onConflict: 'gateway,idempotency_key' }).select('id').single();
  const paymentStatus = webhook.status === 'succeeded' ? 'succeeded' : webhook.status === 'expired' ? 'expired' : webhook.status === 'failed' ? 'failed' : 'cancelled';
  await admin.from('payments').update({ status: paymentStatus, amount_paid: webhook.status === 'succeeded' ? (webhook.amount ?? payment.amount_due) : payment.amount_paid, paid_at: webhook.status === 'succeeded' ? new Date().toISOString() : payment.paid_at, failure_message: webhook.status === 'succeeded' ? null : `Gateway payment ${paymentStatus}` }).eq('id', payment.id);
  if (webhook.status !== 'succeeded') await (admin as unknown as ServerRpcClient).rpc('reverse_promo_redemption', { p_payment_id: payment.id, p_registration_id: payment.registration_id });
  if (!registration) return NextResponse.json({ received: true });
  await admin.from('payment_webhook_events').update({ status: 'processing', payment_id: payment.id, transaction_id: transaction?.id ?? null, registration_id: registration.id, event_id: registration.event_id, organization_id: payment.organization_id, processing_attempts: 1 }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
  if (webhook.status === 'succeeded') { const { data: confirmed } = await admin.rpc('confirm_registration', { p_registration_id: registration.id }); if (!confirmed) return NextResponse.json({ error: 'Payment received but registration could not be confirmed' }, { status: 409 }); await createPostPaymentArtifacts(payment.id); }
  await admin.from('payment_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
  return NextResponse.json({ received: true });
}
