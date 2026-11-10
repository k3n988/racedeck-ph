import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, MapPin } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, StatusBadge, Money } from '@/components/admin/admin-ui';
import EventReviewActions from './review-actions';
import EventReviewSummary from './review-summary';
import DeleteEventButton from './delete-event-button';

export const dynamic = 'force-dynamic';

export default async function AdminEventDetails({ params }: { params: { eventId: string } }) {
  const db = createAdminClient();
  const [eventResult, categoryResult, historyResult] = await Promise.all([
    db.from('events').select('id,name,description,event_date,venue,address,lifecycle_status,review_status,review_feedback,registration_availability,registration_opens_at,registration_closes_at,overall_capacity,organizations(id,name,contact_email,verification_status,account_status)').eq('id', params.eventId).maybeSingle(),
    db.from('race_categories').select('id,name,distance_km,registration_fee,max_slots').eq('event_id', params.eventId).order('distance_km'),
    db.from('event_review_history').select('id,from_status,to_status,feedback,reviewed_at').eq('event_id', params.eventId).order('reviewed_at', { ascending: false }).limit(10),
  ]);
  if (eventResult.error) return <AdminPage showHeading title="Event review" description="The event could not be loaded."><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Event details could not be loaded. Refresh to try again.</p></AdminPage>;
  const event = eventResult.data;
  if (!event) notFound();
  const categories = categoryResult.data ?? [];
  const history = historyResult.data ?? [];
  const organizer = event.organizations;
  const formatDate = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

  return <AdminPage showHeading eyebrow="Platform / Event review" title={event.name} description={organizer?.name ?? 'Organizer unavailable'} action={<div className="flex flex-wrap items-start justify-end gap-2"><Link href="/admin/events?review=pending_review" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#071b41]">← Review queue</Link><DeleteEventButton eventId={event.id} eventName={event.name} /></div>}>
    <div className="flex flex-wrap items-center gap-2"><StatusBadge value={event.review_status} /><StatusBadge value={event.lifecycle_status} />{['published', 'ongoing', 'completed'].includes(event.lifecycle_status) && event.review_status === 'approved' && <Link href={`/events/${event.id}`} className="ml-auto text-sm font-bold text-orange-600">Open public page →</Link>}</div>
    {event.review_status === 'approved' && event.lifecycle_status === 'draft' && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Approved. The organizer can now publish this event; approval alone does not make it public.</p>}
    {event.review_feedback && event.review_status !== 'pending_review' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Latest review feedback:</strong> {event.review_feedback}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold text-[#071b41]">Event information</h2>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2 text-slate-700"><CalendarDays size={18} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" /><span><strong className="block text-[#071b41]">Event date</strong>{new Date(event.event_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long' })}</span></p>
            <p className="flex items-start gap-2 text-slate-700"><MapPin size={18} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" /><span><strong className="block text-[#071b41]">Venue</strong>{event.venue ?? event.address ?? 'Not provided'}</span></p>
            <div><p className="font-bold text-[#071b41]">Registration opens</p><p className="text-slate-600">{event.registration_opens_at ? formatDate(event.registration_opens_at) : 'Not set'}</p></div>
            <div><p className="font-bold text-[#071b41]">Registration closes</p><p className="text-slate-600">{event.registration_closes_at ? formatDate(event.registration_closes_at) : 'Not set'}</p></div>
          </div>
          {event.address && event.address !== event.venue && <p className="mt-3 text-sm text-slate-600"><strong className="text-[#071b41]">Address:</strong> {event.address}</p>}
        </section>
        <EventReviewSummary eventId={event.id} description={event.description} />
      </div>
      <div className="min-w-0 space-y-5">
        <EventReviewActions eventId={event.id} reviewStatus={event.review_status} reviewBlocked={Boolean(categoryResult.error)} />
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-[#071b41]">Organizer & capacity</h2>
          <dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Organizer</dt><dd className="text-right font-semibold">{organizer?.id ? <Link href={`/admin/organizers/${organizer.id}`} className="text-orange-600 hover:underline">{organizer.name}</Link> : 'Unavailable'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Account</dt><dd>{organizer?.account_status ?? 'Unknown'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Verification</dt><dd>{organizer?.verification_status ?? 'Unknown'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Capacity</dt><dd>{event.overall_capacity?.toLocaleString() ?? 'Unlimited'}</dd></div></dl>
          {organizer?.contact_email && <p className="mt-4 break-all border-t border-slate-100 pt-3 text-sm text-slate-600">{organizer.contact_email}</p>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-[#071b41]">Race categories</h2>
          {categoryResult.error ? <p className="mt-3 text-sm text-red-700">Categories could not be loaded. Review cannot be completed until they are visible.</p> : categories.length ? <ul className="mt-3 divide-y divide-slate-100">{categories.map((category) => <li key={category.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span><strong className="block text-[#071b41]">{category.name}</strong><span className="text-slate-500">{category.distance_km != null ? `${category.distance_km} km` : 'Distance not set'} · {category.max_slots?.toLocaleString() ?? 'Unlimited'} slots</span></span><span className="font-semibold"><Money value={Number(category.registration_fee)} /></span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No categories configured.</p>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-[#071b41]">Review history</h2>
          {historyResult.error ? <p className="mt-3 text-sm text-red-700">Review history could not be loaded.</p> : history.length ? <ol className="mt-3 space-y-3">{history.map((item) => <li key={item.id} className="border-l-2 border-orange-200 pl-3 text-sm"><p className="font-semibold capitalize text-[#071b41]">{item.to_status.replaceAll('_', ' ')}</p><p className="text-xs text-slate-500">{formatDate(item.reviewed_at)}</p>{item.feedback && <p className="mt-1 whitespace-pre-wrap text-slate-700">{item.feedback}</p>}</li>)}</ol> : <p className="mt-3 text-sm text-slate-500">No review activity yet.</p>}
        </section>
      </div>
    </div>
  </AdminPage>;
}
