import { ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AdminPage, DataTable, StatCard, StatusBadge, AdminPagination } from '@/components/admin/admin-ui';
import { adminPageNumber } from '@/lib/admin/list-query';
import { requireInternalRoleManagement } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import RoleAssignmentManager, { type StaffAssignmentView } from './role-assignment-manager';

export const dynamic = 'force-dynamic';
const roles = ['super_admin', 'admin', 'finance', 'support'] as const;
const descriptions: Record<(typeof roles)[number], string> = {
  super_admin: 'Full platform access, including protected role grants.',
  admin: 'Full admin console access and staff role management.',
  finance: 'Finance console and audit log access.',
  support: 'Support case queue and case handling.',
};
const PAGE_SIZE = 25;

export default async function AdminRolesPage({ searchParams }: { searchParams?: { page?: string } }) {
  const context = await requireInternalRoleManagement();
  const db = createAdminClient();
  const page = adminPageNumber(searchParams?.page);
  const [{ data: assignments, error: assignmentError, count }, { count: activeCount, error: activeError }, { data: mappings, error: permissionError }] = await Promise.all([
    db.from('racedeck_internal_user_roles').select('user_id,role,is_active,assigned_by,created_at,updated_at', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('racedeck_internal_user_roles').select('user_id', { count: 'exact', head: true }).eq('is_active', true),
    db.from('internal_role_permissions').select('role,permission_id,permissions(key,description)').order('role'),
  ]);
  const permissionMappings = mappings ?? [];
  const rolePermissions = (role: string) => permissionMappings.filter((item) => item.role === role);
  const userIds = Array.from(new Set((assignments ?? []).map((item) => item.user_id)));
  const [{ data: profiles }, users] = await Promise.all([
    userIds.length ? db.from('user_profiles').select('id,first_name,last_name').in('id', userIds) : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
    Promise.all(userIds.map(async (id) => {
      const { data, error } = await db.auth.admin.getUserById(id);
      if (error) console.error('Unable to load an internal staff account', id, error);
      return data.user;
    })),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const userById = new Map(users.filter(Boolean).map((user) => [user!.id, user!]));
  const staffAssignments: StaffAssignmentView[] = (assignments ?? []).map((item) => {
    const profile = profileById.get(item.user_id);
    const user = userById.get(item.user_id);
    const email = user?.email ?? 'Email unavailable';
    const profileName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
    return {
      userId: item.user_id,
      email,
      name: profileName || user?.user_metadata?.full_name || email.split('@')[0] || 'Staff member',
      role: item.role,
      isActive: item.is_active,
      assignedAt: item.created_at,
    };
  });
  const total = count ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const urlFor = (target: number) => `/admin/roles-permissions?page=${target}`;
  const pagination = <AdminPagination page={page} total={total} pageSize={PAGE_SIZE} urlFor={urlFor} label="role assignments" ariaLabel="Staff role assignment pages" />;
  if (!assignmentError && total && page > maxPage) redirect(urlFor(maxPage));

  return <AdminPage title="Roles & Permissions" description="Manage internal staff access and review the permissions assigned to each system role." compactTop compactSections>
    {(assignmentError || activeError || permissionError) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Some access-control data could not be loaded. Check the role-management migration and refresh.</p>}
    <section aria-label="Access control summary" className="grid gap-2 sm:grid-cols-3"><StatCard label="System roles" value={roles.length} detail="Fixed, reviewed permission sets" /><StatCard label="Active assignments" value={activeError ? '—' : activeCount ?? 0} detail="Staff role grants in effect" tone="green" /><StatCard label="Permission mappings" value={permissionError ? '—' : permissionMappings.length} detail="Controlled role-to-permission links" /></section>
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><ShieldCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" /><p><strong>Access changes are audited.</strong> Assign multiple roles to one staff account or invite a new staff member by email. Admins can manage standard roles; only a super admin can grant or revoke super admin access. Permission definitions stay controlled through reviewed database migrations.</p></div>
    <section className="space-y-2"><div><h2 className="text-lg font-extrabold text-[#071b41]">System role permissions</h2><p className="text-sm text-slate-500">These permission sets determine which admin sections each role can use.</p></div>
      <DataTable headers={['Role', 'Access scope', 'Permission keys', 'Control']}>
        {roles.map((role) => { const assigned = rolePermissions(role); return <tr key={role} className="align-top hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-bold capitalize text-[#071b41]">{role.replaceAll('_', ' ')}</td><td className="min-w-64 px-4 py-3 text-sm text-slate-600">{descriptions[role]}</td><td className="min-w-64 px-4 py-3">{permissionError ? <span className="text-sm text-amber-800">Unavailable</span> : assigned.length ? <ul className="space-y-1">{assigned.map((item) => <li key={item.permission_id} title={item.permissions?.description ?? undefined} className="font-mono text-xs text-slate-700">{item.permissions?.key ?? 'Permission unavailable'}</li>)}</ul> : <span className="text-sm text-slate-500">No explicit mappings</span>}</td><td className="px-4 py-3"><StatusBadge value="protected" /></td></tr>; })}
      </DataTable>
    </section>
    <section className="space-y-3"><RoleAssignmentManager assignments={staffAssignments} canGrantSuperAdmin={context.internalRoles.includes('super_admin')} pagination={assignmentError ? null : pagination} loadError={Boolean(assignmentError)} /></section>
  </AdminPage>;
}
