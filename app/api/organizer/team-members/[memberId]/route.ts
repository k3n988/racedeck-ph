import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

const updateSchema = z.object({ role: z.string().trim().min(1).optional(), restricted_event_ids: z.array(z.string().uuid()).nullable().optional(), is_active: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);

async function manager() {
  const context = await loadAuthContext(); if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships[0]; if (!membership) return { response: NextResponse.json({ error: 'Organization access required' }, { status: 403 }) } as const;
  if (membership.role !== 'owner' && !membership.permissions.includes('manage_team')) return { response: NextResponse.json({ error: 'Team management permission required' }, { status: 403 }) } as const;
  return { context, membership } as const;
}

export async function PATCH(request: Request, { params }: { params: { memberId: string } }) {
  const access = await manager(); if ('response' in access) return access.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid member changes' }, { status: 400 });
  const admin = createAdminClient(); const { data: target } = await admin.from('organization_members').select('id,user_id,role,is_active,restricted_event_ids').eq('id', params.memberId).eq('organization_id', access.membership.organization_id).maybeSingle();
  if (!target) return NextResponse.json({ error: 'Member not found in this organization' }, { status: 404 });
  const isOwner = target.role === 'owner'; const actorIsOwner = access.membership.role === 'owner';
  if (target.user_id === access.context.user.id && parsed.data.is_active === false) return NextResponse.json({ error: 'You cannot deactivate yourself' }, { status: 400 });
  if (isOwner && !actorIsOwner && (parsed.data.is_active === false || (parsed.data.role && parsed.data.role !== 'owner'))) return NextResponse.json({ error: 'Only an owner may change an owner membership' }, { status: 403 });
  if (isOwner && (parsed.data.is_active === false || (parsed.data.role && parsed.data.role !== 'owner'))) { const { count } = await admin.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', access.membership.organization_id).eq('role', 'owner').eq('is_active', true); if ((count ?? 0) <= 1) return NextResponse.json({ error: 'The last active owner cannot be deactivated or demoted' }, { status: 400 }); }
  if (parsed.data.role) { const { data: role } = await admin.from('organization_roles').select('role').eq('role', parsed.data.role as never).maybeSingle(); if (!role) return NextResponse.json({ error: 'Invalid organization role' }, { status: 400 }); }
  if (parsed.data.restricted_event_ids?.length) { const { data: events, error } = await admin.from('events').select('id').eq('organization_id', access.membership.organization_id).in('id', parsed.data.restricted_event_ids); if (error || (events?.length ?? 0) !== new Set(parsed.data.restricted_event_ids).size) return NextResponse.json({ error: 'Selected events must belong to this organization' }, { status: 400 }); }
  const { error } = await admin.from('organization_members').update(parsed.data as never).eq('id', target.id).eq('organization_id', access.membership.organization_id); if (error) return NextResponse.json({ error: 'Member changes could not be saved' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
