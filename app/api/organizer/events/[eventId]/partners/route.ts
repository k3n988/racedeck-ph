import { NextResponse } from 'next/server';
import { z } from 'zod';
import { errorResponse, requireOrganizerPermission } from '@/lib/auth/organizer-access';

const partnerSchema = z.object({ name: z.string().trim().min(1).max(160), partner_type: z.enum(['Presented By', 'Official Partners', 'Supported By']), logo_url: z.string().url().nullable() });

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('view_events', params.eventId);
  if ('response' in auth) return auth.response;
  const { data, error } = await auth.admin.from('event_partners')
    .select('id,name,logo_url,partner_type,display_order')
    .eq('event_id', params.eventId)
    .order('display_order')
    .order('name');
  if (error) {
    console.error('[Loading organizer event partners]', error);
    return NextResponse.json({ error: 'Sponsors could not be loaded' }, { status: 500 });
  }
  return NextResponse.json({ partners: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('edit_events', params.eventId);
  if ('response' in auth) return auth.response;
  const { data: event, error: eventError } = await auth.admin.from('events')
    .select('review_status')
    .eq('id', params.eventId)
    .eq('organization_id', auth.membership.organization_id)
    .maybeSingle();
  if (eventError) {
    console.error('[Checking event before saving sponsor]', eventError);
    return NextResponse.json({ error: 'Event sponsor settings could not be checked' }, { status: 500 });
  }
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.review_status === 'pending_review') return NextResponse.json({ error: 'Sponsors cannot be changed while this event is under review.' }, { status: 409 });
  const parsed = partnerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid sponsor details' }, { status: 400 });
  const { data, error } = await auth.admin.from('event_partners').insert({ ...parsed.data, event_id: params.eventId }).select('id,name,logo_url,partner_type,display_order').single();
  if (error) return errorResponse(error, 'Saving event partner');
  return NextResponse.json(data, { status: 201 });
}
