'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Event = { id: string; name: string; event_date: string; lifecycle_status: string; review_status: string; registration_availability: string; overall_capacity: number | null; review_feedback: string | null };
type Overview = { total_registrations: number; confirmed_registrations: number; gross_sales: number; recent_registrations: Array<{ id: string; status: string }>; recent_payments: Array<{ amount_paid: number; status: string }> };

const sections = (id: string) => [
  { label: 'Overview', href: `/organizer/events/${id}` },
  { label: 'Event Details', href: `/organizer/events/${id}/setup/details` },
  { label: 'Categories & Pricing', href: `/organizer/events/${id}/setup/categories-pricing` },
  { label: 'Registration Form', href: `/organizer/events/${id}/setup/registration-form` },
  { label: 'Waiver', href: `/organizer/events/${id}/setup/waiver` },
  { label: 'Race Kit', href: `/organizer/events/${id}/setup/race-kit-config` },
  { label: 'Registrations', href: `/organizer/events/${id}/registrations` },
  { label: 'Bib Management', href: `/organizer/events/${id}/bib-management` },
  { label: 'Kit Claiming', href: `/organizer/events/${id}/race-kit-claiming` },
  { label: 'Announcements', href: `/organizer/events/${id}/announcements` },
  { label: 'Results', href: `/organizer/events/${id}/results` },
  { label: 'Reports', href: `/organizer/events/${id}/reports` },
  { label: 'Settings', href: `/organizer/events/${id}/settings` },
];

export default function OrganizerEventWorkspace({ params }: { params: { eventId: string } }) {
  const pathname = usePathname();
  const [event, setEvent] = useState<Event | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState('Loading workspace…');

  useEffect(() => {
    void fetch(`/api/organizer/events/${params.eventId}`).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Event could not be loaded.');
      setEvent(body.event);
      setOverview(body.overview);
      setMessage('');
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'Event could not be loaded.'));
  }, [params.eventId]);

  if (!event) return <main className="mx-auto max-w-7xl p-6"><Link href="/organizer/events" className="text-sm font-semibold text-orange-600">← Back to events</Link><p role="status" className="mt-6 rounded border p-5 text-sm text-gray-600">{message}</p></main>;

  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/organizer/events" className="text-sm font-semibold text-orange-600 hover:text-orange-700">← All events</Link><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">{event.lifecycle_status}</span></div>
    <header><h1 className="text-3xl font-semibold">{event.name}</h1><p className="mt-2 text-gray-600">{event.event_date} · Registration: {event.registration_availability} · Review: {event.review_status}</p></header>
    <nav aria-label="Event workspace" className="rounded border bg-white p-2"><div className="flex gap-2 overflow-x-auto">{sections(params.eventId).map((item) => { const active = pathname === item.href; return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`whitespace-nowrap rounded px-3 py-2 text-sm font-medium ${active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{item.label}</Link>; })}</div></nav>
    {event.review_feedback && <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Admin review feedback: {event.review_feedback}</p>}
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded border p-4"><p className="text-sm text-gray-600">Registration status</p><p className="mt-1 font-semibold">{event.registration_availability}</p></div><div className="rounded border p-4"><p className="text-sm text-gray-600">Registrations</p><p className="mt-1 font-semibold">{overview?.confirmed_registrations ?? 0} confirmed / {overview?.total_registrations ?? 0} total</p></div><div className="rounded border p-4"><p className="text-sm text-gray-600">Capacity</p><p className="mt-1 font-semibold">{event.overall_capacity ?? 'Unlimited'}</p></div><div className="rounded border p-4"><p className="text-sm text-gray-600">Gross sales</p><p className="mt-1 font-semibold">PHP {(overview?.gross_sales ?? 0).toFixed(2)}</p></div></section>
    <section className="rounded border p-6"><h2 className="text-xl font-semibold">Event Workspace</h2><p className="mt-2 text-sm text-gray-600">Choose a workspace section above to configure the event, manage participants, operate race day, and review event performance.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sections(params.eventId).slice(1, 7).map((item) => <Link key={item.href} href={item.href} className="rounded border p-4 text-sm font-semibold hover:border-black">{item.label}<span className="mt-1 block text-xs font-normal text-gray-500">Open section →</span></Link>)}</div></section>
  </main>;
}
