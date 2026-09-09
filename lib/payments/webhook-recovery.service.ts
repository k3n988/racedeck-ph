import { createAdminClient } from '@/lib/supabase/admin';
import { parsePayMongoWebhookPayload } from '@/lib/payments/paymongo.provider';
import { PermanentWebhookError, processPayMongoWebhook, retryDelay } from '@/lib/payments/paymongo-webhook.service';
import type { Database } from '@/types/database.types';

const STALE_PROCESSING_MS = 10 * 60_000;

type RecoverableWebhook = Pick<Database['public']['Tables']['payment_webhook_events']['Row'], 'status' | 'next_retry_at' | 'updated_at'>;

function due(event: RecoverableWebhook, now: number) {
  if (event.status === 'received') return true;
  if (event.status === 'failed') return !event.next_retry_at || new Date(event.next_retry_at).getTime() <= now;
  return event.status === 'processing' && new Date(event.updated_at).getTime() <= now - STALE_PROCESSING_MS;
}

export async function recoverPayMongoWebhooks(limit = 25, eventId?: string) {
  const admin = createAdminClient(); const now = Date.now();
  let query = admin.from('payment_webhook_events').select('id,gateway,gateway_event_id,payload,status,processing_attempts,updated_at,next_retry_at').eq('gateway', 'paymongo').in('status', ['received', 'failed', 'processing']).order('updated_at').limit(Math.max(1, Math.min(limit, 100)));
  if (eventId) query = query.eq('id', eventId);
  const { data, error } = await query;
  if (error) throw error;
  let claimed = 0; let processed = 0; let ignored = 0; let failed = 0;
  for (const event of (data ?? []).filter(row => due(row, now))) {
    const attempts = event.processing_attempts + 1;
    const { data: claimedEvent } = await admin.from('payment_webhook_events').update({ status: 'processing', processing_attempts: attempts, next_retry_at: null, error_message: null }).eq('id', event.id).eq('updated_at', event.updated_at).select('id').maybeSingle();
    if (!claimedEvent) continue;
    claimed += 1;
    try {
      const webhook = parsePayMongoWebhookPayload(event.payload as Record<string, unknown>);
      if (webhook.eventId !== event.gateway_event_id) throw new Error('Stored webhook event ID does not match its verified payload');
      const result = await processPayMongoWebhook(admin, webhook);
      if (result === 'processed') processed += 1; else ignored += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message.slice(0, 1000) : 'Webhook recovery failed';
      const permanent = error instanceof PermanentWebhookError;
      await admin.from('payment_webhook_events').update({ status: permanent ? 'ignored' : 'failed', error_message: message, next_retry_at: permanent ? null : new Date(Date.now() + retryDelay(attempts)).toISOString() }).eq('id', event.id);
      console.error('PayMongo webhook recovery failed', { eventId: event.gateway_event_id, error });
    }
  }
  return { claimed, processed, ignored, failed };
}
