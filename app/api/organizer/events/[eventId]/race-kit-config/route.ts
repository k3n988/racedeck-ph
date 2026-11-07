import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const itemSchema = z.object({ item_code: z.string().trim().min(1).max(80), item_name: z.string().trim().min(1).max(160), quantity: z.number().int().positive(), details: z.record(z.string(), z.any()).default({}), is_required: z.boolean().default(true), is_active: z.boolean().default(true), display_order: z.number().int().nonnegative().default(0) });
const configSchema = z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().max(1000).nullable().optional(), category_id: z.string().uuid().nullable(), status: z.enum(['active', 'inactive']).optional(), items: z.array(itemSchema).max(80).default([]) });
async function authorize(eventId: string) { const context = await loadAuthContext(); if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const; const membership = context.memberships[0]; if (!membership || !(await hasPermission(membership.organization_id, 'edit_events', eventId))) return { response: NextResponse.json({ error: 'Race kit permission required' }, { status: 403 }) } as const; const supabase = await createClient(); const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', eventId).eq('organization_id', membership.organization_id).maybeSingle(); if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const; return { context, event } as const; }
export async function GET(_request: Request, { params }: { params: { eventId: string } }) { const result = await authorize(params.eventId); if ('response' in result) return result.response; const admin = createAdminClient(); const { data, error } = await admin.from('race_kit_configs').select('id,event_id,category_id,name,description,status,created_by,created_at,updated_at,race_kit_items(id,config_id,item_code,item_name,quantity,details,is_required,is_active,display_order,created_at,updated_at)').eq('event_id', params.eventId).order('created_at').order('display_order', { referencedTable: 'race_kit_items' }); if (error) { console.error('Unable to load race kit configurations', error); return NextResponse.json({ error: 'Race kit configurations could not be loaded' }, { status: 500 }); } const { data: categories } = await admin.from('race_categories').select('id,name').eq('event_id', params.eventId).order('name'); return NextResponse.json({ configs: data ?? [], categories: categories ?? [] }); }
export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const result = await authorize(params.eventId);
  if ('response' in result) return result.response;
  const parsed = configSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid race kit configuration' }, { status: 400 });
  const { items, ...configInput } = parsed.data;
  const admin = createAdminClient();
  if (configInput.category_id) {
    const { data: category } = await admin.from('race_categories').select('id').eq('id', configInput.category_id).eq('event_id', params.eventId).maybeSingle();
    if (!category) return NextResponse.json({ error: 'Category does not belong to this event' }, { status: 400 });
  }
  const { data: config, error: configError } = await admin.from('race_kit_configs').insert({ ...configInput, event_id: params.eventId, created_by: result.context.user.id }).select('*').single();
  if (configError || !config) {
    if (configError?.code === '23505') return NextResponse.json({ error: 'A configuration already exists for this category' }, { status: 409 });
    console.error('Unable to create race kit configuration', configError);
    return NextResponse.json({ error: 'Race kit configuration could not be created' }, { status: 500 });
  }
  if (items.length) {
    const { data: savedItems, error: itemsError } = await admin.from('race_kit_items').insert(items.map((item) => ({ ...item, config_id: config.id }))).select('*');
    if (itemsError || !savedItems || savedItems.length !== items.length) {
      // Do not leave a successful-looking empty kit configuration behind.
      const { error: rollbackError } = await admin.from('race_kit_configs').delete().eq('id', config.id).eq('event_id', params.eventId);
      console.error('Unable to save race kit items', { itemsError, rollbackError, eventId: params.eventId, configId: config.id });
      return NextResponse.json({ error: 'Race kit was not saved completely. Please retry; no partial configuration was kept.' }, { status: 500 });
    }
    return NextResponse.json({ ...config, race_kit_items: savedItems }, { status: 201 });
  }
  return NextResponse.json({ ...config, race_kit_items: [] }, { status: 201 });
}
