import { NextResponse } from 'next/server';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';

export async function DELETE(_request: Request, { params }: { params: { eventId: string; partnerId: string } }) {
  const auth = await requireOrganizerPermission('edit_events', params.eventId);
  if ('response' in auth) return auth.response;

  const { data: partner, error: loadError } = await auth.admin.from('event_partners')
    .select('id')
    .eq('id', params.partnerId)
    .eq('event_id', params.eventId)
    .maybeSingle();
  if (loadError) {
    console.error('[Checking event partner before deletion]', loadError);
    return NextResponse.json({ error: 'Sponsor could not be removed' }, { status: 500 });
  }
  if (!partner) return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });

  const { error } = await auth.admin.from('event_partners')
    .delete()
    .eq('id', params.partnerId)
    .eq('event_id', params.eventId);
  if (error) {
    console.error('[Removing event partner]', error);
    return NextResponse.json({ error: 'Sponsor could not be removed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
