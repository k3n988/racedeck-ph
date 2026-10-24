import Link from 'next/link';
import { HomeHero } from '@/components/public/home-hero';
import { getFeaturedPublicEvents, getPublicEvents, type PublicEventCard } from '@/lib/public/events';

export const dynamic = 'force-dynamic';

const formatDate = (value: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
const eventHref = (event: PublicEventCard) => `/events/${event.slug}`;

function DateBadge({ value }: { value: string }) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return <div className="absolute left-3 top-3 z-10 w-12 overflow-hidden rounded-lg bg-white text-center shadow-lg ring-1 ring-slate-900/10"><p className="bg-orange-600 px-1 py-1 text-[10px] font-black uppercase tracking-wide text-white">{new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(date)}</p><p className="py-1 text-xl font-black leading-none text-[#071b41]">{date.getDate()}</p></div>;
}

function EventCard({ event }: { event: PublicEventCard }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={eventHref(event)} className="block">
        <div className="relative h-44 bg-slate-900 sm:h-52">
          {event.banner_url ? <img src={event.banner_url} alt={`${event.name} banner`} className="h-full w-full object-cover" /> : <div className="h-full bg-[linear-gradient(115deg,#09204a,#e95612)]" />}
          <DateBadge value={event.event_date} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-sm text-slate-500">{formatDate(event.event_date)}</p><h2 className="mt-1 text-lg font-bold text-slate-950">{event.name}</h2></div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${event.registration_availability === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{event.registration_availability.replaceAll('_', ' ')}</span>
          </div>
          <p className="text-sm text-slate-600">{event.venue ?? event.address ?? 'Location to be announced'}</p>
          <div className="flex flex-wrap gap-2">{event.distances.map((distance) => <span key={distance} className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600">{distance}K</span>)}</div>
          <div className="border-t border-slate-100 pt-3 text-center text-sm font-bold text-orange-600">View Details · Register Now →</div>
        </div>
      </Link>
    </article>
  );
}

export default async function PublicHomePage() {
  const [data, featuredEvents] = await Promise.all([
    getPublicEvents({ page: 1 }).catch(() => ({ events: [] as PublicEventCard[], featured: null, page: 1, pageSize: 12, total: 0, totalPages: 0 })),
    getFeaturedPublicEvents().catch(() => []),
  ]);
  const events = data.events.slice(0, 4);

  return (
    <main className="min-h-screen bg-[#f6f7fa] pb-14">
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <HomeHero events={featuredEvents} />
      </section>

      <section id="home-events" className="mx-auto max-w-7xl scroll-mt-6 px-4 pt-8 sm:px-6">
        <div>
          <h2 className="text-2xl font-bold text-[#09204a]">All Events</h2>
          <p className="mt-1 text-sm text-slate-600">Find your next race. Challenge yourself and enjoy the journey.</p>
        </div>
        {events.length ? (
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
            <p className="text-sm font-semibold text-slate-800">No events are published yet.</p>
            <p className="mt-1 text-sm text-slate-500">Check back soon for the next RaceDeck event.</p>
            <Link href="/events" className="mt-4 inline-block rounded-md bg-orange-600 px-4 py-2 text-sm font-bold text-white">Browse Events</Link>
          </div>
        )}
      </section>
    </main>
  );
}
