import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Search } from 'lucide-react';
import { AdminPage, StatusBadge } from '@/components/admin/admin-ui';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const STATUSES = ['all', 'pending_review', 'needs_changes', 'approved', 'rejected', 'draft'] as const;

export default async function AdminOrganizersPage({ searchParams }: { searchParams?: { status?: string; q?: string; page?: string } }) {
  const db = createAdminClient();
  const status = STATUSES.find((value) => value === searchParams?.status) ?? 'all';
  const search = (searchParams?.q ?? '').trim().slice(0, 100);
  const safeSearch = search.replace(/[,%().]/g, ' ');
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  let query = db.from('organizations').select('id,name,contact_email,account_status,verification_status,created_at,updated_at,organizer_verifications(status,submitted_at)', { count: 'exact' });
  if (status !== 'all') query = query.eq('verification_status', status);
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,contact_email.ilike.%${safeSearch}%`);
  const [listing, pendingCount] = await Promise.all([
    query.order('updated_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('organizer_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
  ]);
  const rows = listing.data ?? [];
  const total = listing.count ?? 0;
  const urlFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (search) params.set('q', search);
    if (nextPage > 1) params.set('page', String(nextPage));
    return `/admin/organizers${params.size ? `?${params}` : ''}`;
  };
  if (!listing.error && total > 0 && page > Math.ceil(total / PAGE_SIZE)) redirect(urlFor(Math.ceil(total / PAGE_SIZE)));

  return <AdminPage eyebrow="Platform / Management" title="Organizers" description="Review applications and see every organization on RaceDeck.">
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/admin/organizers" aria-current={status === 'all' ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${status === 'all' ? 'bg-[#071b41] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>All organizations</Link>
      <Link href="/admin/organizers?status=pending_review" aria-current={status === 'pending_review' ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${status === 'pending_review' ? 'bg-orange-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>Review queue {pendingCount.error ? '' : `(${pendingCount.count ?? 0})`}</Link>
    </div>
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <label className="min-w-44 text-xs font-bold uppercase tracking-wide text-slate-500">Verification
        <select name="status" defaultValue={status} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal normal-case text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
          {STATUSES.map((value) => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value.replaceAll('_', ' ')}</option>)}
        </select>
      </label>
      <label className="relative min-w-56 flex-1"><span className="sr-only">Search organization name or contact email</span><Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input name="q" defaultValue={search} maxLength={100} placeholder="Search organization or contact email" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
      <button type="submit" className="rounded-lg bg-[#071b41] px-5 py-2.5 text-sm font-bold text-white">Apply</button>
      {(search || status !== 'all') && <Link href="/admin/organizers" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Clear</Link>}
    </form>
    {listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Organizations could not be loaded. Refresh this page to try again.</p> : rows.length ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm"><h2 className="font-bold text-[#071b41]">Organization records</h2><span className="text-slate-500">{total.toLocaleString()} organization{total === 1 ? '' : 's'}</span></div>
      <div className="divide-y divide-slate-100">{rows.map((organization) => <Link key={organization.id} href={`/admin/organizers/${organization.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
        <span className="min-w-0 flex-1"><span className="block font-bold text-[#071b41]">{organization.name}</span><span className="block truncate text-sm text-slate-500">{organization.contact_email ?? 'No contact email'} · Created {new Date(organization.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</span></span>
        <span className="flex flex-wrap items-center gap-2"><StatusBadge value={organization.organizer_verifications?.status ?? organization.verification_status} /><StatusBadge value={organization.account_status} /><span className="text-sm font-bold text-orange-600">{organization.organizer_verifications?.status === 'pending_review' ? 'Review →' : 'View →'}</span></span>
      </Link>)}</div>
    </section> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><Building2 size={28} className="mx-auto text-slate-400" aria-hidden="true" /><p className="mt-3 font-bold text-[#071b41]">{search ? 'No organizations match this search' : status === 'pending_review' ? 'No organizer applications waiting for review' : 'No organizations found'}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try another name or email.' : status === 'pending_review' ? 'New submissions will appear here.' : 'Organizations will appear here when they are created.'}</p></div>}
    {!listing.error && total > PAGE_SIZE && <nav aria-label="Organization pages" className="flex items-center justify-between text-sm"><span className="text-slate-500">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span><div className="flex gap-2">{page > 1 && <Link href={urlFor(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Previous</Link>}{page * PAGE_SIZE < total && <Link href={urlFor(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Next</Link>}</div></nav>}
  </AdminPage>;
}
