import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

const input = z.object({
  code: z.string().trim().min(3).max(64).transform((value) => value.toUpperCase()),
  description: z.string().trim().max(500).nullable().optional(),
  discount_type: z.enum(['fixed_amount', 'percentage']),
  discount_value: z.number().finite().positive().max(99999999.99),
  starts_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().nullable().optional(),
  applies_to_all_categories: z.boolean(),
  category_ids: z.array(z.string().uuid()).default([]),
  status: z.enum(['active', 'inactive']),
}).superRefine((value, context) => {
  if (value.discount_type === 'percentage' && value.discount_value > 100) context.addIssue({ code: 'custom', path: ['discount_value'], message: 'Percentage discounts cannot exceed 100.' });
  if (value.expires_at && new Date(value.expires_at) <= new Date(value.starts_at)) context.addIssue({ code: 'custom', path: ['expires_at'], message: 'Expiration must be after the start.' });
  if (!value.applies_to_all_categories && value.category_ids.length === 0) context.addIssue({ code: 'custom', path: ['category_ids'], message: 'Select at least one category or choose all categories.' });
  if (value.applies_to_all_categories && value.category_ids.length > 0) context.addIssue({ code: 'custom', path: ['category_ids'], message: 'Category restrictions cannot be supplied when all categories are selected.' });
});

async function access(eventId: string, promoCodeId: string) {
  const context = await loadAuthContext(); if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  let membership = context.memberships[0]; for (const item of context.memberships) { if (await hasPermission(item.organization_id, 'manage_promo_codes', eventId)) { membership = item; break; } }
  if (!membership || !(await hasPermission(membership.organization_id, 'manage_promo_codes', eventId))) return { response: NextResponse.json({ error: 'Promo-code management permission required' }, { status: 403 }) } as const;
  const supabase = await createClient(); const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', eventId).eq('organization_id', membership.organization_id).maybeSingle(); if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;
  const { data: promo } = await supabase.from('promo_codes').select('*').eq('id', promoCodeId).eq('event_id', eventId).eq('organization_id', event.organization_id).maybeSingle(); if (!promo) return { response: NextResponse.json({ error: 'Promo code not found' }, { status: 404 }) } as const;
  return { supabase, event, promo } as const;
}

export async function PATCH(request: Request, { params }: { params: { eventId: string; promoCodeId: string } }) {
  const result = await access(params.eventId, params.promoCodeId); if ('response' in result) return result.response;
  const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid promo code details' }, { status: 400 });
  const { data: redemptions } = await result.supabase.from('promo_code_redemptions').select('id').eq('promo_code_id', result.promo.id).limit(1);
  if (redemptions?.length && (parsed.data.discount_type !== result.promo.discount_type || parsed.data.discount_value !== Number(result.promo.discount_value) || parsed.data.starts_at !== result.promo.starts_at || parsed.data.expires_at !== result.promo.expires_at || parsed.data.usage_limit !== result.promo.usage_limit || parsed.data.per_user_limit !== result.promo.per_user_limit)) return NextResponse.json({ error: 'Used promo codes may only be renamed, described, or activated/deactivated.' }, { status: 409 });
  const { category_ids, ...promoInput } = parsed.data; const { data: categories } = category_ids.length ? await result.supabase.from('race_categories').select('id').eq('event_id', params.eventId).in('id', category_ids) : { data: [] as Array<{ id: string }> }; if (categories?.length !== category_ids.length) return NextResponse.json({ error: 'One or more categories do not belong to this event' }, { status: 400 });
  const { data: updated, error } = await result.supabase.from('promo_codes').update(promoInput).eq('id', result.promo.id).select('*').single(); if (error || !updated) return NextResponse.json({ error: error?.code === '23505' ? 'That code already exists for this event' : 'Promo code could not be updated' }, { status: error?.code === '23505' ? 409 : 500 });
  await result.supabase.from('promo_code_categories').delete().eq('promo_code_id', result.promo.id); if (category_ids.length) await result.supabase.from('promo_code_categories').insert(category_ids.map((category_id) => ({ promo_code_id: result.promo.id, category_id })));
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: { eventId: string; promoCodeId: string } }) {
  const result = await access(params.eventId, params.promoCodeId); if ('response' in result) return result.response;
  const { data: redemptions } = await result.supabase.from('promo_code_redemptions').select('id').eq('promo_code_id', result.promo.id).limit(1); if (redemptions?.length) return NextResponse.json({ error: 'Used promo codes cannot be deleted; deactivate it instead.' }, { status: 409 });
  const { error } = await result.supabase.from('promo_codes').delete().eq('id', result.promo.id); if (error) return NextResponse.json({ error: 'Promo code could not be deleted' }, { status: 500 }); return new NextResponse(null, { status: 204 });
}
