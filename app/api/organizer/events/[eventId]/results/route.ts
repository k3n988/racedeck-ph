import { NextResponse } from 'next/server';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json().catch(() => null) as { batch_id?: unknown } | null;
  if (!body || typeof body.batch_id !== 'string') return NextResponse.json({ error: 'batch_id is required' }, { status: 400 });
  const internalAdmin = context.internalRoles.includes('admin') || context.internalRoles.includes('super_admin');
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id,name').eq('id', params.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (!internalAdmin && !(await hasPermission(event.organization_id, 'publish_results', params.eventId))) return NextResponse.json({ error: 'Publishing results requires publish_results permission' }, { status: 403 });
  const admin = createAdminClient();
  const { data: batch } = await admin.from('result_batches').select('id,event_id,organization_id,validation_status,publication_status').eq('id', body.batch_id).eq('event_id', params.eventId).eq('organization_id', event.organization_id).maybeSingle();
  if (!batch) return NextResponse.json({ error: 'Result batch not found' }, { status: 404 });
  if (batch.publication_status === 'published') return NextResponse.json({ published: true, already_published: true, batch_id: batch.id });
  if (batch.validation_status !== 'valid') return NextResponse.json({ error: 'Only a valid result batch can be published' }, { status: 409 });
  const now = new Date().toISOString();
  const { data: published, error } = await admin.from('result_batches').update({ publication_status: 'published', published_at: now, published_by: context.user.id }).eq('id', batch.id).eq('publication_status', 'draft').select('id,publication_status,published_at').maybeSingle();
  if (error || !published) return NextResponse.json({ error: 'Result batch could not be published' }, { status: 409 });
  const { data: results } = await admin.from('results').select('registration_id,participant_id,participant_display_name').eq('result_batch_id', batch.id).eq('validation_status', 'valid').not('participant_id', 'is', null);
  const recipients = (results ?? []).filter((row): row is typeof row & { participant_id: string } => Boolean(row.participant_id));
  if (recipients.length) {
    const notifications = recipients.map(row => ({ recipient_user_id: row.participant_id, organization_id: event.organization_id, event_id: event.id, registration_id: row.registration_id, notification_type: 'results_published' as const, title: `Results published — ${event.name}`, body: 'Your race results are now available in My Races.', metadata: { result_batch_id: batch.id }, idempotency_key: `results-published:${batch.id}:${row.participant_id}` }));
    const { data: notificationRows, error: notificationError } = await admin.from('notifications').upsert(notifications, { onConflict: 'idempotency_key' }).select('id,recipient_user_id');
    if (!notificationError && notificationRows?.length) await admin.from('notification_deliveries').upsert(notificationRows.map(row => ({ notification_id: row.id, recipient_user_id: row.recipient_user_id, channel: 'in_app' as const, status: 'queued' as const, idempotency_key: `results-published:${batch.id}:${row.recipient_user_id}:in_app` })), { onConflict: 'idempotency_key' });
    const { data: registrations } = await admin.from('registrations').select('id,user_id,email').in('id', recipients.map(row => row.registration_id).filter((id): id is string => Boolean(id)));
    if (registrations?.length) await admin.from('email_messages').upsert(registrations.map(row => ({ recipient_email: row.email, recipient_user_id: row.user_id, organization_id: event.organization_id, event_id: event.id, registration_id: row.id, email_type: 'results_published' as const, template_version: 1, template_snapshot: { type: 'results_published', result_batch_id: batch.id }, subject: `Results published — ${event.name}`, status: 'queued' as const, idempotency_key: `results-published:${batch.id}:${row.id}:email` })), { onConflict: 'idempotency_key' });
  }
  await admin.from('audit_logs').insert({ actor_user_id: context.user.id, organization_id: event.organization_id, event_id: event.id, action: 'results_published', resource_type: 'result_batch', resource_id: batch.id, new_values: { result_batch_id: batch.id, recipient_count: recipients.length } });
  return NextResponse.json({ published: true, batch_id: batch.id, notified_participants: recipients.length });
}
