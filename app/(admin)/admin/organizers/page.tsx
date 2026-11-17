import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Clock3, Search, UsersRound } from 'lucide-react';
import { AdminPage, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const PAGE_SIZES = [20, 50, 100] as const;
const STATUSES = ['all', 'pending_review', 'needs_changes', 'approved', 'rejected', 'draft'] as const;

export default async function AdminOrganizersPage({ searchParams }: { searchParams?: { status?: string; q?: string; page?: string; rows?: string } }) {
  const db = createAdminClient();
  const status = STATUSES.find((value) => value === searchParams?.status) ?? 'all';
  const search = (searchParams?.q ?? '').trim().slice(0, 100);
  const safeSearch = search.replace(/[,%().]/g, ' ');
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  const requestedPageSize = Number(searchParams?.rows);
  const pageSize = PAGE_SIZES.includes(requestedPageSize as typeof PAGE_SIZES[number]) ? requestedPageSize : PAGE_SIZE;
  let query = db.from('organizations').select('id,name,contact_email,account_status,verification_status,created_at,updated_at,organizer_verifications(status,submitted_at)', { count: 'exact' });
  if (status !== 'all') query = query.eq('verification_status', status);
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,contact_email.ilike.%${safeSearch}%`);
  const [listing, totalCount, pendingCount, approvedCount, needsChangesCount] = await Promise.all([
    query.order('updated_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    db.from('organizations').select('id', { count: 'exact', head: true }),
    db.from('organizations').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending_review'),
    db.from('organizations').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved').eq('account_status', 'active'),
    db.from('organizations').select('id', { count: 'exact', head: true }).eq('verification_status', 'needs_changes'),
  ]);
  const rows = listing.data ?? [];
  const total = listing.count ?? 0;
  const urlFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (search) params.set('q', search);
    if (pageSize !== PAGE_SIZE) params.set('rows', String(pageSize));
    if (nextPage > 1) params.set('page', String(nextPage));
    return `/admin/organizers${params.size ? `?${params}` : ''}`;
  };
  if (!listing.error && total > 0 && page > Math.ceil(total / pageSize)) redirect(urlFor(Math.ceil(total / pageSize)));
  const pagination = !listing.error && total > 0 ? <nav aria-label="Organization pages" className="flex flex-wrap items-center justify-between gap-3 text-sm"><div className="flex flex-wrap items-center gap-4"><span className="text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}</span><form method="get" className="flex items-center gap-2"><input type="hidden" name="status" value={status} />{search && <input type="hidden" name="q" value={search} />}<label htmlFor="organizer-page-size" className="text-slate-600">Rows</label><select id="organizer-page-size" name="rows" defaultValue={pageSize} className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select><button type="submit" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-orange-400">Apply</button></form></div><div className="flex items-center gap-2"><span className="px-2 text-slate-600">Page {page} of {Math.ceil(total / pageSize)}</span>{page > 1 && <Link href={urlFor(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Previous</Link>}{page * pageSize < total && <Link href={urlFor(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Next</Link>}</div></nav> : null;

  return <AdminPage eyebrow="Platform / Management" title="Organizers" description="" compactTop compactSections>
    <section aria-label="Organization summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="All organizations" value={totalCount.error ? '—' : (totalCount.count ?? 0).toLocaleString()} detail="Organization accounts" />
      <StatCard label="Awaiting review" value={pendingCount.error ? '—' : (pendingCount.count ?? 0).toLocaleString()} detail="Applications to review" tone="amber" />
      <StatCard label="Approved and active" value={approvedCount.error ? '—' : (approvedCount.count ?? 0).toLocaleString()} detail="Ready to manage events" tone="green" />
      <StatCard label="Needs changes" value={needsChangesCount.error ? '—' : (needsChangesCount.count ?? 0).toLocaleString()} detail="Waiting on organizer" tone="orange" />
    </section>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <nav className="flex shrink-0 flex-wrap items-center gap-2" aria-label="Organizer views">
        <Link href="/admin/organizers" aria-current={status === 'all' ? 'page' : undefined} className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold ${status === 'all' ? 'bg-[#071b41] text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-orange-300'}`}>All organizations</Link>
        <Link href="/admin/organizers?status=pending_review" aria-current={status === 'pending_review' ? 'page' : undefined} className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold ${status === 'pending_review' ? 'bg-orange-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-orange-300'}`}>Review queue {pendingCount.error ? '' : `(${pendingCount.count ?? 0})`}</Link>
      </nav>
      <form method="get" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="organizer-verification-status">Verification status</label>
        <select id="organizer-verification-status" name="status" defaultValue={status} className="h-10 min-w-40 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
          {STATUSES.map((value) => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value.replaceAll('_', ' ')}</option>)}
        </select>
        <label className="relative min-w-[220px] flex-1"><span className="sr-only">Search organization name or contact email</span><Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input name="q" defaultValue={search} maxLength={100} placeholder="Search organization or contact email" className="h-10 w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
        <button type="submit" className="h-10 rounded-lg bg-[#071b41] px-5 text-sm font-bold text-white hover:bg-[#102b58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Apply</button>
        {(search || status !== 'all') && <Link href="/admin/organizers" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}
      </form>
    </div>
    {listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Organizations could not be loaded. Refresh this page to try again.</p> : rows.length ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm"><h2 className="font-bold text-[#071b41]">Organization records</h2><span className="text-slate-500">{total.toLocaleString()} organization{total === 1 ? '' : 's'}</span></div>
      <div className="divide-y divide-slate-100">{rows.map((organization) => <Link key={organization.id} href={`/admin/organizers/${organization.id}`} className="group flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
        <span className="flex min-w-0 flex-1 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><Building2 size={19} aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-bold text-[#071b41] group-hover:text-orange-700">{organization.name || 'Unnamed organization'}</span><span className="block truncate text-sm text-slate-500">{organization.contact_email ?? 'No contact email'} · Created {new Date(organization.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</span></span></span>
        <span className="flex flex-wrap items-center gap-2"><StatusBadge value={organization.organizer_verifications?.status ?? organization.verification_status} /><StatusBadge value={organization.account_status} /><span className="ml-1 text-sm font-bold text-orange-600">{organization.verification_status === 'pending_review' ? 'Review →' : 'View →'}</span></span>
      </Link>)}</div>
      {pagination && <div className="border-t border-slate-100 px-5 py-3">{pagination}</div>}
    </section> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">{status === 'pending_review' ? <Clock3 size={23} aria-hidden="true" /> : search ? <Search size={23} aria-hidden="true" /> : <UsersRound size={23} aria-hidden="true" />}</span><p className="mt-3 font-bold text-[#071b41]">{search ? 'No organizations match this search' : status === 'pending_review' ? 'Review queue is clear' : 'No organizations found'}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try a different organization name or contact email.' : status === 'pending_review' ? 'New applications will appear here when organizers submit them.' : 'Organization accounts will appear here once they are created.'}</p>{(search || status !== 'all') && <Link href="/admin/organizers" className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div>}
  </AdminPage>;
}
