import { NextResponse } from 'next/server';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', params.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const internal = context.internalRoles.includes('admin') || context.internalRoles.includes('super_admin');
  if (!internal && !(await hasPermission(event.organization_id, 'view_events', event.id))) return NextResponse.json({ error: 'Viewing this event requires view_events permission' }, { status: 403 });
  const admin = createAdminClient();
  const [{ data: categories, error: categoryError }, { data: batches, error: batchError }, { data: registrations }] = await Promise.all([
    admin.from('race_categories').select('id,name,category_group_name,distance_km').eq('event_id', event.id).order('distance_km', { ascending: true, nullsFirst: false }).order('name'),
    admin.from('result_batches').select('id,race_category_id,division,winner_limit,publication_status,row_count,valid_row_count,published_at,updated_at').eq('event_id', event.id).eq('entry_mode', 'manual').order('updated_at', { ascending: false }),
    admin.from('registrations').select('gender').eq('event_id', event.id).neq('status', 'cancelled'),
  ]);
  if (categoryError || batchError) return NextResponse.json({ error: 'Result groups could not be loaded' }, { status: 500 });
  const genders = new Set((registrations ?? []).map((row) => String(row.gender ?? '').trim().toLowerCase()));
  const genderValues = Array.from(genders);
  const divisions = ['overall', ...(genderValues.some((gender) => ['male', 'm', 'man'].includes(gender)) ? ['male'] : []), ...(genderValues.some((gender) => ['female', 'f', 'woman'].includes(gender)) ? ['female'] : [])];
  const { data: auditLogs } = await admin.from('event_result_audit_logs').select('id,result_batch_id,action,created_at,before_snapshot,after_snapshot').eq('event_id', event.id).order('created_at', { ascending: false }).limit(100);
  const groupIds = (batches ?? []).map((batch) => batch.id);
  const { data: rows } = groupIds.length
    ? await admin.from('results').select('result_batch_id,registration_id,participant_display_name,bib_code,bib_number,gun_time,category_rank').in('result_batch_id', groupIds).order('category_rank')
    : { data: [] };
  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));
  const entriesByGroup = new Map<string, typeof rows>();
  for (const row of rows ?? []) entriesByGroup.set(row.result_batch_id, [...(entriesByGroup.get(row.result_batch_id) ?? []), row]);
  return NextResponse.json({ categories: categories ?? [], divisions, groups: (batches ?? []).map((batch) => ({ ...batch, category: categoryById.get(batch.race_category_id ?? '') ?? null, entries: entriesByGroup.get(batch.id) ?? [] })), auditLogs: auditLogs ?? [], canEdit: internal || await hasPermission(event.organization_id, 'upload_results', event.id), canPublish: internal || await hasPermission(event.organization_id, 'publish_results', event.id) }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json().catch(() => null) as { group_id?: string | null; race_category_id?: string; division?: string; winner_limit?: number; entries?: Array<{ rank: number; registration_id: string; finish_time?: string }> } | null;
  if (!body || !body.race_category_id || !['male', 'female', 'overall'].includes(body.division ?? '') || !Number.isInteger(body.winner_limit) || !Array.isArray(body.entries)) return NextResponse.json({ error: 'Complete the result group details before saving' }, { status: 400 });
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', params.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const internal = context.internalRoles.includes('admin') || context.internalRoles.includes('super_admin');
  if (!internal && !(await hasPermission(event.organization_id, 'upload_results', event.id))) return NextResponse.json({ error: 'Saving results requires upload_results permission' }, { status: 403 });
  const { data, error } = await supabase.rpc('save_manual_result_group', { p_event_id: event.id, p_group_id: body.group_id ?? null, p_race_category_id: body.race_category_id, p_division: body.division!, p_winner_limit: body.winner_limit!, p_entries: body.entries });
  if (error) return NextResponse.json({ error: error.message || 'Results could not be saved' }, { status: 409 });
  return NextResponse.json({ group_id: data, saved: true }, { status: body.group_id ? 200 : 201 });
}
