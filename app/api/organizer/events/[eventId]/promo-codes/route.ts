import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

const discountType = z.enum(['fixed_amount', 'percentage']);
const status = z.enum(['active', 'inactive']);
const input = z.object({
  code: z.string().trim().min(3).max(64).transform((value) => value.toUpperCase()),
  description: z.string().trim().max(500).nullable().optional(),
  discount_type: discountType,
  discount_value: z.number().finite().positive().max(99999999.99),
  starts_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().nullable().optional(),
  applies_to_all_categories: z.boolean(),
  category_ids: z.array(z.string().uuid()).default([]),
  status,
}).superRefine((value, context) => {
  if (value.discount_type === 'percentage' && value.discount_value > 100) context.addIssue({ code: 'custom', path: ['discount_value'], message: 'Percentage discounts cannot exceed 100.' });
  if (value.expires_at && new Date(value.expires_at) <= new Date(value.starts_at)) context.addIssue({ code: 'custom', path: ['expires_at'], message: 'Expiration must be after the start.' });
  if (!value.applies_to_all_categories && value.category_ids.length === 0) context.addIssue({ code: 'custom', path: ['category_ids'], message: 'Select at least one category or choose all categories.' });
  if (value.applies_to_all_categories && value.category_ids.length > 0) context.addIssue({ code: 'custom', path: ['category_ids'], message: 'Category restrictions cannot be supplied when all categories are selected.' });
});

async function access(eventId: string) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  let membership = context.memberships[0];
  for (const item of context.memberships) { if (await hasPermission(item.organization_id, 'manage_promo_codes', eventId)) { membership = item; break; } }
  if (!membership || !(await hasPermission(membership.organization_id, 'manage_promo_codes', eventId))) return { response: NextResponse.json({ error: 'Promo-code management permission required' }, { status: 403 }) } as const;
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', eventId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;
  return { supabase, event, membership } as const;
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const result = await access(params.eventId); if ('response' in result) return result.response;
  const { data: codes, error } = await result.supabase.from('promo_codes').select('id,event_id,code,description,discount_type,discount_value,starts_at,expires_at,usage_limit,usage_count,per_user_limit,status,applies_to_all_categories,created_at,updated_at').eq('event_id', params.eventId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Promo codes could not be loaded' }, { status: 500 });
  const ids = (codes ?? []).map((item) => item.id);
  const { data: restrictions } = ids.length ? await result.supabase.from('promo_code_categories').select('promo_code_id,category_id,race_categories(id,name)').in('promo_code_id', ids) : { data: [] as Array<{ promo_code_id: string; category_id: string; race_categories: { id: string; name: string } | null }> };
  const categoriesByCode = new Map<string, Array<{ id: string; name: string }>>(); for (const row of restrictions ?? []) { const category = row.race_categories; if (category) categoriesByCode.set(row.promo_code_id, [...(categoriesByCode.get(row.promo_code_id) ?? []), category]); }
  return NextResponse.json((codes ?? []).map((code) => ({ ...code, categories: categoriesByCode.get(code.id) ?? [] })));
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const result = await access(params.eventId); if ('response' in result) return result.response;
  const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid promo code details' }, { status: 400 });
  const { data: categories } = parsed.data.category_ids.length ? await result.supabase.from('race_categories').select('id').eq('event_id', params.eventId).in('id', parsed.data.category_ids) : { data: [] as Array<{ id: string }> };
  if (categories?.length !== parsed.data.category_ids.length) return NextResponse.json({ error: 'One or more categories do not belong to this event' }, { status: 400 });
  const { category_ids, ...promoInput } = parsed.data;
  const { data: promo, error } = await result.supabase.from('promo_codes').insert({ ...promoInput, event_id: result.event.id, organization_id: result.event.organization_id }).select('*').single();
  if (error || !promo) return NextResponse.json({ error: error?.code === '23505' ? 'That code already exists for this event' : 'Promo code could not be created' }, { status: error?.code === '23505' ? 409 : 500 });
  if (category_ids.length) { const { error: categoryError } = await result.supabase.from('promo_code_categories').insert(category_ids.map((category_id) => ({ promo_code_id: promo.id, category_id }))); if (categoryError) { await result.supabase.from('promo_codes').delete().eq('id', promo.id); return NextResponse.json({ error: 'Promo categories could not be saved' }, { status: 500 }); } }
  return NextResponse.json(promo, { status: 201 });
}
