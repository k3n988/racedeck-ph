'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type EventCard = {
  id: string;
  name: string;
  event_date: string;
  venue: string | null;
  lifecycle_status: string;
  review_status: string;
  registration_availability: string;
  registrations_count: number;
  confirmed_count: number;
  gross_sales: number;
  capacity: number | null;
};

export default function OrganizerDashboardPage() {
  const [events, setEvents] = useState<EventCard[]>([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('Loading your events…');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage('Loading your events…');
    const response = await fetch(`/api/organizer/events?search=${encodeURIComponent(search)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? 'Events could not be loaded.');
      return;
    }
    setEvents(body.events ?? []);
    setMessage('');
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  async function createEvent() {
    const name = window.prompt('Event name');
    if (!name?.trim()) return;
    const eventDate = window.prompt('Event date (YYYY-MM-DD)');
    if (!eventDate?.trim()) return;
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setBusy(true);
    const response = await fetch('/api/organizer/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), slug, event_date: eventDate.trim() }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error ?? 'Event could not be created.');
      return;
    }
    await load();
  }

  const totalConfirmed = events.reduce((sum, event) => sum + event.confirmed_count, 0);
  const totalSales = events.reduce((sum, event) => sum + Number(event.gross_sales ?? 0), 0);

  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm text-gray-500">Organizer workspace</p><h1 className="text-3xl font-semibold">Dashboard</h1><p className="mt-1 text-sm text-gray-600">Monitor your events, registrations, and verified sales.</p></div>
      <button disabled={busy} onClick={() => void createEvent()} className="rounded bg-black px-4 py-2 text-sm text-white">{busy ? 'Creating…' : 'Create Event'}</button>
    </header>
    <section className="grid gap-4 sm:grid-cols-3"><div className="rounded border p-4"><p className="text-sm text-gray-500">Events</p><p className="mt-1 text-2xl font-semibold">{events.length}</p></div><div className="rounded border p-4"><p className="text-sm text-gray-500">Confirmed registrations</p><p className="mt-1 text-2xl font-semibold">{totalConfirmed}</p></div><div className="rounded border p-4"><p className="text-sm text-gray-500">Verified gross sales</p><p className="mt-1 text-2xl font-semibold">PHP {totalSales.toFixed(2)}</p></div></section>
    <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your events" className="w-full max-w-md rounded border p-2"/><button className="rounded border px-4 py-2 text-sm">Search</button></form>
    {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
    {!message && events.length === 0 && <p className="rounded border p-6 text-sm text-gray-600">No events yet. Create your first event to start setting it up.</p>}
    {!message && events.length > 0 && <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{events.map((event) => <Link key={event.id} href={`/organizer/events/${event.id}`} className="rounded border p-5 transition hover:border-black"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{event.name}</h2><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{event.lifecycle_status}</span></div><p className="mt-2 text-sm text-gray-600">{event.event_date} · {event.venue ?? 'Venue to be announced'}</p><p className="mt-4 text-sm">{event.confirmed_count} confirmed / {event.registrations_count} registrations</p><p className="text-sm text-gray-600">Capacity: {event.capacity ?? 'Unlimited'}</p><div className="mt-4 flex justify-between border-t pt-3 text-xs text-gray-600"><span>{event.registration_availability}</span><span>{event.review_status}</span></div></Link>)}</section>}
  </main>;
}
