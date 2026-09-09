import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

const availability = z.enum(['not_yet_open', 'open', 'closed', 'sold_out']);
const categorySchema = z.object({ name: z.string().trim().min(1).max(120), distance_km: z.number().finite().nonnegative().max(9999.99).nullable(), registration_fee: z.number().finite().nonnegative().max(99999999.99), max_slots: z.number().int().nonnegative().max(2147483647).nullable(), gun_start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(), cutoff_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(), registration_availability: availability });

async function access(eventId: string, permission: 'view_events' | 'edit_events') {
  const context = await loadAuthContext(); if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships[0]; if (!membership) return { response: NextResponse.json({ error: 'Organization access required' }, { status: 403 }) } as const;
  if (!(await hasPermission(membership.organization_id, permission, eventId))) return { response: NextResponse.json({ error: 'You do not have access to this event' }, { status: 403 }) } as const;
  const supabase = await createClient(); const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', eventId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;
  return { context, membership, supabase } as const;
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const result = await access(params.eventId, 'view_events'); if ('response' in result) return result.response;
  const { data: categories, error } = await result.supabase.from('race_categories').select('id,event_id,name,distance_km,registration_fee,max_slots,confirmed_count,gun_start_time,cutoff_time,registration_availability').eq('event_id', params.eventId).order('name');
  if (error) { console.error('Unable to load event categories', error); return NextResponse.json({ error: 'Categories could not be loaded' }, { status: 500 }); }
  const now = new Date().toISOString(); const { data: holds } = await result.supabase.from('registration_holds').select('category_id').eq('event_id', params.eventId).eq('status', 'active').gt('expires_at', now);
  const held = new Map<string, number>(); for (const hold of holds ?? []) held.set(hold.category_id, (held.get(hold.category_id) ?? 0) + 1);
  return NextResponse.json((categories ?? []).map((category) => ({ ...category, held_count: held.get(category.id) ?? 0 })));
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const result = await access(params.eventId, 'edit_events'); if ('response' in result) return result.response;
  const parsed = categorySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid category details' }, { status: 400 });
  const { data, error } = await result.supabase.from('race_categories').insert({ ...parsed.data, event_id: params.eventId }).select('*').single();
  if (error) { console.error('Unable to create event category', error); return NextResponse.json({ error: 'Category could not be created' }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
