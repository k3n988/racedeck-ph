import 'server-only';
import { NextResponse } from 'next/server';
import { loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

export async function requireOrganizerPermission(permission: string, eventId?: string) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const membership = context.memberships.find((item) => item.permissions.includes(permission) && (!eventId || !item.restricted_event_ids || item.restricted_event_ids.includes(eventId)));
  if (!membership) return { response: NextResponse.json({ error: 'Permission required' }, { status: 403 }) } as const;
  return { context, membership, admin: createAdminClient() } as const;
}
export function errorResponse(error: unknown) { console.error(error); return NextResponse.json({ error: 'Request could not be completed' }, { status: 500 }); }
