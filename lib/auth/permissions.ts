import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

export type PermissionKey = string;
export type OrganizationRole = Database['public']['Enums']['organization_role'];
export type InternalRole = 'super_admin' | 'admin' | 'finance' | 'support';

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type OrganizationMember = Database['public']['Tables']['organization_members']['Row'];

export type OrganizationMembership = OrganizationMember & {
  organization: Organization | null;
  permissions: PermissionKey[];
};

export type AuthContext = {
  user: User;
  profile: UserProfile | null;
  memberships: OrganizationMembership[];
  internalRoles: InternalRole[];
};

/**
 * Organization owners are the organization-level authority and receive every
 * organizer permission by design (see the default role_permissions seed).
 * Keep event restrictions in force for delegated or explicitly scoped access.
 */
export function membershipHasPermission(
  membership: OrganizationMembership,
  permission: PermissionKey,
  eventId?: string,
) {
  // Any active organization member may read the organization's event list.
  // The API still scopes queries to this organization and applies event-level
  // restrictions below. Mutations and financial access remain permission-gated.
  const isOrganizationEventRead = permission === 'view_events';

  if (membership.role !== 'owner' && !isOrganizationEventRead && !membership.permissions.includes(permission)) return false;
  return !eventId || !membership.restricted_event_ids || membership.restricted_event_ids.includes(eventId);
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function loadAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const user = authData.user;
  const [{ data: profile }, { data: memberships, error: membershipError }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('organization_members').select('*').eq('user_id', user.id).eq('is_active', true),
  ]);
  if (membershipError) throw membershipError;

  const memberRows = memberships ?? [];
  const roles = Array.from(new Set(memberRows.map((member) => member.role)));
  const organizationIds = Array.from(new Set(memberRows.map((member) => member.organization_id)));

  const [{ data: organizations }, { data: rolePermissions }] = await Promise.all([
    organizationIds.length
      ? supabase.from('organizations').select('*').in('id', organizationIds)
      : Promise.resolve({ data: [] as Organization[], error: null }),
    roles.length
      ? supabase.from('role_permissions').select('role, permission_id').in('role', roles)
      : Promise.resolve({ data: [] as { role: OrganizationRole; permission_id: string }[], error: null }),
  ]);

  const permissionIds = Array.from(new Set((rolePermissions ?? []).map((item) => item.permission_id)));
  const { data: permissions } = permissionIds.length
    ? await supabase.from('permissions').select('id, key').in('id', permissionIds)
    : { data: [] as { id: string; key: string }[] };

  const organizationById = new Map((organizations ?? []).map((organization) => [organization.id, organization]));
  const permissionById = new Map((permissions ?? []).map((permission) => [permission.id, permission.key]));
  const permissionKeysByRole = new Map<OrganizationRole, string[]>();
  for (const rolePermission of rolePermissions ?? []) {
    const key = permissionById.get(rolePermission.permission_id);
    if (!key) continue;
    permissionKeysByRole.set(rolePermission.role, [
      ...(permissionKeysByRole.get(rolePermission.role) ?? []),
      key,
    ]);
  }

  const { data: internalRoleRows } = await supabase
    .from('racedeck_internal_user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true);
  const internalRoles: InternalRole[] = Array.from(
    new Set((internalRoleRows ?? []).map((row) => row.role)),
  );

  return {
    user,
    profile: profile ?? null,
    memberships: memberRows.map((member) => ({
      ...member,
      organization: organizationById.get(member.organization_id) ?? null,
      permissions: permissionKeysByRole.get(member.role) ?? [],
    })),
    internalRoles,
  };
}

export async function hasPermission(
  organizationId: string,
  permission: PermissionKey,
  eventId?: string,
) {
  const context = await loadAuthContext();
  if (!context) return false;
  if (context.internalRoles.includes('admin') || context.internalRoles.includes('super_admin')) return true;
  return context.memberships.some((membership) =>
    membership.organization_id === organizationId && membershipHasPermission(membership, permission, eventId)
  );
}

export async function hasInternalRole(role: InternalRole) {
  const context = await loadAuthContext();
  return !!context?.internalRoles.includes(role);
}
