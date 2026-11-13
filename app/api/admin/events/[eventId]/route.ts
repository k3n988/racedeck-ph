import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

const eventIdSchema = z.string().uuid();

export async function DELETE(_request: Request, { params }: { params: { eventId: string } }) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!context.internalRoles.some((role) => role === 'admin' || role === 'super_admin')) {
    return NextResponse.json({ error: 'RaceDeck admin permission required' }, { status: 403 });
  }
  if (!eventIdSchema.safeParse(params.eventId).success) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: event, error: eventError } = await db.from('events')
    .select('id,name,organization_id,lifecycle_status,review_status')
    .eq('id', params.eventId)
    .maybeSingle();
  if (eventError) {
    console.error('[Admin event deletion] Event lookup failed', eventError);
    return NextResponse.json({ error: 'Event could not be checked before deletion.' }, { status: 500 });
  }
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  if (event.lifecycle_status !== 'draft' || !['not_submitted', 'needs_changes', 'rejected'].includes(event.review_status)) {
    return NextResponse.json({ error: 'For testing, admins can permanently delete editable draft events only. Cancel or archive other events to preserve their history.' }, { status: 409 });
  }

  const [registrations, payments] = await Promise.all([
    db.from('registrations').select('id', { count: 'exact', head: true }).eq('event_id', event.id),
    db.from('payments').select('id', { count: 'exact', head: true }).eq('event_id', event.id),
  ]);
  if (registrations.error || payments.error) {
    console.error('[Admin event deletion] Related records could not be checked', registrations.error ?? payments.error);
    return NextResponse.json({ error: 'Related registrations and payments could not be checked. Nothing was deleted.' }, { status: 500 });
  }
  if ((registrations.count ?? 0) > 0 || (payments.count ?? 0) > 0) {
    return NextResponse.json({ error: 'This event has participant registrations or payment records and cannot be permanently deleted. Cancel or archive it to preserve participant and financial history.' }, { status: 409 });
  }

  const deleteDraftEvent = db.rpc as unknown as (name: string, args: {
    p_event_id: string;
    p_organization_id: string;
  }) => Promise<{ error: { code?: string; message?: string } | null }>;
  const { error: deleteError } = await deleteDraftEvent.call(db, 'delete_organizer_draft_event', {
    p_event_id: event.id,
    p_organization_id: event.organization_id,
  });
  if (deleteError) {
    console.error('[Admin event deletion] Delete failed', deleteError);
    if (deleteError.code === 'P0001') return NextResponse.json({ error: deleteError.message ?? 'This draft cannot be deleted because it has protected records.' }, { status: 409 });
    if (deleteError.code === 'PGRST202') return NextResponse.json({ error: 'Draft deletion is unavailable until the pending Supabase migration is applied.' }, { status: 503 });
    if (deleteError.code === '23503') {
      return NextResponse.json({ error: 'This event has protected operational records and cannot be permanently deleted. Archive or cancel the event instead.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Event could not be deleted. Please try again.' }, { status: 500 });
  }

  const { error: auditError } = await db.from('audit_logs').insert({
    actor_user_id: context.user.id,
    organization_id: event.organization_id,
    action: 'admin_event_deleted',
    resource_type: 'event',
    resource_id: event.id,
    previous_values: { name: event.name, lifecycle_status: event.lifecycle_status, review_status: event.review_status },
  });
  if (auditError) console.error('[Admin event deletion] Audit entry could not be recorded', auditError);

  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/events');
  revalidatePath('/');
  revalidatePath('/events');
  return NextResponse.json({ ok: true, auditRecorded: !auditError }, { headers: { 'Cache-Control': 'no-store' } });
}
