'use client';

import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type EventOption = { id: string; name: string };

export default function EventFilters({ pendingOnly, statusFilter, search, events, eventId }: { pendingOnly: boolean; statusFilter: string; search: string; events: EventOption[]; eventId: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [selectedStatus, setSelectedStatus] = useState(statusFilter);
  const [selectedEvent, setSelectedEvent] = useState(eventId);
  const [searchValue, setSearchValue] = useState(search);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setTarget(document.getElementById('admin-event-filters'));
  }, []);

  useEffect(() => {
    if (searchValue === search) return;
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, search]);

  if (!target) return null;

  return createPortal(
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <form ref={formRef} method="get" className="flex min-w-0 flex-1 flex-wrap items-center gap-2" aria-label="Event filters">
        {pendingOnly && <input type="hidden" name="review" value="pending_review" />}
        <label className="sr-only" htmlFor="event-filter">Event</label>
        <select id="event-filter" name="event" value={selectedEvent} onChange={(event) => {
          setSelectedEvent(event.target.value);
          window.requestAnimationFrame(() => formRef.current?.requestSubmit());
        }} className="h-10 w-40 min-w-40 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
          <option value="">All events</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="event-status">Event status</label>
        <select id="event-status" name="status" value={selectedStatus} onChange={(event) => {
          setSelectedStatus(event.target.value);
          window.requestAnimationFrame(() => formRef.current?.requestSubmit());
        }} className="h-10 min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
          <option value="all">All statuses</option><optgroup label="Review status"><option value="review:not_submitted">Not submitted</option><option value="review:pending_review">Awaiting review</option><option value="review:needs_changes">Needs changes</option><option value="review:approved">Approved</option><option value="review:rejected">Rejected</option></optgroup><optgroup label="Event status"><option value="lifecycle:draft">Draft</option><option value="lifecycle:published">Published</option><option value="lifecycle:ongoing">Ongoing</option><option value="lifecycle:completed">Completed</option><option value="lifecycle:cancelled">Cancelled</option><option value="lifecycle:archived">Archived</option></optgroup>
        </select>
        <label className="relative min-w-[220px] flex-1"><span className="sr-only">Search event name</span><Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input name="q" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} maxLength={100} placeholder="Search event name" className="h-10 w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
        {(search || statusFilter !== 'all' || eventId) && <Link href={pendingOnly ? '/admin/events?review=pending_review' : '/admin/events'} className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}
      </form>
    </div>,
    target,
  );
}
