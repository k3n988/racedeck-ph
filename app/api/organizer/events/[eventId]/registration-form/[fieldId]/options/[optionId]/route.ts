import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({ label: z.string().trim().min(1).max(160), value: z.string().trim().min(1).max(160), display_order: z.number().int().nonnegative() });

async function authorize(eventId: string, fieldId: string, optionId: string) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', eventId).maybeSingle();
  const membership = context.memberships.find(item => item.organization_id === event?.organization_id);
  if (!event || !membership || !(await hasPermission(membership.organization_id, 'edit_events', eventId))) return { response: NextResponse.json({ error: 'Event edit permission required' }, { status: 403 }) } as const;
  const { data: field } = await supabase.from('event_registration_fields').select('id').eq('id', fieldId).eq('event_id', eventId).maybeSingle();
  if (!field) return { response: NextResponse.json({ error: 'Field not found for this event' }, { status: 404 }) } as const;
  const { data: option } = await supabase.from('event_registration_field_options').select('id').eq('id', optionId).eq('field_id', fieldId).maybeSingle();
  if (!option) return { response: NextResponse.json({ error: 'Option not found for this field' }, { status: 404 }) } as const;
  return { admin: createAdminClient() } as const;
}

export async function PATCH(request: Request, { params }: { params: { eventId: string; fieldId: string; optionId: string } }) {
  const auth = await authorize(params.eventId, params.fieldId, params.optionId); if ('response' in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid option details' }, { status: 400 });
  const { data, error } = await auth.admin.from('event_registration_field_options').update(parsed.data).eq('id', params.optionId).eq('field_id', params.fieldId).select('*').single();
  if (error) return NextResponse.json({ error: 'Option could not be updated' }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: { eventId: string; fieldId: string; optionId: string } }) {
  const auth = await authorize(params.eventId, params.fieldId, params.optionId); if ('response' in auth) return auth.response;
  const { count } = await auth.admin.from('registration_responses').select('id', { count: 'exact', head: true }).eq('field_id', params.fieldId);
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'Options cannot be removed after participant responses exist' }, { status: 409 });
  const { error } = await auth.admin.from('event_registration_field_options').delete().eq('id', params.optionId).eq('field_id', params.fieldId);
  if (error) return NextResponse.json({ error: 'Option could not be removed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
