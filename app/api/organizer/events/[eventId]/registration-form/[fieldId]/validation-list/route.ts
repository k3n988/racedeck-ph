import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, { params }: { params: { eventId: string; fieldId: string } }) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', params.eventId).maybeSingle();
  const membership = context.memberships.find(item => item.organization_id === event?.organization_id);
  if (!event || !membership || !(await hasPermission(membership.organization_id, 'edit_events', params.eventId))) return NextResponse.json({ error: 'Event edit permission required' }, { status: 403 });
  const parsed = z.object({ list_id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a validation list.' }, { status: 400 });
  const admin = createAdminClient();
  const { data: count, error } = await admin.rpc('apply_registration_validation_list', { p_event_id: params.eventId, p_field_id: params.fieldId, p_list_id: parsed.data.list_id });
  if (error) {
    const conflict = error.message?.includes('participant responses');
    const invalid = error.message?.includes('choice question');
    return NextResponse.json({ error: conflict ? 'This question already has participant responses. Its options are locked to preserve submitted answers.' : invalid ? 'Reusable lists can only be applied to dropdown, multiple choice, or radio questions.' : 'Validation list could not be applied to this question.' }, { status: conflict ? 409 : invalid ? 400 : 404 });
  }
  return NextResponse.json({ ok: true, validation_list_id: parsed.data.list_id, count });
}
