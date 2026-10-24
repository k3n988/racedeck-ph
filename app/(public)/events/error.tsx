'use client';

export default function EventsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main role="alert" className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">RaceDeck PH</p>
        <h1 className="mt-3 text-2xl font-bold text-[#0a234b]">We couldn’t load events</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Please try again. Your event search will be ready as soon as the service is available.</p>
        <button type="button" onClick={() => reset()} className="mt-5 min-h-11 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">Try again</button>
      </div>
    </main>
  );
}
