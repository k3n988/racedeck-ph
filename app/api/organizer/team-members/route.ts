import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

const inviteSchema = z.object({ email: z.string().trim().email().max(320), role: z.string().trim().min(1), restricted_event_ids: z.array(z.string().uuid()).nullable() });

async function manager() {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships[0];
  if (!membership) return { response: NextResponse.json({ error: 'Organization access required' }, { status: 403 }) } as const;
  if (membership.role !== 'owner' && !membership.permissions.includes('manage_team')) return { response: NextResponse.json({ error: 'Team management permission required' }, { status: 403 }) } as const;
  return { context, membership } as const;
}

async function validateScope(role: string, eventIds: string[] | null, organizationId: string) {
  const admin = createAdminClient();
  const { data: roleRow } = await admin.from('organization_roles').select('role').eq('role', role as never).maybeSingle();
  if (!roleRow) return 'Invalid organization role';
  if (eventIds?.length) {
    const { data: events, error } = await admin.from('events').select('id').eq('organization_id', organizationId).in('id', eventIds);
    if (error || (events?.length ?? 0) !== new Set(eventIds).size) return 'One or more selected events are not part of this organization';
  }
  return null;
}

export async function POST(request: Request) {
  const access = await manager(); if ('response' in access) return access.response;
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email, role, and event selection' }, { status: 400 });
  const { membership } = access; const scopeError = await validateScope(parsed.data.role, parsed.data.restricted_event_ids, membership.organization_id);
  if (scopeError) return NextResponse.json({ error: scopeError }, { status: 400 });
  const admin = createAdminClient(); const email = parsed.data.email.toLowerCase();
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = users.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (!user) { const invited = await admin.auth.admin.inviteUserByEmail(email); if (invited.error || !invited.data.user) return NextResponse.json({ error: 'Member invitation could not be sent' }, { status: 502 }); user = invited.data.user; }
  const { data: existing } = await admin.from('organization_members').select('id,is_active').eq('organization_id', membership.organization_id).eq('user_id', user.id).maybeSingle();
  const { error } = await admin.from('organization_members').upsert({ id: existing?.id, organization_id: membership.organization_id, user_id: user.id, role: parsed.data.role as never, restricted_event_ids: parsed.data.restricted_event_ids, is_active: true }, { onConflict: 'organization_id,user_id' });
  if (error) return NextResponse.json({ error: 'Member could not be added to the organization' }, { status: 500 });
  return NextResponse.json({ ok: true, reactivated: Boolean(existing && !existing.is_active) }, { status: 201 });
}
