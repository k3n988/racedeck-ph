import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, DataTable, EmptyState, StatCard, StatusBadge, ActionLink } from '@/components/admin/admin-ui';

export default async function AdminEventsPage({ searchParams }: { searchParams?: { review?: string } }) {
  const db = createAdminClient();
  const pendingOnly = searchParams?.review === 'pending_review';
  let eventQuery = db.from('events').select('id,name,event_date,venue,address,lifecycle_status,review_status,registration_availability,overall_capacity,organizations(name)').order('event_date', { ascending: false }).limit(100);
  if (pendingOnly) eventQuery = eventQuery.eq('review_status', 'pending_review');
  const [{ data: events }, { count: total }, { count: published }, { count: pending }, { count: ongoing }] = await Promise.all([
    eventQuery,
    db.from('events').select('id', { count: 'exact', head: true }),
    db.from('events').select('id', { count: 'exact', head: true }).eq('lifecycle_status', 'published'),
    db.from('events').select('id', { count: 'exact', head: true }).eq('review_status', 'pending_review'),
    db.from('events').select('id', { count: 'exact', head: true }).eq('lifecycle_status', 'ongoing'),
  ]);
  return <AdminPage title="Events" description="Review and manage race events across RaceDeck." action={<Link href="/admin/events?review=pending_review" className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white">Review queue</Link>}><section className="grid gap-4 sm:grid-cols-4"><StatCard label="Total events" value={total ?? 0} /><StatCard label="Published" value={published ?? 0} tone="green" /><StatCard label="Pending review" value={pending ?? 0} tone="orange" /><StatCard label="Ongoing" value={ongoing ?? 0} tone="amber" /></section><div className="flex gap-2"><Link href="/admin/events" className={`rounded-lg px-3 py-2 text-sm font-bold ${pendingOnly ? 'border border-slate-300' : 'bg-[#071b41] text-white'}`}>All events</Link><Link href="/admin/events?review=pending_review" className={`rounded-lg px-3 py-2 text-sm font-bold ${pendingOnly ? 'bg-orange-600 text-white' : 'border border-slate-300'}`}>Pending review ({pending ?? 0})</Link></div>{events?.length ? <DataTable headers={['Event','Organizer','Event date','Lifecycle','Review','Registration','Capacity','Actions']}>{events.map((event) => <tr key={event.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-bold text-[#071b41]">{event.name}</p><p className="mt-1 text-xs text-slate-500">{event.venue ?? event.address ?? 'Location to be announced'}</p></td><td className="px-4 py-4 text-slate-600">{event.organizations?.name ?? '—'}</td><td className="px-4 py-4 text-slate-600">{new Date(event.event_date).toLocaleDateString('en-PH')}</td><td className="px-4 py-4"><StatusBadge value={event.lifecycle_status} /></td><td className="px-4 py-4"><StatusBadge value={event.review_status} /></td><td className="px-4 py-4"><StatusBadge value={event.registration_availability} /></td><td className="px-4 py-4 text-slate-600">{event.overall_capacity?.toLocaleString() ?? '—'}</td><td className="px-4 py-4"><ActionLink href={`/admin/events/${event.id}`}>View</ActionLink></td></tr>)}</DataTable> : <EmptyState message="No events found." />}</AdminPage>;
}
