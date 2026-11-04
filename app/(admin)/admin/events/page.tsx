import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, Search } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, StatusBadge } from '@/components/admin/admin-ui';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;

export default async function AdminEventsPage({ searchParams }: { searchParams?: { review?: string; q?: string; page?: string } }) {
  const db = createAdminClient();
  const pendingOnly = searchParams?.review === 'pending_review';
  const search = (searchParams?.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  let query = db.from('events')
    .select('id,name,event_date,venue,address,lifecycle_status,review_status,registration_availability,updated_at,organizations(name)', { count: 'exact' });
  if (pendingOnly) query = query.eq('review_status', 'pending_review');
  if (search) query = query.ilike('name', `%${search}%`);
  const [listing, pendingCount] = await Promise.all([
    query.order('updated_at', { ascending: pendingOnly }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('events').select('id', { count: 'exact', head: true }).eq('review_status', 'pending_review'),
  ]);
  const rows = listing.data ?? [];
  const total = listing.count ?? 0;
  const urlFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (pendingOnly) params.set('review', 'pending_review');
    if (search) params.set('q', search);
    if (nextPage > 1) params.set('page', String(nextPage));
    const queryString = params.toString();
    return `/admin/events${queryString ? `?${queryString}` : ''}`;
  };
  if (!listing.error && total > 0 && page > Math.ceil(total / PAGE_SIZE)) redirect(urlFor(Math.ceil(total / PAGE_SIZE)));

  return <AdminPage eyebrow="Platform / Management" title="Events" description="Review submitted events before organizers publish them.">
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/admin/events" aria-current={!pendingOnly ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${pendingOnly ? 'border border-slate-200 bg-white text-slate-700' : 'bg-[#071b41] text-white'}`}>All events</Link>
      <Link href="/admin/events?review=pending_review" aria-current={pendingOnly ? 'page' : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${pendingOnly ? 'bg-orange-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>Review queue {pendingCount.error ? '' : `(${pendingCount.count ?? 0})`}</Link>
    </div>
    <form method="get" className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {pendingOnly && <input type="hidden" name="review" value="pending_review" />}
      <label className="relative min-w-56 flex-1"><span className="sr-only">Search event name</span><Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input name="q" defaultValue={search} maxLength={100} placeholder="Search event name" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
      <button type="submit" className="rounded-lg bg-[#071b41] px-5 py-2.5 text-sm font-bold text-white">Search</button>
      {search && <Link href={pendingOnly ? '/admin/events?review=pending_review' : '/admin/events'} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Clear</Link>}
    </form>
    {listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Events could not be loaded. Refresh this page to try again.</p> : rows.length ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm"><p className="font-semibold text-[#071b41]">{pendingOnly ? 'Awaiting review' : 'Event records'}</p><p className="text-slate-500">{total.toLocaleString()} event{total === 1 ? '' : 's'}</p></div>
      <div className="divide-y divide-slate-100">{rows.map((event) => <Link key={event.id} href={`/admin/events/${event.id}`} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500">
        <div className="min-w-0 flex-1"><p className="font-bold text-[#071b41]">{event.name}</p><p className="mt-1 text-sm text-slate-600">{event.organizations?.name ?? 'Organizer unavailable'} · {event.venue ?? event.address ?? 'Location to be announced'}</p></div>
        <div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-1.5 text-sm text-slate-600"><CalendarDays size={16} aria-hidden="true" />{new Date(event.event_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</span><StatusBadge value={event.review_status} />{!pendingOnly && <StatusBadge value={event.lifecycle_status} />}<span className="text-sm font-bold text-orange-600">{event.review_status === 'pending_review' ? 'Review →' : 'View →'}</span></div>
      </Link>)}</div>
    </section> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><CalendarDays size={28} className="mx-auto text-slate-400" /><p className="mt-3 font-bold text-[#071b41]">{search ? 'No events match this search' : pendingOnly ? 'No events waiting for review' : 'No events yet'}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try another event name.' : pendingOnly ? 'New organizer submissions will appear here.' : 'Events will appear when organizers create them.'}</p></div>}
    {!listing.error && total > PAGE_SIZE && <nav aria-label="Event pages" className="flex items-center justify-between text-sm"><span className="text-slate-500">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span><div className="flex gap-2">{page > 1 && <Link href={urlFor(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Previous</Link>}{page * PAGE_SIZE < total && <Link href={urlFor(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Next</Link>}</div></nav>}
  </AdminPage>;
}
