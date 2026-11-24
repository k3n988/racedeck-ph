'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';

const roleOptions = [
  { value: 'admin', label: 'Admin', detail: 'Full admin console access and staff management.' },
  { value: 'finance', label: 'Finance', detail: 'Finance pages and audit log access.' },
  { value: 'support', label: 'Support', detail: 'Support case queue and case handling.' },
  { value: 'super_admin', label: 'Super admin', detail: 'All platform access, including protected role grants.' },
] as const;

export type StaffAssignmentView = {
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  assignedAt: string;
};

export default function RoleAssignmentManager({ assignments, canGrantSuperAdmin, pagination, loadError = false }: { assignments: StaffAssignmentView[]; canGrantSuperAdmin: boolean; pagination?: ReactNode; loadError?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const roles = form.getAll('roles').map(String);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/roles-permissions/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), roles }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; invited?: boolean; email?: string };
      if (!response.ok) {
        setError(body.error ?? 'Roles could not be assigned. Try again.');
        return;
      }
      formElement.reset();
      setNotice(body.invited
        ? `Invitation sent to ${body.email}. The selected roles are ready when they accept.`
        : `Selected roles were assigned to ${body.email}.`);
      router.refresh();
    } catch {
      setError('Roles could not be assigned. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(assignment: StaffAssignmentView) {
    if (!window.confirm(`Remove the ${assignment.role.replaceAll('_', ' ')} role from ${assignment.email}?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/roles-permissions/assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: assignment.userId, role: assignment.role }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'The role could not be removed. Refresh and try again.');
        return;
      }
      setNotice(`Removed the ${assignment.role.replaceAll('_', ' ')} role from ${assignment.email}.`);
      router.refresh();
    } catch {
      setError('The role could not be removed. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-4">
    <form onSubmit={assign} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div><h2 className="text-lg font-extrabold text-[#071b41]">Add staff access</h2><p className="text-sm text-slate-500">Assign one or more system roles to an existing account, or invite a new staff member by email. Selected roles are added; existing roles remain active.</p></div>
      <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)]">
        <div>
          <label htmlFor="staff-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Staff email</label>
          <input id="staff-email" name="email" type="email" required maxLength={320} placeholder="name@example.com" autoComplete="email" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-slate-700">Roles <span className="font-normal text-slate-500">(choose one or more)</span></legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {roleOptions.filter((role) => role.value !== 'super_admin' || canGrantSuperAdmin).map((role) => <label key={role.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 hover:border-orange-300">
              <input name="roles" type="checkbox" value={role.value} className="mt-0.5 accent-orange-600" />
              <span><span className="block text-sm font-bold capitalize text-[#071b41]">{role.label}</span><span className="mt-0.5 block text-xs leading-4 text-slate-500">{role.detail}</span></span>
            </label>)}
          </div>
        </fieldset>
      </div>
      <button disabled={busy} className="rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102b58] disabled:cursor-wait disabled:opacity-60">{busy ? 'Saving...' : 'Assign selected roles'}</button>
    </form>
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50"><tr>{['Staff account', 'Role', 'Status', 'Assigned', 'Action'].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loadError ? <tr><td colSpan={5} className="px-4 py-10 text-center"><p className="font-bold text-red-800">Staff role assignments could not be loaded.</p><p className="mt-1 text-sm text-slate-500">Check the role-management migration and refresh.</p></td></tr> : assignments.length ? assignments.map((assignment) => <tr key={`${assignment.userId}-${assignment.role}`} className="hover:bg-slate-50">
            <td className="px-4 py-3"><p className="font-semibold text-[#071b41]">{assignment.name}</p><p className="text-xs text-slate-500">{assignment.email}</p><p className="font-mono text-[11px] text-slate-400">{assignment.userId}</p></td>
            <td className="px-4 py-3 font-semibold capitalize">{assignment.role.replaceAll('_', ' ')}</td>
            <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${assignment.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{assignment.isActive ? 'Active' : 'Inactive'}</span></td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(assignment.assignedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' })}</td>
            <td className="px-4 py-3">{assignment.isActive ? <button type="button" disabled={busy} onClick={() => void revoke(assignment)} className="font-bold text-red-700 hover:underline disabled:opacity-50">Revoke</button> : <span className="text-slate-400">—</span>}</td>
          </tr>) : <tr><td colSpan={5} className="px-4 py-10 text-center"><p className="font-bold text-[#071b41]">No internal staff roles assigned yet</p><p className="mt-1 text-sm text-slate-500">Add a staff email and choose the roles they need.</p></td></tr>}
        </tbody>
      </table></div>
      {pagination && <div className="border-t border-slate-100 px-4 py-3">{pagination}</div>}
    </div>
  </div>;
}
