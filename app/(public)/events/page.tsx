import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { HomeHero } from '@/components/public/home-hero';
import { getHomepagePublicEvents, getPublicEvents, type PublicEventCard } from '@/lib/public/events';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const FILTER_KEYS = ['search', 'location', 'date', 'distance', 'status', 'sort', 'period'];

function periodHref(period: string, values: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) if (key !== 'period' && values[key]) query.set(key, values[key]!);
  query.set('period', period);
  return `/events?${query}#all-events`;
}

function displayDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00+08:00`);
  return Number.isNaN(date.getTime())
    ? 'Date to be announced'
    : new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
}

function EventCard({ event }: { event: PublicEventCard }) {
  const status = event.registration_availability;
  const statusStyle = status === 'open'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : status === 'closing_soon'
      ? 'bg-orange-50 text-orange-700 ring-orange-200'
      : status === 'sold_out'
        ? 'bg-slate-100 text-slate-600 ring-slate-200'
        : 'bg-slate-100 text-slate-600 ring-slate-200';
  const statusText = status === 'closing_soon'
    ? 'Closing Soon'
    : status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const location = event.venue ?? event.address ?? 'Location to be announced';
  const distances = Array.from(new Set(event.distances));

  return (
    <article className="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2">
      <Link href={`/events/${event.slug}`} className="flex h-full flex-col rounded-2xl focus:outline-none">
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#071b41] via-[#163c70] to-orange-600">
          {event.banner_url ? (
            <img src={event.banner_url} alt={`${event.name} event poster`} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full items-end bg-[radial-gradient(circle_at_82%_20%,rgba(249,115,22,.5),transparent_28%),linear-gradient(130deg,#071b41,#163c70_70%,#a9441b)] p-5">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-orange-200">RaceDeck PH</span>
            </div>
          )}
          <span className={`absolute right-3 top-3 inline-flex rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${statusStyle}`}>{statusText}</span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-lg font-bold leading-snug text-[#0a234b] transition group-hover:text-orange-700">{event.name}</h3>
            <span className="shrink-0 rounded-xl bg-orange-50 px-2.5 py-1.5 text-center text-xs font-bold text-orange-700 ring-1 ring-inset ring-orange-100">
              {displayDate(event.event_date)}
            </span>
          </div>
          <p className="mt-3 flex items-start gap-2 text-sm leading-5 text-slate-600">
            <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <span className="line-clamp-2">{location}</span>
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">{event.organizer?.name ?? 'RaceDeck event'}</p>
          <div className="mt-4 flex min-h-7 flex-wrap gap-2">
            {distances.length ? distances.map((distance) => (
              <span key={distance} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{distance}K</span>
            )) : <span className="text-xs text-slate-500">Race categories to be announced</span>}
          </div>
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className="text-sm font-bold text-[#0a234b]">{event.starting_registration_fee !== null ? `From ₱${event.starting_registration_fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'View event details'}</span>
            <span className="inline-flex items-center rounded-lg bg-orange-600 px-3.5 py-2.5 text-sm font-bold text-white transition group-hover:bg-orange-700">View Details <span aria-hidden="true" className="ml-1">→</span></span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function PeriodTabs({ period, values }: { period: string; values: Record<string, string | undefined> }) {
  const tabs = [
    { value: 'upcoming', label: 'Upcoming Events' },
    { value: 'past', label: 'Past Events' },
    { value: 'all', label: 'All Events' },
  ];
  return (
    <nav aria-label="Event periods" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map((tab) => (
        <Link key={tab.value} href={periodHref(tab.value, values)} aria-current={period === tab.value ? 'page' : undefined} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition sm:px-4 ${period === tab.value ? 'bg-[#0a2957] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-[#0a2957]'}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const periodValue = get('period');
  const period = periodValue === 'past' || periodValue === 'upcoming' ? periodValue : 'all';
  const page = Number(get('page') ?? '1');
  const values = Object.fromEntries(FILTER_KEYS.map((key) => [key, get(key)])) as Record<string, string | undefined>;
  let eventsUnavailable = false;
  const [data, homepageData] = await Promise.all([
    getPublicEvents({
      search: values.search,
      location: values.location,
      date: values.date,
      distance: values.distance,
      status: values.status,
      sort: values.sort,
      period,
      page: Number.isFinite(page) ? page : 1,
    }).catch(() => {
      eventsUnavailable = true;
      return { events: [] as PublicEventCard[], featured: null, page: 1, pageSize: 12, total: 0, totalPages: 0 };
    }),
    getHomepagePublicEvents().catch((error) => {
      console.error('Failed to load public event banner:', error instanceof Error ? error.message : 'Unknown error');
      return { events: [], carouselEvents: [] };
    }),
  ]);
  const activeFilters = FILTER_KEYS.some((key) => key !== 'period' && key !== 'sort' && Boolean(values[key]));
  const clearHref = `/events?period=${period}#all-events`;
  const paginationHref = (next: number) => {
    const query = new URLSearchParams();
    for (const key of FILTER_KEYS) if (values[key]) query.set(key, values[key]!);
    query.set('page', String(next));
    return `/events?${query}#all-events`;
  };
  return (
    <main className="events-discovery mx-auto max-w-7xl space-y-8 px-4 pb-14 pt-2 sm:px-6">
      <HomeHero events={homepageData.carouselEvents} browseHref="#all-events" />

      {eventsUnavailable && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Events are temporarily unavailable. Please try again later.</p>}

      <section id="all-events" aria-labelledby="events-heading" className="scroll-mt-24 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="events-heading" className="text-2xl font-bold tracking-tight text-[#0a234b] sm:text-3xl">Explore {period === 'past' ? 'Past' : period === 'upcoming' ? 'Upcoming' : 'All'} Events</h2>
            <p className="mt-1 text-sm text-slate-600">Find your next race. Challenge yourself and enjoy the journey.</p>
          </div>
          <PeriodTabs period={period} values={values} />
        </div>

        {data.events.length ? (
          <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {data.events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        ) : !eventsUnavailable ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-9 text-center shadow-sm sm:py-11">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-600"><CalendarDays aria-hidden="true" className="h-6 w-6" /></span>
            <h3 className="mt-4 text-lg font-bold text-[#0a234b]">{activeFilters ? 'No matching events found' : period === 'past' ? 'No past events yet' : 'No upcoming events yet'}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600">{activeFilters ? 'Try changing your search or filters to find a race.' : 'New races are coming soon. Check back for upcoming events on RaceDeck PH.'}</p>
            {activeFilters && <Link href={clearHref} className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500">Clear filters</Link>}
          </div>
        ) : null}

        {data.totalPages > 1 && <nav aria-label="Event pages" className="flex items-center justify-center gap-3 pt-2 text-sm font-semibold">
          {data.page > 1 && <Link href={paginationHref(data.page - 1)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-700 hover:bg-slate-50">Previous</Link>}
          <span className="text-slate-500">Page {data.page} of {data.totalPages}</span>
          {data.page < data.totalPages && <Link href={paginationHref(data.page + 1)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-700 hover:bg-slate-50">Next</Link>}
        </nav>}
      </section>
    </main>
  );
}
