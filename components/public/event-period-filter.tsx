'use client';

type EventPeriod = 'all' | 'upcoming' | 'past';

export function EventPeriodFilter({ period }: { period: EventPeriod }) {
  return (
    <form method="get" className="flex items-center gap-3">
      <label htmlFor="event-period" className="text-sm font-semibold text-slate-700">
        Show
      </label>
      <select
        id="event-period"
        name="period"
        defaultValue={period}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      >
        <option value="all">All Events</option>
        <option value="upcoming">Upcoming Events</option>
        <option value="past">Past Events</option>
      </select>
    </form>
  );
}
