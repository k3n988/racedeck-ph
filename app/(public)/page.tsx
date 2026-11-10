import { HomeEventsListing } from '@/components/public/home-events-listing';
import { getHomepagePublicEvents, type HomepagePublicEventsResult } from '@/lib/public/events';

export const dynamic = 'force-dynamic';

export default async function PublicHomePage() {
  let homepageData: HomepagePublicEventsResult;
  try {
    homepageData = { ...(await getHomepagePublicEvents()), error: false };
  } catch (error) {
    console.error('Failed to load public homepage events:', error instanceof Error ? error.message : 'Unknown error');
    homepageData = { events: [], carouselEvents: [], error: true };
  }
  return (
    <main className="min-h-screen bg-[#f6f7fa] pb-14">
      <section id="home-events" className="w-full scroll-mt-24 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          <div>
            <HomeEventsListing homepageData={homepageData} />
          </div>
        </div>
      </section>
    </main>
  );
}
