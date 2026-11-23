'use client';

import { createPortal } from 'react-dom';
import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type EventOption = { id: string; name: string };

export default function DashboardFilters({
  events,
  from,
  to,
  eventId,
}: {
  events: EventOption[];
  from: string;
  to: string;
  eventId: string;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById('admin-dashboard-filters'));
  }, []);

  if (!target) return null;

  return createPortal(
    <form method="get" className="flex flex-wrap items-center justify-end gap-2" aria-label="Dashboard filters">
      <label className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-600">
        <span>From</span><CalendarDays aria-hidden="true" size={15} />
        <input aria-label="Date from" lang="en-GB" name="from" type="date" value={from} max={to || undefined} className="w-[126px] bg-transparent text-xs font-medium text-slate-800 outline-none" />
      </label>
      <label className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-600">
        <span>To</span><CalendarDays aria-hidden="true" size={15} />
        <input aria-label="Date to" lang="en-GB" name="to" type="date" value={to} min={from || undefined} className="w-[126px] bg-transparent text-xs font-medium text-slate-800 outline-none" />
      </label>
      <label className="sr-only" htmlFor="dashboard-event-filter">Event</label>
      <select id="dashboard-event-filter" name="event" defaultValue={eventId} className="h-9 w-48 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">
        <option value="">All events</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
      </select>
      {(from || to || eventId) && <Link href="/admin/dashboard" className="px-1 py-2 text-xs font-semibold text-slate-600 hover:text-orange-700">Clear</Link>}
    </form>,
    target,
  );
}
