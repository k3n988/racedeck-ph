import { NextResponse } from 'next/server';
import { parsePayMongoRefundWebhookPayload, PayMongoProvider } from '@/lib/payments/paymongo.provider';
import { createAdminClient } from '@/lib/supabase/admin';
import { PermanentWebhookError, processPayMongoWebhook, retryDelay } from '@/lib/payments/paymongo-webhook.service';
import { processPayMongoRefundWebhook } from '@/lib/payments/refund.service';
import type { Database } from '@/types/database.types';

export async function POST(request: Request) {
  const rawBody = await request.text(); const signature = request.headers.get('Paymongo-Signature') ?? '';
  let webhook; try { webhook = new PayMongoProvider().verifyWebhook(rawBody, signature); } catch { return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 }); }
  const admin = createAdminClient(); const payload = JSON.parse(rawBody) as unknown as Database['public']['Tables']['payment_webhook_events']['Insert']['payload'];
  const { data: existing } = await admin.from('payment_webhook_events').select('id,status,processing_attempts').eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId).maybeSingle();
  if (existing?.status === 'processed' || existing?.status === 'ignored') return NextResponse.json({ received: true });
  if (!existing) {
    const { error } = await admin.from('payment_webhook_events').insert({ gateway: 'paymongo', gateway_event_id: webhook.eventId, event_type: webhook.eventType, payload, status: 'received', processing_attempts: 0 });
    if (error && error.code !== '23505') return NextResponse.json({ error: 'Webhook could not be recorded' }, { status: 500 });
  }
  const attempts = (existing?.processing_attempts ?? 0) + 1;
  await admin.from('payment_webhook_events').update({ status: 'processing', processing_attempts: attempts, next_retry_at: null, error_message: null }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
  try {
    const refundWebhook = parsePayMongoRefundWebhookPayload(webhook.raw);
    if (refundWebhook) await processPayMongoRefundWebhook(admin, refundWebhook);
    else await processPayMongoWebhook(admin, webhook);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Webhook processing failed';
    const permanent = error instanceof PermanentWebhookError;
    await admin.from('payment_webhook_events').update({ status: permanent ? 'ignored' : 'failed', error_message: message, next_retry_at: permanent ? null : new Date(Date.now() + retryDelay(attempts)).toISOString() }).eq('gateway', 'paymongo').eq('gateway_event_id', webhook.eventId);
    console.error('PayMongo webhook processing failed', error);
    return NextResponse.json({ error: permanent ? message : 'Webhook processing failed' }, { status: permanent ? 400 : 500 });
  }
}
