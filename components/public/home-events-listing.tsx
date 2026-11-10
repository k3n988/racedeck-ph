import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import type { HomepagePublicEventsResult, PublicEventCard } from '@/lib/public/events';
import { RetryButton } from '@/components/public/retry-button';

function formatEventDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
}

function EventActions({ event }: { event: PublicEventCard }) {
  const detailsHref = `/events/${event.slug}`;
  const primaryActionClass = 'inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#111827] transition hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2';
  const completed = event.event_status === 'completed' || event.registration_availability === 'completed';
  if (completed) {
    return event.results_available ? (
      <Link href={`/results?event=${encodeURIComponent(event.id)}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">View Results</Link>
    ) : (
      <Link href={detailsHref} className={primaryActionClass}>View Details <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
    );
  }
  if (!event.registration_enabled) {
    return <Link href={detailsHref} className={primaryActionClass}>View Details <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>;
  }
  return <Link href={`/events/${event.id}/register`} className={primaryActionClass}>Register Now <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>;
}

function EventCard({ event }: { event: PublicEventCard }) {
  const location = event.venue ?? event.address ?? 'Location to be announced';
  const categories = Array.from(new Set(event.category_labels
    .flatMap(({ distance_km }) => distance_km === null ? [] : [`${distance_km}K`])));
  const visibleCategories = categories.slice(0, 3);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2">
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-2xl bg-gradient-to-br from-[#09204a] via-[#163c70] to-orange-700">
        {event.banner_url ? <img src={event.banner_url} alt={`${event.name} event poster`} loading="lazy" className={`h-full w-full ${event.poster_fallback ? 'object-contain p-2' : 'object-cover transition duration-300 group-hover:scale-[1.02]'}`} /> : <div aria-label="RaceDeck event poster placeholder" className="grid h-full place-items-center bg-[radial-gradient(circle_at_82%_18%,rgba(249,115,22,.38),transparent_28%),linear-gradient(125deg,#071b41,#173d71_72%,#a9441b)]"><span className="text-xs font-bold uppercase tracking-[0.18em] text-orange-100">RaceDeck PH</span></div>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="break-words text-lg font-bold leading-tight text-[#0a234b]"><Link href={`/events/${event.slug}`} className="line-clamp-2 rounded-sm transition hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500">{event.name}</Link></h3>
        <p className="mt-1 flex min-h-5 items-center gap-2 text-sm text-slate-600"><CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-orange-600" /><time dateTime={event.event_date}>{formatEventDate(event.event_date)}</time></p>
        <p className="mt-1 flex min-h-5 items-start gap-2 text-sm leading-5 text-slate-600"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /><span className="line-clamp-2">{location}</span></p>
        <div className="mt-2 flex min-h-7 flex-wrap gap-2">
          {visibleCategories.length ? <>
            {visibleCategories.map((label) => <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{label}</span>)}
            {categories.length > visibleCategories.length && <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">+{categories.length - visibleCategories.length} more</span>}
          </> : <span className="text-xs text-slate-500">Category details coming soon</span>}
        </div>
      <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><EventActions event={event} /></div>
      </div>
    </article>
  );
}

export function HomeEventsSkeleton() {
  return (
    <div role="status" aria-label="Loading events" aria-busy="true" className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((item) => <div key={item} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="motion-safe:animate-pulse aspect-[16/9] bg-slate-200" /><div className="space-y-3 p-5"><div className="motion-safe:animate-pulse h-6 w-24 rounded-full bg-slate-200" /><div className="motion-safe:animate-pulse h-12 w-3/4 rounded bg-slate-200" /><div className="motion-safe:animate-pulse h-5 w-1/2 rounded bg-slate-100" /><div className="motion-safe:animate-pulse h-10 w-4/5 rounded bg-slate-100" /><div className="motion-safe:animate-pulse h-7 w-1/2 rounded bg-slate-100" /><div className="motion-safe:animate-pulse h-5 w-1/3 rounded bg-slate-100" /><div className="motion-safe:animate-pulse h-11 rounded bg-slate-100" /></div></div>)}
    </div>
  );
}

export function HomeEventsListing({ homepageData: data }: { homepageData: HomepagePublicEventsResult }) {
  if (data.error) {
    return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-6 text-center"><p className="text-sm font-semibold text-amber-900">Events couldn’t be loaded right now.</p><p className="mt-1 text-sm text-amber-800">Please try again in a moment.</p><RetryButton /></div>;
  }

  const events = data.events.slice(0, 4);
  if (!events.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center"><p className="text-sm font-semibold text-slate-800">No events available yet</p><p className="mt-1 text-sm text-slate-500">New races are coming soon. Check back for upcoming events.</p></div>;
  }

  return <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>;
}
