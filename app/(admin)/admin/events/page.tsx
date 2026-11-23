import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, DataTable, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import EventFilters from './event-filters';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const PAGE_SIZES = [20, 50, 100] as const;

const EVENT_FILTERS = ['all', 'review:not_submitted', 'review:pending_review', 'review:needs_changes', 'review:approved', 'review:rejected', 'lifecycle:draft', 'lifecycle:published', 'lifecycle:ongoing', 'lifecycle:completed', 'lifecycle:cancelled', 'lifecycle:archived'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminEventsPage({ searchParams }: { searchParams?: { review?: string; status?: string; q?: string; event?: string; page?: string; rows?: string } }) {
  const db = createAdminClient();
  const statusFilter = EVENT_FILTERS.find((value) => value === searchParams?.status) ?? 'all';
  const eventId = UUID.test(searchParams?.event ?? '') ? searchParams!.event! : '';
  const pendingOnly = searchParams?.review === 'pending_review' && statusFilter === 'all';
  const search = (searchParams?.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  const requestedPageSize = Number(searchParams?.rows);
  const pageSize = PAGE_SIZES.includes(requestedPageSize as typeof PAGE_SIZES[number]) ? requestedPageSize : PAGE_SIZE;
  let query = db.from('events')
    .select('id,name,event_date,venue,address,lifecycle_status,review_status,registration_availability,updated_at,organizations(name)', { count: 'exact' });
  if (eventId) query = query.eq('id', eventId);
  if (pendingOnly) query = query.eq('review_status', 'pending_review');
  if (statusFilter.startsWith('review:')) query = query.eq('review_status', statusFilter.slice('review:'.length) as 'pending_review');
  if (statusFilter.startsWith('lifecycle:')) query = query.eq('lifecycle_status', statusFilter.slice('lifecycle:'.length) as 'draft');
  if (search) query = query.ilike('name', `%${search}%`);
  const [listing, totalCount, pendingCount, publicCount, needsChangesCount, eventOptions] = await Promise.all([
    query.order('updated_at', { ascending: pendingOnly }).range((page - 1) * pageSize, page * pageSize - 1),
    db.from('events').select('id', { count: 'exact', head: true }),
    db.from('events').select('id', { count: 'exact', head: true }).eq('review_status', 'pending_review'),
    db.from('events').select('id', { count: 'exact', head: true }).in('lifecycle_status', ['published', 'ongoing']).eq('review_status', 'approved'),
    db.from('events').select('id', { count: 'exact', head: true }).eq('review_status', 'needs_changes'),
    db.from('events').select('id,name').order('event_date', { ascending: false }),
  ]);
  const rows = listing.data ?? [];
  const total = listing.count ?? 0;
  const urlFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (pendingOnly) params.set('review', 'pending_review');
    if (eventId) params.set('event', eventId);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('q', search);
    if (pageSize !== PAGE_SIZE) params.set('rows', String(pageSize));
    if (nextPage > 1) params.set('page', String(nextPage));
    const queryString = params.toString();
    return `/admin/events${queryString ? `?${queryString}` : ''}`;
  };
  if (!listing.error && total > 0 && page > Math.ceil(total / pageSize)) redirect(urlFor(Math.ceil(total / pageSize)));
  const pagination = !listing.error && total > 0 ? <nav aria-label="Event pages" className="flex flex-wrap items-center justify-between gap-3 text-sm"><div className="flex flex-wrap items-center gap-4"><span className="text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}</span><form method="get" className="flex items-center gap-2">{pendingOnly && <input type="hidden" name="review" value="pending_review" />}<input type="hidden" name="status" value={statusFilter} />{eventId && <input type="hidden" name="event" value={eventId} />}{search && <input type="hidden" name="q" value={search} />}<label htmlFor="event-page-size" className="text-slate-600">Rows</label><select id="event-page-size" name="rows" defaultValue={pageSize} className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select><button type="submit" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-orange-400">Apply</button></form></div><div className="flex items-center gap-2"><span className="px-2 text-slate-600">Page {page} of {Math.ceil(total / pageSize)}</span>{page > 1 && <Link href={urlFor(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Previous</Link>}{page * pageSize < total && <Link href={urlFor(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Next</Link>}</div></nav> : null;

  return <AdminPage eyebrow="Platform / Management" title="Events" description="" compactTop compactSections>
    <EventFilters pendingOnly={pendingOnly} statusFilter={statusFilter} search={search} events={eventOptions.data ?? []} eventId={eventId} />
    <section aria-label="Event summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="All events" value={totalCount.error ? '—' : (totalCount.count ?? 0).toLocaleString()} detail="Event records" />
      <StatCard label="Awaiting review" value={pendingCount.error ? '—' : (pendingCount.count ?? 0).toLocaleString()} detail="Submitted by organizers" />
      <StatCard label="Published / ongoing" value={publicCount.error ? '—' : (publicCount.count ?? 0).toLocaleString()} detail="Approved and visible" />
      <StatCard label="Needs changes" value={needsChangesCount.error ? '—' : (needsChangesCount.count ?? 0).toLocaleString()} detail="Waiting for organizer updates" />
    </section>
    {listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Events could not be loaded. Refresh this page to try again.</p> : rows.length ? <DataTable headers={['#', 'Event', 'Organizer', 'Venue / location', 'Event date', 'Review status', 'Event status', 'Action']} footer={pagination}>
      {rows.map((event, index) => <tr key={event.id} className="align-middle hover:bg-slate-50">
        <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">{(page - 1) * pageSize + index + 1}</td>
        <td className="max-w-56 px-4 py-3"><Link href={`/admin/events/${event.id}`} className="font-bold text-[#071b41] hover:text-orange-700">{event.name}</Link></td>
        <td className="max-w-48 px-4 py-3 text-slate-700">{event.organizations?.name ?? 'Organizer unavailable'}</td>
        <td className="max-w-56 px-4 py-3 text-slate-600">{event.venue ?? event.address ?? 'Location to be announced'}</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{new Date(event.event_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
        <td className="px-4 py-3"><StatusBadge value={event.review_status} /></td>
        <td className="px-4 py-3"><StatusBadge value={event.lifecycle_status} /></td>
        <td className="whitespace-nowrap px-4 py-3"><Link href={`/admin/events/${event.id}`} className="font-bold text-orange-600 hover:underline">{event.review_status === 'pending_review' ? 'Review' : 'View'} →</Link></td>
      </tr>)}
    </DataTable> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500"><CalendarDays size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">{search ? 'No events match this search' : pendingOnly ? 'Review queue is clear' : statusFilter !== 'all' ? 'No events match this status' : 'No events yet'}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try another event name.' : pendingOnly ? 'New organizer submissions will appear here.' : statusFilter !== 'all' ? 'Choose another event status or clear the filters.' : 'Events will appear when organizers create them.'}</p>{(search || statusFilter !== 'all' || eventId) && <Link href={pendingOnly ? '/admin/events?review=pending_review' : '/admin/events'} className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div>}
  </AdminPage>;
}
