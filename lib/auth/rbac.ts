import 'server-only';

import { redirect } from 'next/navigation';
import {
  hasInternalRole,
  hasPermission,
  loadAuthContext,
  type AuthContext,
  type InternalRole,
  type PermissionKey,
} from '@/lib/auth/permissions';

export async function requireAuth(): Promise<AuthContext> {
  const context = await loadAuthContext();
  if (!context) redirect('/login?next=/dashboard');
  return context;
}

export async function requireOrganizationContext(organizationId?: string) {
  const context = await requireAuth();
  const membership = organizationId
    ? context.memberships.find((item) => item.organization_id === organizationId)
    : context.memberships[0];
  if (!membership) redirect('/dashboard?error=organization_access_required');
  return { context, membership };
}

export async function requireOrganizationPermission(
  organizationId: string,
  permission: PermissionKey,
  eventId?: string,
) {
  if (!(await hasPermission(organizationId, permission, eventId))) {
    redirect('/dashboard?error=forbidden');
  }
  return true;
}

export async function requireInternalRole(role: InternalRole) {
  if (!(await hasInternalRole(role))) redirect('/dashboard?error=forbidden');
  return true;
}

export async function requireInternalAccess() {
  const context = await requireAuth();
  if (!context.internalRoles.some((role) => role === 'admin' || role === 'super_admin')) {
    redirect('/dashboard?error=forbidden');
  }
  return context;
}
