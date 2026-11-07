import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';
import { createClient } from '@/lib/supabase/server';
import { validateEarlyBirdSchedule } from '@/lib/events/category-pricing';

const availability = z.enum(['not_yet_open', 'open', 'closed', 'sold_out']);
const categorySchema = z.object({ name: z.string().trim().min(1).max(120), distance_km: z.number().finite().nonnegative().max(9999.99).nullable(), registration_fee: z.number().finite().nonnegative().max(99999999.99), early_bird_fee: z.number().finite().nonnegative().max(99999999.99).nullable().optional(), early_bird_deadline: z.string().datetime({ offset: true }).nullable().optional(), max_slots: z.number().int().nonnegative().max(2147483647).nullable(), gun_start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(), cutoff_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(), registration_availability: availability }).superRefine((category, context) => {
  const hasFee = category.early_bird_fee != null;
  const hasDeadline = Boolean(category.early_bird_deadline);
  if (hasFee !== hasDeadline) context.addIssue({ code: z.ZodIssueCode.custom, path: ['early_bird_deadline'], message: 'Early Bird price and deadline must both be set.' });
  if (hasFee && category.early_bird_fee! >= category.registration_fee) context.addIssue({ code: z.ZodIssueCode.custom, path: ['early_bird_fee'], message: 'Early Bird price must be lower than the regular price.' });
});

async function access(eventId: string, permission: 'view_events' | 'edit_events') {
  const auth = await requireOrganizerPermission(permission, eventId);
  if ('response' in auth) return { response: auth.response } as const;
  return { ...auth, supabase: await createClient() } as const;
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const result = await access(params.eventId, 'view_events'); if ('response' in result) return result.response;
  const { data: categories, error } = await result.supabase.from('race_categories').select('id,event_id,name,distance_km,registration_fee,early_bird_fee,early_bird_deadline,max_slots,confirmed_count,gun_start_time,cutoff_time,registration_availability').eq('event_id', params.eventId).order('name');
  if (error) { console.error('Unable to load event categories', error); return NextResponse.json({ error: 'Categories could not be loaded' }, { status: 500 }); }
  const now = new Date().toISOString(); const { data: holds } = await result.supabase.from('registration_holds').select('category_id').eq('event_id', params.eventId).eq('status', 'active').gt('expires_at', now);
  const held = new Map<string, number>(); for (const hold of holds ?? []) held.set(hold.category_id, (held.get(hold.category_id) ?? 0) + 1);
  return NextResponse.json((categories ?? []).map((category) => ({ ...category, held_count: held.get(category.id) ?? 0 })));
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const result = await access(params.eventId, 'edit_events'); if ('response' in result) return result.response;
  const parsed = categorySchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid category details' }, { status: 400 });
  const { data: existingCategories, error: existingCategoriesError } = await result.supabase.from('race_categories').select('name').eq('event_id', params.eventId);
  if (existingCategoriesError) {
    console.error('Unable to verify event category names', existingCategoriesError);
    return NextResponse.json({ error: 'Existing categories could not be checked. Please try again.' }, { status: 500 });
  }
  if ((existingCategories ?? []).some((category) => category.name.trim().toLocaleLowerCase() === parsed.data.name.trim().toLocaleLowerCase())) {
    return NextResponse.json({ error: 'A category with this name already exists for the event. Choose a unique category name.' }, { status: 409 });
  }
  if (parsed.data.early_bird_deadline) {
    const { data: event, error: eventError } = await result.supabase.from('events').select('event_date,registration_opens_at,registration_closes_at').eq('id', params.eventId).maybeSingle();
    if (eventError || !event) return NextResponse.json({ error: 'Event registration schedule could not be checked.' }, { status: 500 });
    const scheduleError = validateEarlyBirdSchedule({ deadline: parsed.data.early_bird_deadline, registrationOpensAt: event.registration_opens_at, registrationClosesAt: event.registration_closes_at, eventDate: event.event_date });
    if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 });
  }
  const { data, error } = await result.supabase.from('race_categories').insert({ ...parsed.data, event_id: params.eventId }).select('*').single();
  if (error) { console.error('Unable to create event category', error); return NextResponse.json({ error: 'Category could not be created' }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
