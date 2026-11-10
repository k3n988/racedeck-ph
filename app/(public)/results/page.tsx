import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import ResultsTable from './results-table';
import { getHomepagePublicEvents, type PublicEventCard } from '@/lib/public/events';

export const dynamic = 'force-dynamic';

function formatEventDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
  }).format(date);
}

function FinishedEventCard({ event }: { event: PublicEventCard }) {
  const location = event.venue ?? event.address ?? 'Location to be announced';

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="aspect-[16/9] overflow-hidden bg-slate-100">
        {event.banner_url
          ? <img src={event.banner_url} alt={`${event.name} event poster`} loading="lazy" className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center bg-gradient-to-br from-[#09204a] to-orange-700"><span className="text-xs font-bold uppercase tracking-[0.18em] text-white">RaceDeck PH</span></div>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="line-clamp-2 text-lg font-bold leading-tight text-[#0a234b]">{event.name}</h2>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-orange-600" />{formatEventDate(event.event_date)}</p>
        <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-slate-600"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /><span className="line-clamp-2">{location}</span></p>
        <div className="mt-auto border-t border-slate-100 pt-4">
          {event.results_available ? (
            <Link href={`/results?event=${encodeURIComponent(event.id)}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
              View Results <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-sm font-medium text-slate-500">Results have not been published yet</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function PublicResultsPage({ searchParams }: { searchParams?: { event?: string | string[] } }) {
  let events: PublicEventCard[] = [];
  let failedToLoad = false;
  try {
    const homepageData = await getHomepagePublicEvents();
    events = homepageData.events.filter((event) => event.event_period === 'past');
  } catch (error) {
    console.error('Failed to load finished events for public results:', error instanceof Error ? error.message : 'Unknown error');
    failedToLoad = true;
  }

  const requestedEventId = Array.isArray(searchParams?.event) ? searchParams.event[0] : searchParams?.event;
  const selectedEvent = events.find((event) => event.id === requestedEventId && event.results_available);

  if (selectedEvent) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/results" className="inline-flex min-h-10 items-center font-semibold text-orange-700 hover:text-orange-800">← All finished events</Link>
        <header className="mb-6 mt-5">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-600">Race Results</p>
          <h1 className="mt-1 text-3xl font-bold text-[#09204a]">{selectedEvent.name}</h1>
        </header>
        <ResultsTable initial={{ event: selectedEvent.id }} />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {failedToLoad ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Finished events could not be loaded right now. Please try again shortly.</p>
      ) : events.length ? (
        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => <FinishedEventCard key={event.id} event={event} />)}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">There are no finished events yet.</p>
      )}
    </main>
  );
}
