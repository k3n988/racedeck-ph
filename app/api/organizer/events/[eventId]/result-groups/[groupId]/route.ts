import { NextResponse } from 'next/server';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: { eventId: string; groupId: string } }) {
  const context = await loadAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string } | null;
  if (!body || !['publish', 'unpublish', 'delete'].includes(body.action ?? '')) return NextResponse.json({ error: 'Choose a valid result group action' }, { status: 400 });
  const action = body.action as 'publish' | 'unpublish' | 'delete';
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,organization_id').eq('id', params.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const permission = action === 'delete' ? 'upload_results' : 'publish_results';
  const internal = context.internalRoles.includes('admin') || context.internalRoles.includes('super_admin');
  if (!internal && !(await hasPermission(event.organization_id, permission, event.id))) return NextResponse.json({ error: `This action requires ${permission} permission` }, { status: 403 });
  const { data, error } = await supabase.rpc('transition_manual_result_group', { p_group_id: params.groupId, p_action: action });
  if (error) return NextResponse.json({ error: error.message || 'Result group could not be updated' }, { status: 409 });
  return NextResponse.json(data);
}
