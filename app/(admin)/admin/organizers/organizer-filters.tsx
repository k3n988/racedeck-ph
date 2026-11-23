'use client';

import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const STATUSES = ['all', 'pending_review', 'needs_changes', 'approved', 'rejected', 'draft'] as const;
type EventOption = { id: string; name: string };

export default function OrganizerFilters({ status, search, events, eventId }: { status: string; search: string; events: EventOption[]; eventId: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [selectedEvent, setSelectedEvent] = useState(eventId);
  const [searchValue, setSearchValue] = useState(search);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setTarget(document.getElementById('admin-organizer-filters'));
  }, []);

  useEffect(() => {
    if (searchValue === search) return;
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, search]);

  if (!target) return null;

  return createPortal(
    <form ref={formRef} method="get" className="flex min-w-0 flex-wrap items-center justify-end gap-2" aria-label="Organizer filters">
      <label className="sr-only" htmlFor="organizer-verification-status">Verification status</label>
      <select id="organizer-verification-status" name="status" value={selectedStatus} onChange={(event) => {
        setSelectedStatus(event.target.value);
        window.requestAnimationFrame(() => formRef.current?.requestSubmit());
      }} className="h-10 w-36 min-w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
        {STATUSES.map((value) => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value.replaceAll('_', ' ')}</option>)}
      </select>
      <label className="sr-only" htmlFor="organizer-event-filter">Event</label>
      <select id="organizer-event-filter" name="event" value={selectedEvent} onChange={(event) => {
        setSelectedEvent(event.target.value);
        window.requestAnimationFrame(() => formRef.current?.requestSubmit());
      }} className="h-10 w-40 min-w-40 max-w-40 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
        <option value="">All events</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
      </select>
      <label className="relative min-w-[220px] flex-1 lg:w-[340px] lg:flex-none">
        <span className="sr-only">Search organization name or contact email</span>
        <Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" />
        <input name="q" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} maxLength={100} placeholder="Search organization or contact email" className="h-10 w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
      </label>
      {(search || status !== 'all' || eventId) && <Link href="/admin/organizers" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}
    </form>,
    target,
  );
}
