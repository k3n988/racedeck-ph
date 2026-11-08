'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { effectiveRegistrationAvailability, registrationAvailabilityReason } from '@/lib/events/registration-availability';

type EventSettings = {
  name: string;
  slug: string;
  event_date: string;
  registration_availability: string;
  review_status: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  overall_capacity: number | null;
};

type FormValues = {
  registration_availability: string;
  registration_opens_at: string;
  registration_closes_at: string;
  overall_capacity: string;
};

type RegistrationSummary = {
  availability: string;
  reason: string;
  available_categories: number;
  total_categories: number;
  confirmed_category_slots: number;
  overall_capacity_reached: boolean;
};

const emptyForm: FormValues = {
  registration_availability: 'not_yet_open',
  registration_opens_at: '',
  registration_closes_at: '',
  overall_capacity: '',
};

const manilaInput = (value: string | null) => {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) : '';
};

const manilaTimestamp = (value: string) => value ? new Date(`${value}:00+08:00`).toISOString() : null;

function formValuesFor(event: EventSettings): FormValues {
  return {
    registration_availability: event.registration_availability,
    registration_opens_at: manilaInput(event.registration_opens_at),
    registration_closes_at: manilaInput(event.registration_closes_at),
    overall_capacity: event.overall_capacity == null ? '' : String(event.overall_capacity),
  };
}

