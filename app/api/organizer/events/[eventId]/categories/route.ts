import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';
import { createClient } from '@/lib/supabase/server';
import { validateEarlyBirdSchedule } from '@/lib/events/category-pricing';

const availability = z.enum(['not_yet_open', 'open', 'closed', 'sold_out']);
const timestamp = z.string().datetime({ offset: true }).nullable();
const categorySchema = z.object({
  name: z.string().trim().max(120).optional().default(''),
  category_group_name: z.string().trim().max(120).nullable().optional(),
  distance_km: z.number().finite().positive().max(9999.99).nullable(),
  registration_fee: z.number().finite().nonnegative().max(99999999.99),
  early_bird_fee: z.number().finite().nonnegative().max(99999999.99).nullable().optional(),
  early_bird_deadline: z.string().datetime({ offset: true }).nullable().optional(),
  registration_opens_at: timestamp.optional().default(null),
  registration_closes_at: timestamp.optional().default(null),
  max_slots: z.number().int().positive().max(2147483647).nullable(),
  gun_start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(),
  cutoff_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(),
  registration_availability: availability,
}).superRefine((category, context) => {
  const hasFee = category.early_bird_fee != null;
  const hasDeadline = Boolean(category.early_bird_deadline);
  if (hasFee !== hasDeadline) context.addIssue({ code: z.ZodIssueCode.custom, path: ['early_bird_deadline'], message: 'Early Bird price and deadline must both be set.' });
  if (hasFee && category.early_bird_fee! >= category.registration_fee) context.addIssue({ code: z.ZodIssueCode.custom, path: ['early_bird_fee'], message: 'Early Bird price must be lower than the regular price.' });
  if (Boolean(category.registration_opens_at) !== Boolean(category.registration_closes_at)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['registration_closes_at'], message: 'Enter both the distance registration start and end, or leave both blank to use the event schedule.' });
  if (category.registration_opens_at && category.registration_closes_at && Date.parse(category.registration_opens_at) >= Date.parse(category.registration_closes_at)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['registration_closes_at'], message: 'Distance registration must close after it opens.' });
});

async function access(eventId: string, permission: 'view_events' | 'edit_events') {
  const auth = await requireOrganizerPermission(permission, eventId);
  if ('response' in auth) return { response: auth.response } as const;
  return { ...auth, supabase: await createClient() } as const;
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const result = await access(params.eventId, 'view_events');
  if ('response' in result) return result.response;
  const { data: categories, error } = await result.supabase.from('race_categories')
    .select('id,event_id,name,category_group_name,distance_km,registration_fee,early_bird_fee,early_bird_deadline,registration_opens_at,registration_closes_at,max_slots,confirmed_count,gun_start_time,cutoff_time,registration_availability')
    .eq('event_id', params.eventId).order('name');
  if (error) { console.error('Unable to load event categories', error); return NextResponse.json({ error: 'Categories could not be loaded' }, { status: 500 }); }
  const { data: holds } = await result.supabase.from('registration_holds').select('category_id').eq('event_id', params.eventId).eq('status', 'active').gt('expires_at', new Date().toISOString());
  const held = new Map<string, number>();
  for (const hold of holds ?? []) held.set(hold.category_id, (held.get(hold.category_id) ?? 0) + 1);
  return NextResponse.json((categories ?? []).map((category) => ({ ...category, held_count: held.get(category.id) ?? 0 })));
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const result = await access(params.eventId, 'edit_events');
  if ('response' in result) return result.response;
  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid category details' }, { status: 400 });
  const input = parsed.data;
  const groupName = input.category_group_name?.trim() || null;
  const name = input.name.trim() || (input.distance_km === null ? '' : `${input.distance_km}K`);
  if (!name) return NextResponse.json({ error: 'Enter a distance or a category label.' }, { status: 400 });

  const { data: event, error: eventError } = await result.supabase.from('events').select('event_date,registration_opens_at,registration_closes_at').eq('id', params.eventId).maybeSingle();
  if (eventError || !event) return NextResponse.json({ error: 'Event registration schedule could not be checked.' }, { status: 500 });
  if (input.registration_closes_at && Date.parse(input.registration_closes_at) > Date.parse(`${event.event_date}T23:59:59+08:00`)) return NextResponse.json({ error: 'Distance registration cannot close after the event date.' }, { status: 400 });
  if (input.early_bird_deadline) {
    const scheduleError = validateEarlyBirdSchedule({ deadline: input.early_bird_deadline, registrationOpensAt: input.registration_opens_at ?? event.registration_opens_at, registrationClosesAt: input.registration_closes_at ?? event.registration_closes_at, eventDate: event.event_date });
    if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 });
  }

  const { data: existing, error: existingError } = await result.supabase.from('race_categories').select('name,category_group_name,distance_km').eq('event_id', params.eventId);
  if (existingError) return NextResponse.json({ error: 'Existing race distances could not be checked. Please try again.' }, { status: 500 });
  const duplicate = (existing ?? []).some((row) => {
    const sameGroup = (row.category_group_name ?? '').trim().toLocaleLowerCase() === (groupName ?? '').toLocaleLowerCase();
    if (!sameGroup) return false;
    if (input.distance_km !== null && row.distance_km !== null) return Number(row.distance_km) === input.distance_km;
    return row.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase();
  });
  if (duplicate) return NextResponse.json({ error: 'This distance already exists in that group. Choose another distance or group.' }, { status: 409 });

  const { data, error } = await result.supabase.from('race_categories').insert({
    ...input,
    name,
    category_group_name: groupName,
    event_id: params.eventId,
  }).select('*').single();
  if (error) { console.error('Unable to create event category', error); return NextResponse.json({ error: 'Category could not be created' }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
