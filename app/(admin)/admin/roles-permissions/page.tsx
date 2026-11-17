import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { AdminPage, DataTable, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { adminPageNumber } from '@/lib/admin/list-query';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const roles = ['super_admin', 'admin', 'finance', 'support'] as const;
const descriptions: Record<(typeof roles)[number], string> = {
  super_admin: 'Full platform administration and protected access control.',
  admin: 'Organizer and event operations, participant support, and platform content.',
  finance: 'Payment records, refunds, fees, and reconciliation.',
  support: 'Participant and organizer records plus support case handling.',
};

const PAGE_SIZE = 25;

export default async function AdminRolesPage({ searchParams }: { searchParams?: { page?: string } }) {
  const db = createAdminClient();
  const page = adminPageNumber(searchParams?.page);
  const [assignmentResult, activeResult, permissionResult] = await Promise.all([
    db.from('racedeck_internal_user_roles').select('user_id,role,is_active,created_at,updated_at', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('racedeck_internal_user_roles').select('user_id', { count: 'exact', head: true }).eq('is_active', true),
    db.from('internal_role_permissions').select('role,permission_id,permissions(key,description)').order('role'),
  ]);
  const assignments = assignmentResult.data ?? [];
  const mappings = permissionResult.data ?? [];
  const permissionCount = mappings.length;
  const rolePermissions = (role: string) => mappings.filter((item) => item.role === role);
  const maxPage = Math.max(1, Math.ceil((assignmentResult.count ?? 0) / PAGE_SIZE));
  const pageUrl = (target: number) => `/admin/roles-permissions?page=${target}`;
  const pagination = <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>Page {page} of {maxPage} · {assignmentResult.count ?? 0} assignments</span><div className="flex gap-2">{page > 1 && <Link href={pageUrl(page - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold hover:border-orange-400">Previous</Link>}{page < maxPage && <Link href={pageUrl(page + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold hover:border-orange-400">Next</Link>}</div></div>;
  if (!assignmentResult.error && assignmentResult.count && page > maxPage) redirect(pageUrl(maxPage));

  return <AdminPage title="Roles & Permissions" description="" compactTop compactSections>
    {(assignmentResult.error || activeResult.error || permissionResult.error) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Access-control data could not be fully loaded. Unavailable values are marked; refresh after verifying the internal-role schema.</p>}
    <section aria-label="Access control summary" className="grid gap-2 sm:grid-cols-3"><StatCard label="Protected system roles" value={roles.length} detail="Managed through controlled provisioning" /><StatCard label="Active staff assignments" value={activeResult.error ? '—' : activeResult.count ?? 0} detail="Role grants currently active" tone="green" /><StatCard label="Permission mappings" value={permissionResult.error ? '—' : permissionCount} detail="Configured role-to-permission links" /></section>
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><ShieldCheck size={20} className="mt-0.5 shrink-0" aria-hidden="true" /><p><strong>Protected access control.</strong> System roles and permission grants are read-only here. Changes must go through an audited provisioning workflow.</p></div>
    <section className="space-y-2"><div><h2 className="text-lg font-extrabold text-[#071b41]">System role permissions</h2><p className="text-sm text-slate-500">Actual permission keys configured for each protected role.</p></div>
      <DataTable headers={['Role', 'Scope', 'Permission keys', 'Protection']}>
        {roles.map((role) => { const assigned = rolePermissions(role); return <tr key={role} className="align-top hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-bold capitalize text-[#071b41]">{role.replaceAll('_', ' ')}</td><td className="min-w-64 px-4 py-3 text-sm text-slate-600">{descriptions[role]}</td><td className="min-w-64 px-4 py-3">{permissionResult.error ? <span className="text-sm text-amber-800">Unavailable</span> : assigned.length ? <ul className="space-y-1">{assigned.map((item) => <li key={item.permission_id} title={item.permissions?.description ?? undefined} className="font-mono text-xs text-slate-700">{item.permissions?.key ?? 'Permission unavailable'}</li>)}</ul> : <span className="text-sm text-slate-500">No explicit mappings</span>}</td><td className="px-4 py-3"><StatusBadge value="protected" /></td></tr>; })}
      </DataTable>
    </section>
    <section className="space-y-2"><div className="flex items-end justify-between gap-4"><div><h2 className="text-lg font-extrabold text-[#071b41]">Staff role assignments</h2><p className="text-sm text-slate-500">Staff identifiers are masked for quick account matching.</p></div><span className="text-sm text-slate-500">{assignmentResult.error ? 'Unavailable' : `${assignmentResult.count ?? 0} assignments`}</span></div>
      {assignmentResult.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Staff role assignments could not be loaded.</p> : assignments.length ? <DataTable footer={pagination} headers={['Staff account', 'Role', 'Status', 'Assigned']}>
        {assignments.map((item) => <tr key={`${item.user_id}-${item.role}`} className="hover:bg-slate-50"><td className="px-4 py-3 font-mono text-xs">{item.user_id.slice(0, 8)}…{item.user_id.slice(-4)}</td><td className="px-4 py-3 font-semibold capitalize">{item.role.replaceAll('_', ' ')}</td><td className="px-4 py-3"><StatusBadge value={item.is_active ? 'active' : 'inactive'} /></td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' })}</td></tr>)}
      </DataTable> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><ShieldCheck size={23} className="mx-auto text-slate-400" aria-hidden="true" /><p className="mt-3 font-bold text-[#071b41]">No internal staff assignments found.</p></div>}
    </section>
  </AdminPage>;
}