export default function OrganizerEventSettingsPage({ params }: { params: { eventId: string } }) {
  const [event, setEvent] = useState<EventSettings | null>(null);
  const [registrationSummary, setRegistrationSummary] = useState<RegistrationSummary | null>(null);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [message, setMessage] = useState('Loading event settings…');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const changed = Boolean(event && (
    values.registration_availability !== event.registration_availability
    || values.registration_opens_at !== manilaInput(event.registration_opens_at)
    || values.registration_closes_at !== manilaInput(event.registration_closes_at)
    || values.overall_capacity !== (event.overall_capacity == null ? '' : String(event.overall_capacity))
  ));

  const load = useCallback(async () => {
    setError(false);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(true);
        setMessage(body.error ?? 'Event settings could not be loaded.');
        return;
      }
      setEvent(body.event);
      setRegistrationSummary(body.registration_summary ?? null);
      setValues(formValuesFor(body.event));
      setMessage('');
    } catch {
      setError(true);
      setMessage('Could not connect to RaceDeck. Check your connection and try again.');
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!changed || busy) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const confirmNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      const link = event.target.closest('a[href]');
      if (!link) return;
      if (!window.confirm('You have unsaved event settings. Leave this page and discard them?')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    document.addEventListener('click', confirmNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
      document.removeEventListener('click', confirmNavigation, true);
    };
  }, [changed, busy]);

  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!event || busy) return;
    // Read directly from the submitted form so datetime-local's segmented native
    // control cannot leave React state one edit behind when Save is pressed.
    const formData = new FormData(formEvent.currentTarget);
    const submittedValues: FormValues = {
      registration_availability: String(formData.get('registration_availability') ?? ''),
      registration_opens_at: String(formData.get('registration_opens_at') ?? ''),
      registration_closes_at: String(formData.get('registration_closes_at') ?? ''),
      overall_capacity: String(formData.get('overall_capacity') ?? ''),
    };
    setValues(submittedValues);
    setBusy(true);
    setError(false);
    setMessage('Saving event settings…');

    try {
      if (Boolean(submittedValues.registration_opens_at) !== Boolean(submittedValues.registration_closes_at)) {
        setError(true);
        setMessage('Enter both the registration opening and closing dates, or leave both blank to manage availability manually.');
        return;
      }
      const capacity = submittedValues.overall_capacity.trim() ? Number(submittedValues.overall_capacity) : null;
      if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
        setError(true);
        setMessage('Overall capacity must be a positive whole number.');
        return;
      }
      if (submittedValues.registration_opens_at && submittedValues.registration_closes_at) {
        const opensAt = Date.parse(`${submittedValues.registration_opens_at}:00+08:00`);
        const closesAt = Date.parse(`${submittedValues.registration_closes_at}:00+08:00`);
        const eventEnd = Date.parse(`${event.event_date}T00:00:00+08:00`) + 24 * 60 * 60 * 1000;
        if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt)) {
          setError(true);
          setMessage('Enter valid registration opening and closing dates.');
          return;
        }
        if (opensAt >= closesAt) {
          setError(true);
          setMessage('Registration must close after it opens.');
          return;
        }
        if (closesAt > eventEnd) {
          setError(true);
          setMessage('Registration must close no later than the end of the event date (Philippine time).');
          return;
        }
      }
      const payload: Record<string, string | number | null> = {
        registration_availability: submittedValues.registration_availability,
        overall_capacity: capacity,
        registration_opens_at: manilaTimestamp(submittedValues.registration_opens_at),
        registration_closes_at: manilaTimestamp(submittedValues.registration_closes_at),
      };

      const response = await fetch(`/api/organizer/events/${params.eventId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(true);
        setMessage(body.error ?? 'Event settings could not be saved. Please try again.');
        return;
      }

      // Confirm the persisted values with a fresh read; don't show a success
      // state based only on the update response.
      const verifyResponse = await fetch(`/api/organizer/events/${params.eventId}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const verifiedBody = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok || !verifiedBody.event) {
        setError(true);
        setMessage(verifiedBody.error ?? 'Settings were submitted, but the saved values could not be verified. Refresh and check again.');
        return;
      }
      const updatedEvent = verifiedBody.event as EventSettings;
      const savedValues = formValuesFor(updatedEvent);
      if (savedValues.registration_opens_at !== submittedValues.registration_opens_at
        || savedValues.registration_closes_at !== submittedValues.registration_closes_at
        || savedValues.registration_availability !== submittedValues.registration_availability
        || savedValues.overall_capacity !== (capacity === null ? '' : String(capacity))) {
        setEvent(updatedEvent);
        setValues(savedValues);
        setError(true);
        setMessage('RaceDeck returned a successful update, but the saved settings do not match your changes. Please try again.');
        return;
      }
      setEvent(updatedEvent);
      setValues(savedValues);
      setMessage('Settings saved and verified. The event list and public registration status will reflect the schedule and category availability.');
    } catch {
      setError(true);
      setMessage('Could not connect to RaceDeck. Your changes were not confirmed; try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!event) return <main className="mx-auto max-w-3xl p-6"><p role={error ? 'alert' : 'status'} className={error ? 'text-sm text-red-700' : 'text-sm text-slate-600'}>{message}</p>{error && <button type="button" onClick={() => void load()} className="mt-3 rounded-lg border px-4 py-2 text-sm font-semibold">Try again</button>}</main>;

  const locked = event.review_status === 'pending_review';
  const availability = registrationSummary?.availability ?? effectiveRegistrationAvailability(event);
  const availabilityReason = registrationSummary?.reason ?? registrationAvailabilityReason(event);
  const availabilityLabel = availability.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const availabilityTone = availability === 'open' || availability === 'closing_soon'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : availability === 'not_yet_open'
      ? 'border-blue-200 bg-blue-50 text-blue-900'
      : 'border-amber-200 bg-amber-50 text-amber-950';
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      {message && <p role={error ? 'alert' : 'status'} aria-live="polite" className={`rounded-lg border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{message}</p>}

      {locked && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Settings are locked while RaceDeck reviews this event. You can edit them after the review is complete.</p>}

      <section aria-live="polite" className={`rounded-xl border p-4 ${availabilityTone}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Participant-facing registration status</h2><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold">{availabilityLabel}</span></div>
        <p className="mt-1 text-sm leading-6">{availabilityReason}</p>
        {registrationSummary && <p className="mt-1 text-xs opacity-80">{registrationSummary.available_categories} of {registrationSummary.total_categories} categories currently have slots available.</p>}
      </section>

      <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium">Event name<input name="name" disabled value={event.name} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-slate-700" /></label>
        <label className="block text-sm font-medium">Public slug<input name="slug" disabled value={event.slug} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-slate-700" /></label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Manual registration setting
            <select name="registration_availability" value={values.registration_availability} onChange={(e) => setValues((current) => ({ ...current, registration_availability: e.target.value }))} disabled={busy || locked} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5">
              <option value="not_yet_open">Not yet open</option><option value="open">Open</option><option value="closed">Closed</option><option value="sold_out">Sold out</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Overall capacity
            <input name="overall_capacity" type="number" min="1" step="1" value={values.overall_capacity} onChange={(e) => setValues((current) => ({ ...current, overall_capacity: e.target.value }))} disabled={busy || locked} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="block text-sm font-medium">Registration opens
            <input name="registration_opens_at" type="datetime-local" value={values.registration_opens_at} onChange={(e) => setValues((current) => ({ ...current, registration_opens_at: e.target.value }))} disabled={busy || locked} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="block text-sm font-medium">Registration closes
            <input name="registration_closes_at" type="datetime-local" value={values.registration_closes_at} onChange={(e) => setValues((current) => ({ ...current, registration_closes_at: e.target.value }))} disabled={busy || locked} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
        </div>

        <p className="text-xs leading-5 text-gray-600">Dates use Philippine time. When both dates are set, the schedule determines the participant-facing status; the manual setting is used when dates are blank. Enter both dates, or leave both blank. Registration must close after it opens and no later than the event date. Closed/full categories and the event capacity can still prevent registration.</p>
        <p className="text-sm text-gray-600">Homepage featured placement is managed by RaceDeck admins.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || locked || !changed} className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Saving…' : 'Save Settings'}</button>
          {!busy && changed && !error && <span role="status" className="text-sm font-medium text-amber-800">Unsaved changes</span>}
        </div>
      </form>
    </main>
  );
}
