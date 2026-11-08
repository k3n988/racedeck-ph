import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable(),
  unit_price: z.number().positive().max(1_000_000),
  variants: z.array(z.string().trim().min(1).max(80)).max(40),
  image_urls: z.array(z.string().url()).max(8),
  display_order: z.number().int().nonnegative(),
  is_active: z.boolean(),
});

async function getEditableEvent(eventId: string) {
  const auth = await requireOrganizerPermission('edit_events', eventId);
  if ('response' in auth) return { response: auth.response } as const;
  const { data: event, error } = await auth.admin.from('events')
    .select('id,organization_id,lifecycle_status,review_status')
    .eq('id', eventId)
    .eq('organization_id', auth.membership.organization_id)
    .maybeSingle();
  if (error) return { response: NextResponse.json({ error: 'Event could not be checked.' }, { status: 500 }) } as const;
  if (!event) return { response: NextResponse.json({ error: 'Event not found.' }, { status: 404 }) } as const;
  if (event.lifecycle_status !== 'draft' || ['pending_review', 'approved'].includes(event.review_status)) {
    return { response: NextResponse.json({ error: 'Merchandise is locked after event submission for review.' }, { status: 409 }) } as const;
  }
  return { auth, event } as const;
}

export async function PATCH(request: Request, { params }: { params: { eventId: string; itemId: string } }) {
  const access = await getEditableEvent(params.eventId);
  if ('response' in access) return access.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the merchandise details and try again.' }, { status: 400 });
  const db = access.auth.admin as unknown as SupabaseClient;
  const { data, error } = await db.from('event_merchandise')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.itemId)
    .eq('event_id', access.event.id)
    .eq('organization_id', access.event.organization_id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('Unable to update event merchandise', error);
    return NextResponse.json({ error: 'Merchandise could not be updated.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Merchandise item not found.' }, { status: 404 });
  return NextResponse.json({ id: data.id });
}

export async function DELETE(_request: Request, { params }: { params: { eventId: string; itemId: string } }) {
  const access = await getEditableEvent(params.eventId);
  if ('response' in access) return access.response;
  const db = access.auth.admin as unknown as SupabaseClient;
  const { data, error } = await db.from('event_merchandise')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', params.itemId)
    .eq('event_id', access.event.id)
    .eq('organization_id', access.event.organization_id)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('Unable to deactivate event merchandise', error);
    return NextResponse.json({ error: 'Merchandise could not be removed.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Merchandise item not found.' }, { status: 404 });
  return NextResponse.json({ id: data.id, is_active: false });
}