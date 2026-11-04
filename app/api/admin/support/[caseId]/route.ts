import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireInternalAccess } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const updateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  resolution_notes: z.string().trim().max(5000).optional().default(''),
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: { caseId: string } }) {
  const context = await requireInternalAccess();
  if (!uuid.test(params.caseId)) return NextResponse.json({ error: 'Invalid case reference.' }, { status: 400 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid status and resolution note.' }, { status: 400 });
  if (parsed.data.status === 'resolved' && !parsed.data.resolution_notes) return NextResponse.json({ error: 'Add resolution notes before resolving this case.' }, { status: 400 });
  const db = createAdminClient();
  const { data: previous, error: readError } = await db.from('support_cases').select('id,case_reference,status,priority,resolution_notes,opened_at,resolved_at,closed_at,organization_id,event_id').eq('id', params.caseId).maybeSingle();
  if (readError) return NextResponse.json({ error: 'Support case could not be loaded.' }, { status: 500 });
  if (!previous) return NextResponse.json({ error: 'Support case not found.' }, { status: 404 });
  if (previous.status === 'closed' && parsed.data.status !== 'closed') return NextResponse.json({ error: 'Closed cases cannot be reopened.' }, { status: 409 });
  if (parsed.data.status === 'closed' && previous.status !== 'resolved') return NextResponse.json({ error: 'Resolve the case before closing it.' }, { status: 409 });

  const now = new Date().toISOString();
  const update = {
    status: parsed.data.status,
    resolution_notes: parsed.data.resolution_notes || previous.resolution_notes,
    resolved_at: ['resolved', 'closed'].includes(parsed.data.status) ? (previous.resolved_at ?? now) : null,
    closed_at: parsed.data.status === 'closed' ? now : null,
  };
  const { data: updated, error } = await db.from('support_cases').update(update).eq('id', previous.id).eq('status', previous.status).select('id,status,resolution_notes,resolved_at,closed_at,updated_at').maybeSingle();
  if (error || !updated) return NextResponse.json({ error: 'Case changed or could not be updated. Reload and try again.' }, { status: 409 });
  const { error: auditError } = await db.from('audit_logs').insert({ actor_user_id: context.user.id, actor_role_context: context.internalRoles[0] ?? 'admin', organization_id: previous.organization_id, event_id: previous.event_id, action: 'support_case_status_changed', resource_type: 'support_case', resource_id: previous.id, previous_values: { status: previous.status }, new_values: { status: updated.status, resolution_notes: updated.resolution_notes } });
  if (auditError) console.error('Support case audit record failed', auditError);
  return NextResponse.json({ case: updated });
}
