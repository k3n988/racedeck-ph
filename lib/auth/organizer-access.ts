import 'server-only';
import { NextResponse } from 'next/server';
import { loadAuthContext, membershipHasPermission } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

export async function requireOrganizerPermission(permission: string, eventId?: string) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const admin = createAdminClient();
  let organizationId: string | undefined;
  if (eventId) {
    const { data: event, error } = await admin.from('events').select('organization_id').eq('id', eventId).maybeSingle();
    if (error) return { response: errorResponse(error, 'Loading event access') } as const;
    if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;
    organizationId = event.organization_id;
  }
  const membership = context.memberships.find((item) =>
    (!organizationId || item.organization_id === organizationId) &&
    membershipHasPermission(item, permission, eventId)
  );
  if (!membership) return { response: NextResponse.json({ error: 'Permission required' }, { status: 403 }) } as const;
  return { context, membership, admin } as const;
}
export function errorResponse(error: unknown, operation = 'Organizer request') {
  console.error(`[${operation}]`, error);

  const detail = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message)
      : 'Unknown server error';

  return NextResponse.json(
    {
      error: process.env.NODE_ENV === 'development'
        ? `${operation} failed: ${detail}`
        : 'Request could not be completed',
    },
    { status: 500 },
  );
}
