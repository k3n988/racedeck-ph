'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, MailPlus, Search, Shield, UsersRound, X } from 'lucide-react';

export type TeamMemberView = { id: string; userId: string; name: string; email: string | null; role: string; roleLabel: string; isActive: boolean; invitePending: boolean; allEvents: boolean; restrictedEventIds: string[] };
export type TeamRoleView = { role: string; displayName: string };
export type TeamEventView = { id: string; name: string };
type Props = { members: TeamMemberView[]; roles: TeamRoleView[]; events: TeamEventView[]; canManage: boolean; currentUserId: string; organizationName: string };
type Mode = 'invite' | 'edit' | null;

const fieldClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100';

export default function TeamMembersClient({ members, roles, events, canManage, currentUserId, organizationName }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [target, setTarget] = useState<TeamMemberView | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roles.find(item => item.role !== 'owner')?.role ?? '');
  const [allEvents, setAllEvents] = useState(true);
  const [access, setAccess] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const staffRoles = useMemo(() => roles.filter(item => item.role !== 'owner'), [roles]);
  const filteredMembers = useMemo(() => members.filter(member => {
    const haystack = `${member.name} ${member.email ?? ''} ${member.roleLabel}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase()) && (statusFilter === 'all' || (statusFilter === 'active' ? member.isActive && !member.invitePending : statusFilter === 'pending' ? member.isActive && member.invitePending : !member.isActive));
  }), [members, search, statusFilter]);

  function openInvite() {
    setTarget(null); setEmail(''); setRole(staffRoles[0]?.role ?? ''); setAllEvents(true); setAccess([]); setActive(true);
    setError(''); setMessage(''); setMode('invite');
  }
  function openEdit(member: TeamMemberView) {
    setTarget(member); setEmail(''); setRole(member.role); setAllEvents(member.allEvents); setAccess(member.restrictedEventIds); setActive(member.isActive);
    setError(''); setMessage(''); setMode('edit');
  }
  function toggleEvent(id: string) { setAccess(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); }

  async function submit() {
    if (!mode) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const invitation = mode === 'invite';
      const response = await fetch(invitation ? '/api/organizer/team-members' : `/api/organizer/team-members/${target?.id}`, {
        method: invitation ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitation
          ? { email: email.trim(), role, restricted_event_ids: allEvents ? null : access }
          : { role, restricted_event_ids: allEvents ? null : access, is_active: active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'The request could not be completed.');
      setMode(null);
      setMessage(invitation ? `Invitation link sent to ${email.trim()}.` : 'Staff member updated.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The request could not be completed.');
    } finally { setBusy(false); }
  }

  async function deactivate(member: TeamMemberView) {
    if (member.userId === currentUserId || !window.confirm(`Deactivate ${member.name}? They will lose access to this organization.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/organizer/team-members/${member.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: false }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'The staff member could not be deactivated.');
      setMessage(`${member.name} has been deactivated.`); router.refresh();
    } catch (deactivateError) { setError(deactivateError instanceof Error ? deactivateError.message : 'The staff member could not be deactivated.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-orange-600">Organization settings</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-[#0b2348]">Staff &amp; team</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Invite staff to {organizationName}, assign their role, and control which events they can access.</p>
      </div>
      {canManage && <button type="button" onClick={openInvite} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-200"><MailPlus size={17} aria-hidden="true"/>Add staff</button>}
    </header>

    {(message || error) && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || message}</p>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div><h2 className="text-lg font-bold text-[#0b2348]">Organization staff</h2><p className="mt-1 text-sm text-slate-600">Manage invitations and access for your team.</p></div>
        <span className="text-sm font-semibold text-slate-500">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
      </div>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <label className="relative block w-full sm:max-w-sm"><span className="sr-only">Search staff</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or Gmail" className="min-h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"/></label>
        <label className="sr-only" htmlFor="staff-status-filter">Filter staff by status</label><select id="staff-status-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"><option value="all">All statuses</option><option value="active">Active</option><option value="pending">Invitation pending</option><option value="inactive">Inactive</option></select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-bold">Staff member</th><th className="px-5 py-3 font-bold">Role</th><th className="px-5 py-3 font-bold">Event access</th><th className="px-5 py-3 font-bold">Status</th>{canManage && <th className="px-5 py-3 text-right font-bold">Actions</th>}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMembers.map(member => <tr key={member.id} className="hover:bg-slate-50/70">
              <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-50 text-sm font-extrabold text-orange-700">{member.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="font-bold text-[#0b2348]">{member.name}</p><p className="max-w-[280px] truncate text-xs text-slate-500">{member.email ?? 'Email unavailable'}</p></div></div></td>
              <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"><Shield size={13} aria-hidden="true"/>{member.roleLabel}</span></td>
              <td className="px-5 py-4 text-slate-600">{member.allEvents ? 'All events' : `${member.restrictedEventIds.length} selected event${member.restrictedEventIds.length === 1 ? '' : 's'}`}</td>
              <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${!member.isActive ? 'bg-slate-100 text-slate-600' : member.invitePending ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${!member.isActive ? 'bg-slate-400' : member.invitePending ? 'bg-amber-500' : 'bg-emerald-500'}`}/>{!member.isActive ? 'Inactive' : member.invitePending ? 'Invitation pending' : 'Active'}</span></td>
              {canManage && <td className="px-5 py-4 text-right"><div className="inline-flex gap-2">{member.role !== 'owner' && <button type="button" onClick={() => openEdit(member)} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-bold text-[#0b2348] hover:border-orange-300 hover:bg-orange-50">Edit</button>}{member.role !== 'owner' && member.userId !== currentUserId && member.isActive && <button type="button" disabled={busy} onClick={() => void deactivate(member)} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Deactivate</button>}</div></td>}
            </tr>)}
          </tbody>
        </table>
        {filteredMembers.length === 0 && <div className="flex flex-col items-center px-5 py-12 text-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-orange-50 text-orange-600"><UsersRound size={24} aria-hidden="true"/></span><h3 className="mt-4 font-bold text-[#0b2348]">{members.length ? 'No staff match your filters' : 'No staff members yet'}</h3><p className="mt-1 max-w-md text-sm text-slate-600">{members.length ? 'Try another name, email, or status.' : 'Add a staff member by email to send them an invitation link and get started.'}</p>{!members.length && canManage && <button type="button" onClick={openInvite} className="mt-4 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700">Add staff</button>}</div>}
      </div>
    </section>

    {mode && <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMode(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
      <section role="dialog" aria-modal="true" aria-labelledby="staff-dialog-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-600">Team access</p><h2 id="staff-dialog-title" className="mt-1 text-xl font-bold text-[#0b2348]">{mode === 'invite' ? 'Add staff member' : 'Edit staff access'}</h2><p className="mt-1 text-sm text-slate-600">{mode === 'invite' ? 'We’ll email a secure invitation link to their Gmail address.' : 'Update role, event access, or membership status.'}</p></div><button type="button" onClick={() => setMode(null)} aria-label="Close dialog" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={19}/></button></div>
        <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-5 p-5 sm:p-6">
          {mode === 'invite' && <label className="block text-sm font-semibold text-slate-700">Gmail address <span className="text-orange-600">*</span><input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="staff@gmail.com" className={fieldClass}/><span className="mt-1.5 block text-xs font-normal text-slate-500">They’ll use this address to sign in to RaceDeck and join your organization.</span></label>}
          <label className="block text-sm font-semibold text-slate-700">Staff role <span className="text-orange-600">*</span><select required value={role} onChange={event => setRole(event.target.value)} className={fieldClass}><option value="">Choose a role</option>{staffRoles.map(item => <option key={item.role} value={item.role}>{item.displayName}</option>)}</select><span className="mt-1.5 block text-xs font-normal text-slate-500">Role determines which organizer tools this staff member can use.</span></label>
          <fieldset className="space-y-3"><legend className="text-sm font-semibold text-slate-700">Event access</legend><label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3"><input type="radio" name="event-access" checked={allEvents} onChange={() => setAllEvents(true)} className="mt-0.5 accent-orange-600"/><span><span className="block text-sm font-semibold text-slate-800">All events</span><span className="text-xs text-slate-500">Access to current and future organization events.</span></span></label><label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3"><input type="radio" name="event-access" checked={!allEvents} onChange={() => setAllEvents(false)} className="mt-0.5 accent-orange-600"/><span><span className="block text-sm font-semibold text-slate-800">Selected events only</span><span className="text-xs text-slate-500">Limit access to the events selected below.</span></span></label>
            {!allEvents && <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3">{events.length ? events.map(event => <label key={event.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={access.includes(event.id)} onChange={() => toggleEvent(event.id)} className="h-4 w-4 accent-orange-600"/>{event.name}</label>) : <p className="p-2 text-sm text-slate-500">There are no events to assign yet.</p>}</div>}
          </fieldset>
          {mode === 'edit' && <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-600"/><span><span className="block text-sm font-semibold text-slate-800">Active membership</span><span className="text-xs text-slate-500">Inactive members can no longer access this organization.</span></span></label>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setMode(null)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={busy || !role || (!allEvents && (!events.length || !access.length))} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{mode === 'invite' ? <MailPlus size={16}/> : <Check size={16}/>} {busy ? 'Saving…' : mode === 'invite' ? 'Send invitation link' : 'Save changes'}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
