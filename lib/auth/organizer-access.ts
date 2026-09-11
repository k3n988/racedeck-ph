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
