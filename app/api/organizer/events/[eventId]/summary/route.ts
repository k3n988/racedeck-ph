import { NextResponse } from 'next/server';
import { requireOrganizerPermission, errorResponse } from '@/lib/auth/organizer-access';

const SUMMARY_FIELDS = 'id,name,event_date,start_time,venue,lifecycle_status,review_status,registration_availability,overall_capacity,review_feedback';

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('view_events', params.eventId);
  if ('response' in auth) return auth.response;

  try {
    const { data: event, error } = await auth.admin
      .from('events')
      .select(SUMMARY_FIELDS)
      .eq('id', params.eventId)
      .eq('organization_id', auth.membership.organization_id)
      .maybeSingle();
    if (error) return errorResponse(error, 'Loading organizer event summary');
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json({ event }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error, 'Organizer event summary request');
  }
}
