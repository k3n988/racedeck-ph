'use client';

import { useCallback, useEffect, useState } from 'react';

type EventSettings = { name: string; slug: string; registration_availability: string; lifecycle_status: string; review_status: string; registration_opens_at: string | null; registration_closes_at: string | null; overall_capacity: number | null; is_featured: boolean };
const manilaInput = (value: string | null) => { const timestamp = value ? Date.parse(value) : NaN; return Number.isFinite(timestamp) ? new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) : ''; };
const manilaTimestamp = (value: FormDataEntryValue | undefined) => typeof value === 'string' && value ? `${value}:00+08:00` : null;

export default function OrganizerEventSettingsPage({ params }: { params: { eventId: string } }) {
  const [event, setEvent] = useState<EventSettings | null>(null);
  const [message, setMessage] = useState('Loading event settings…');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/organizer/events/${params.eventId}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? 'Event settings could not be loaded.'); return; }
    setEvent(body.event);
    setMessage('');
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  async function save(form: HTMLFormElement) {
    setBusy(true);
    const values = Object.fromEntries(new FormData(form).entries());
    const response = await fetch(`/api/organizer/events/${params.eventId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registration_availability: values.registration_availability, registration_opens_at: manilaTimestamp(values.registration_opens_at), registration_closes_at: manilaTimestamp(values.registration_closes_at), overall_capacity: values.overall_capacity ? Number(values.overall_capacity) : null }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? 'Event settings saved.' : body.error ?? 'Event settings could not be saved.');
    if (response.ok) setEvent(body.event);
  }

  if (!event) return <main className="p-6"><p role="status">{message}</p></main>;
  const locked = event.lifecycle_status === 'draft' && ['pending_review', 'approved'].includes(event.review_status);
  return <main className="mx-auto max-w-3xl space-y-6 p-6"><header><p className="text-sm text-gray-500">Event configuration</p><h1 className="text-2xl font-semibold">Settings</h1><p className="text-sm text-gray-600">Control registration availability and public event visibility.</p></header>{message && <p role="status" className="text-sm">{message}</p>}<section className="rounded border p-5"><div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-gray-500">Lifecycle</p><p className="font-medium">{event.lifecycle_status}</p></div><div><p className="text-gray-500">Review</p><p className="font-medium">{event.review_status}</p></div><div><p className="text-gray-500">Public featured</p><p className="font-medium">{event.is_featured ? 'Yes' : 'No'}</p></div></div></section>{locked && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">Settings are locked while this draft is under review or approved.</p>}<form onSubmit={(formEvent) => { formEvent.preventDefault(); void save(formEvent.currentTarget); }} className="space-y-4 rounded border p-5"><label className="block text-sm">Event name<input name="name" disabled defaultValue={event.name} className="mt-1 w-full rounded border p-2" /></label><label className="block text-sm">Public slug<input name="slug" disabled defaultValue={event.slug} className="mt-1 w-full rounded border p-2" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Registration availability<select name="registration_availability" defaultValue={event.registration_availability} className="mt-1 w-full rounded border p-2"><option value="not_yet_open">Not yet open</option><option value="open">Open</option><option value="closed">Closed</option><option value="sold_out">Sold out</option></select></label><label className="block text-sm">Overall capacity<input name="overall_capacity" type="number" min="1" defaultValue={event.overall_capacity ?? ''} className="mt-1 w-full rounded border p-2" /></label><label className="block text-sm">Registration opens<input name="registration_opens_at" type="datetime-local" defaultValue={manilaInput(event.registration_opens_at)} className="mt-1 w-full rounded border p-2" /></label><label className="block text-sm">Registration closes<input name="registration_closes_at" type="datetime-local" defaultValue={manilaInput(event.registration_closes_at)} className="mt-1 w-full rounded border p-2" /></label></div><p className="text-sm text-gray-600">Featured placement is managed by RaceDeck admins.</p><button disabled={busy || locked} className="rounded bg-black px-4 py-2 text-sm text-white">{busy ? 'Saving…' : 'Save Settings'}</button></form></main>;
}
