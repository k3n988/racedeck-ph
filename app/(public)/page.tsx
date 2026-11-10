import { HomeHero } from '@/components/public/home-hero';
import { HomeEventsListing } from '@/components/public/home-events-listing';
import { getHomepagePublicEvents, type HomepagePublicEventsResult } from '@/lib/public/events';

export const dynamic = 'force-dynamic';

export default async function PublicHomePage({ searchParams }: { searchParams?: { eventPeriod?: string } }) {
  const requestedPeriod = searchParams?.eventPeriod;
  const eventPeriod = requestedPeriod === 'upcoming' || requestedPeriod === 'past' ? requestedPeriod : 'all';
  let homepageData: HomepagePublicEventsResult;
  try {
    homepageData = { ...(await getHomepagePublicEvents()), error: false };
  } catch (error) {
    console.error('Failed to load public homepage events:', error instanceof Error ? error.message : 'Unknown error');
    homepageData = { events: [], carouselEvents: [], error: true };
  }
  const visibleEvents = eventPeriod === 'all'
    ? homepageData.events
    : homepageData.events.filter((event) => event.event_period === eventPeriod);
  const listingData = { ...homepageData, events: visibleEvents };
  const eventHeading = eventPeriod === 'upcoming' ? 'Upcoming Events' : eventPeriod === 'past' ? 'Past Events' : 'All Events';

  return (
    <main className="min-h-screen bg-[#f6f7fa] pb-14">
      <section className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
        <HomeHero events={homepageData.carouselEvents} />
      </section>

      <section id="home-events" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-8 sm:px-6">
        <div>
          <h2 className="text-2xl font-bold text-[#09204a]">{eventHeading}</h2>
          <p className="mt-1 text-sm text-slate-600">Find your next race. Challenge yourself and enjoy the journey.</p>
        </div>
        <div className="mt-5">
          <HomeEventsListing homepageData={listingData} />
        </div>
      </section>
    </main>
  );
}
