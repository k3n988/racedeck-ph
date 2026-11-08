import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, Search } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, StatCard, StatusBadge } from '@/components/admin/admin-ui';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;

const EVENT_FILTERS = ['all', 'review:not_submitted', 'review:pending_review', 'review:needs_changes', 'review:approved', 'review:rejected', 'lifecycle:draft', 'lifecycle:published', 'lifecycle:ongoing', 'lifecycle:completed', 'lifecycle:cancelled', 'lifecycle:archived'] as const;

export default async function AdminEventsPage({ searchParams }: { searchParams?: { review?: string; status?: string; q?: string; page?: string } }) {
  const db = createAdminClient();
  const statusFilter = EVENT_FILTERS.find((value) => value === searchParams?.status) ?? 'all';
  const pendingOnly = searchParams?.review === 'pending_review' && statusFilter === 'all';
  const search = (searchParams?.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  let query = db.from('events')
    .select('id,name,event_date,venue,address,lifecycle_status,review_status,registration_availability,updated_at,organizations(name)', { count: 'exact' });
  if (pendingOnly) query = query.eq('review_status', 'pending_review');
  if (statusFilter.startsWith('review:')) query = query.eq('review_status', statusFilter.slice('review:'.length) as 'pending_review');
  if (statusFilter.startsWith('lifecycle:')) query = query.eq('lifecycle_status', statusFilter.slice('lifecycle:'.length) as 'draft');
  if (search) query = query.ilike('name', `%${search}%`);
  const [listing, totalCount, pendingCount, publicCount, needsChangesCount] = await Promise.all([
    query.order('updated_at', { ascending: pendingOnly }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('events').select('id', { count: 'exact', head: true }),
    db.from('events').select('id', { count: 'exact', head: true }).eq('review_status', 'pending_review'),
    db.from('events').select('id', { count: 'exact', head: true }).in('lifecycle_status', ['published', 'ongoing']).eq('review_status', 'approved'),
    db.from('events').select('id', { count: 'exact', head: true }).eq('review_status', 'needs_changes'),
  ]);
  const rows = listing.data ?? [];
  const total = listing.count ?? 0;
  const urlFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (pendingOnly) params.set('review', 'pending_review');
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('q', search);
    if (nextPage > 1) params.set('page', String(nextPage));
    const queryString = params.toString();
    return `/admin/events${queryString ? `?${queryString}` : ''}`;
  };
  if (!listing.error && total > 0 && page > Math.ceil(total / PAGE_SIZE)) redirect(urlFor(Math.ceil(total / PAGE_SIZE)));

  return <AdminPage eyebrow="Platform / Management" title="Events" description="" compactTop>
    <section aria-label="Event summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="All events" value={totalCount.error ? '—' : (totalCount.count ?? 0).toLocaleString()} detail="Event records" />
      <StatCard label="Awaiting review" value={pendingCount.error ? '—' : (pendingCount.count ?? 0).toLocaleString()} detail="Submitted by organizers" tone="amber" />
      <StatCard label="Published / ongoing" value={publicCount.error ? '—' : (publicCount.count ?? 0).toLocaleString()} detail="Approved and visible" tone="green" />
      <StatCard label="Needs changes" value={needsChangesCount.error ? '—' : (needsChangesCount.count ?? 0).toLocaleString()} detail="Waiting for organizer updates" tone="orange" />
    </section>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Event views">
      <Link href="/admin/events" aria-current={!pendingOnly ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${pendingOnly ? 'border border-slate-200 bg-white text-slate-700' : 'bg-[#071b41] text-white'}`}>All events</Link>
      <Link href="/admin/events?review=pending_review" aria-current={pendingOnly ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${pendingOnly ? 'bg-orange-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>Review queue {pendingCount.error ? '' : `(${pendingCount.count ?? 0})`}</Link>
    </div>
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {pendingOnly && <input type="hidden" name="review" value="pending_review" />}
      <label className="min-w-48 text-xs font-bold uppercase tracking-wide text-slate-500">Event status
        <select name="status" defaultValue={statusFilter} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal normal-case text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
          <option value="all">All statuses</option><optgroup label="Review status"><option value="review:not_submitted">Not submitted</option><option value="review:pending_review">Awaiting review</option><option value="review:needs_changes">Needs changes</option><option value="review:approved">Approved</option><option value="review:rejected">Rejected</option></optgroup><optgroup label="Event status"><option value="lifecycle:draft">Draft</option><option value="lifecycle:published">Published</option><option value="lifecycle:ongoing">Ongoing</option><option value="lifecycle:completed">Completed</option><option value="lifecycle:cancelled">Cancelled</option><option value="lifecycle:archived">Archived</option></optgroup>
        </select>
      </label>
      <label className="relative min-w-56 flex-1"><span className="sr-only">Search event name</span><Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input name="q" defaultValue={search} maxLength={100} placeholder="Search event name" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
      <button type="submit" className="rounded-lg bg-[#071b41] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#102b58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Apply filters</button>
      {(search || statusFilter !== 'all') && <Link href={pendingOnly ? '/admin/events?review=pending_review' : '/admin/events'} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}
    </form>
    {listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Events could not be loaded. Refresh this page to try again.</p> : rows.length ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm"><p className="font-semibold text-[#071b41]">{pendingOnly ? 'Awaiting review' : 'Event records'}</p><p className="text-slate-500">{total.toLocaleString()} event{total === 1 ? '' : 's'}</p></div>
      <div className="divide-y divide-slate-100">{rows.map((event) => <Link key={event.id} href={`/admin/events/${event.id}`} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
        <div className="min-w-0 flex-1"><p className="font-bold text-[#071b41]">{event.name}</p><p className="mt-1 text-sm text-slate-600">{event.organizations?.name ?? 'Organizer unavailable'} · {event.venue ?? event.address ?? 'Location to be announced'}</p></div>
        <div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-1.5 text-sm text-slate-600"><CalendarDays size={16} aria-hidden="true" />{new Date(event.event_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</span><StatusBadge value={event.review_status} />{!pendingOnly && <StatusBadge value={event.lifecycle_status} />}<span className="text-sm font-bold text-orange-600">{event.review_status === 'pending_review' ? 'Review →' : 'View →'}</span></div>
      </Link>)}</div>
    </section> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500"><CalendarDays size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">{search ? 'No events match this search' : pendingOnly ? 'Review queue is clear' : statusFilter !== 'all' ? 'No events match this status' : 'No events yet'}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try another event name.' : pendingOnly ? 'New organizer submissions will appear here.' : statusFilter !== 'all' ? 'Choose another event status or clear the filters.' : 'Events will appear when organizers create them.'}</p>{(search || statusFilter !== 'all') && <Link href={pendingOnly ? '/admin/events?review=pending_review' : '/admin/events'} className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div>}
    {!listing.error && total > PAGE_SIZE && <nav aria-label="Event pages" className="flex items-center justify-between text-sm"><span className="text-slate-500">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span><div className="flex gap-2">{page > 1 && <Link href={urlFor(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Previous</Link>}{page * PAGE_SIZE < total && <Link href={urlFor(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Next</Link>}</div></nav>}
  </AdminPage>;
}
