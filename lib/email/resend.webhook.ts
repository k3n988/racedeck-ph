import 'server-only';

import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database.types';

type EventStatus = Database['public']['Enums']['email_delivery_event_type'];
type ResendEvent = { type?: unknown; created_at?: unknown; data?: { email_id?: unknown; id?: unknown; to?: unknown; [key: string]: unknown }; [key: string]: unknown };

function validSignature(rawBody: string, request: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signatures = request.headers.get('svix-signature')?.split(' ') ?? [];
  if (!secret || !id || !timestamp || !signatures.length) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = `v1,${crypto.createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${rawBody}`).digest('base64')}`;
  return signatures.some(signature => {
    const expectedBytes = Buffer.from(expected);
    const actualBytes = Buffer.from(signature);
    return expectedBytes.length === actualBytes.length && crypto.timingSafeEqual(expectedBytes, actualBytes);
  });
}

function eventStatus(type: unknown): EventStatus | null {
  if (type === 'email.delivered') return 'delivered';
  if (type === 'email.failed') return 'failed';
  if (type === 'email.bounced') return 'bounced';
  if (type === 'email.suppressed') return 'suppressed';
  return null;
}

export async function processResendWebhook(rawBody: string, request: Request): Promise<{ duplicate: boolean; updated: boolean }> {
  if (!validSignature(rawBody, request)) throw new Error('Invalid webhook signature');
  const payload = JSON.parse(rawBody) as ResendEvent;
  const status = eventStatus(payload.type);
  const providerEventId = request.headers.get('svix-id') ?? (typeof payload.data?.id === 'string' ? payload.data.id : null);
  const providerMessageId = typeof payload.data?.email_id === 'string' ? payload.data.email_id : null;
  if (!status || !providerEventId || !providerMessageId) throw new Error('Invalid email delivery event');
  const admin = createAdminClient();
  const { data: message } = await admin.from('email_messages').select('id,status,provider_message_id,sent_at,delivered_at').eq('provider_message_id', providerMessageId).maybeSingle();
  if (!message) return { duplicate: false, updated: false };
  const occurredAt = typeof payload.created_at === 'string' && !Number.isNaN(new Date(payload.created_at).getTime()) ? payload.created_at : new Date().toISOString();
  const { error: logError } = await admin.from('email_delivery_logs').insert({ email_message_id: message.id, provider_event_id: providerEventId, provider_message_id: providerMessageId, event_type: status, provider_response: payload as unknown as Database['public']['Tables']['email_delivery_logs']['Insert']['provider_response'], occurred_at: occurredAt, failure_reason: status === 'failed' || status === 'bounced' ? String(payload.data?.reason ?? payload.data?.message ?? '') || null : null });
  if (logError?.code === '23505') return { duplicate: true, updated: false };
  if (logError) throw logError;
  if (message.status === 'delivered') return { duplicate: false, updated: false };
  const update = status === 'delivered'
    ? { status: 'delivered' as const, sent_at: message.sent_at ?? occurredAt, delivered_at: occurredAt, failure_reason: null }
    : { status, failure_reason: String(payload.data?.reason ?? payload.data?.message ?? '') || null };
  const { error: updateError } = await admin.from('email_messages').update(update).eq('id', message.id).neq('status', 'delivered');
  if (updateError) throw updateError;
  return { duplicate: false, updated: true };
}
