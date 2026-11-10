import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';
import { createClient } from '@/lib/supabase/server';
import { eventPlatformLinkIsValid, eventPhoneIsValid, type EventSocialLinks } from '@/lib/events/event-social-links';

const schema = z.object({ action: z.enum(['submit', 'publish']) });

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const access = await requireOrganizerPermission('submit_events', params.eventId);
  if ('response' in access) return access.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid event action' }, { status: 400 });

  if (parsed.data.action === 'submit') {
    const { data: event, error: eventError } = await access.admin.from('events').select('social_links').eq('id', params.eventId).eq('organization_id', access.membership.organization_id).maybeSingle();
    if (eventError) return NextResponse.json({ error: 'Event contact details could not be checked.' }, { status: 500 });
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    const contact = (event.social_links ?? {}) as EventSocialLinks;
    if (!eventPlatformLinkIsValid('facebook', contact.facebook ?? '') || !contact.phone?.trim() || !eventPhoneIsValid(contact.phone)) {
      return NextResponse.json({ error: 'Add a valid Facebook link and phone number in Event Details before submitting for review.' }, { status: 409 });
    }
  }

  const supabase = await createClient();
  const { data, error } = parsed.data.action === 'submit'
    ? await supabase.rpc('submit_event_for_review', { p_event_id: params.eventId })
    : await supabase.rpc('publish_event', { p_event_id: params.eventId });
  if (error) {
    console.error('[Organizer event workflow]', error);
    return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Event action could not be completed' }, { status: error.code === 'P0001' ? 409 : 500 });
  }
  return NextResponse.json({ status: data });
}
