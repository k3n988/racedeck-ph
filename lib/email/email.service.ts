import 'server-only';

import { sanitizeReminderHtml } from '@/lib/email/reminder-content';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database.types';

type EmailRow = Database['public']['Tables']['email_messages']['Row'];
const MAX_ATTEMPTS = 5;

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character)); }
function renderBody(message: EmailRow): string {
  const snapshot = message.template_snapshot;
  const content = typeof snapshot === 'object' && snapshot !== null && !Array.isArray(snapshot)
    ? snapshot as { type?: unknown; body?: unknown; body_format?: unknown; event_name?: unknown; event_date?: unknown; download_url?: unknown }
    : {};
  if (content.type === 'certificate_ready' && typeof content.download_url === 'string') {
    try {
      const link = new URL(content.download_url);
      if (link.protocol === 'https:' || link.protocol === 'http:') {
        const eventName = typeof content.event_name === 'string' ? content.event_name : 'your event';
        return `<div style="font-family:Arial,sans-serif;line-height:1.5"><h1>${escapeHtml(message.subject)}</h1><p>Your certificate for ${escapeHtml(eventName)} is ready.</p><p><a href="${escapeHtml(link.toString())}" style="display:inline-block;background:#f4510b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">Download certificate</a></p><p style="color:#666;font-size:12px">RaceDeck PH</p></div>`;
      }
    } catch {
      // A malformed download address is omitted; the remainder of the email stays safe.
    }
  }
  const body = typeof content.body === 'string' ? content.body : 'This message was sent by RaceDeck.';
  const eventDetails = typeof content.event_name === 'string' && typeof content.event_date === 'string'
    ? `<p><strong>Event:</strong> ${escapeHtml(content.event_name)}<br><strong>Date:</strong> ${escapeHtml(content.event_date)}<br>Review your RaceDeck registration for details.</p>`
    : '';
  const bodyMarkup = content.body_format === 'html'
    ? sanitizeReminderHtml(body)
    : `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`;
  return `<div style="font-family:Arial,sans-serif;line-height:1.5"><h1>${escapeHtml(message.subject)}</h1><div>${bodyMarkup}</div>${eventDetails}<p style="color:#666;font-size:12px">RaceDeck PH</p></div>`;
}
async function claim(message: EmailRow): Promise<EmailRow | null> { const admin = createAdminClient(); const { data } = await admin.from('email_messages').update({ status: 'sending', sent_at: new Date().toISOString(), failure_reason: null }).eq('id', message.id).eq('status', message.status).select('*').maybeSingle(); return data; }
async function deliver(message: EmailRow): Promise<void> { const admin = createAdminClient(); try { const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [message.recipient_email], subject: message.subject, html: renderBody(message) }) }); const payload = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown }; if (!response.ok || typeof payload.id !== 'string') throw new Error(typeof payload.message === 'string' ? payload.message : `Email provider returned ${response.status}`); await admin.from('email_messages').update({ provider_message_id: payload.id, provider_metadata: { provider: 'resend', accepted_at: new Date().toISOString() } }).eq('id', message.id).eq('status', 'sending'); } catch (error) { const nextRetry = message.retry_count + 1; await admin.from('email_messages').update({ status: nextRetry >= MAX_ATTEMPTS ? 'suppressed' : 'failed', retry_count: nextRetry, failure_reason: error instanceof Error ? error.message.slice(0, 1000) : 'Email provider request failed' }).eq('id', message.id).eq('status', 'sending'); } }
export async function processEmailQueue(limit = 25): Promise<{ claimed: number; accepted: number; failed: number }> { if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Email provider is not configured'); const admin = createAdminClient(); const { data, error } = await admin.from('email_messages').select('*').in('status', ['queued', 'failed']).lt('retry_count', MAX_ATTEMPTS).order('queued_at').limit(Math.max(1, Math.min(limit, 100))); if (error) throw error; let claimed = 0; let accepted = 0; let failed = 0; for (const message of data ?? []) { const owned = await claim(message); if (!owned) continue; claimed += 1; await deliver(owned); const { data: current } = await admin.from('email_messages').select('status,provider_message_id').eq('id', owned.id).maybeSingle(); if (current?.provider_message_id) accepted += 1; if (current?.status === 'failed' || current?.status === 'suppressed') failed += 1; } return { claimed, accepted, failed }; }
