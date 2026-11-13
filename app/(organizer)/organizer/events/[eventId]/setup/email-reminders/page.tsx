'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Setting = {
  id?: string;
  reminder_key: string;
  reminder_type: 'race_reminder' | 'race_tomorrow' | 'race_kit_claiming_deadline' | 'custom';
  lead_time_minutes: number;
  enabled: boolean;
  instructions: string | null;
  custom_schedule_at: string | null;
};

const defaults: Setting[] = [
  { reminder_key: '7_days_before', reminder_type: 'race_reminder', lead_time_minutes: 10080, enabled: true, instructions: null, custom_schedule_at: null },
  { reminder_key: '3_days_before', reminder_type: 'race_reminder', lead_time_minutes: 4320, enabled: true, instructions: null, custom_schedule_at: null },
  { reminder_key: '1_day_before', reminder_type: 'race_tomorrow', lead_time_minutes: 1440, enabled: true, instructions: null, custom_schedule_at: null },
];

const reminders = [
  { key: '7_days_before', title: 'One week before', detail: 'A heads-up with time to plan travel and prepare.' },
  { key: '3_days_before', title: 'Three days before', detail: 'A short reminder to review race-day details.' },
  { key: '1_day_before', title: 'One day before', detail: 'The final reminder before race day.' },
] as const;

const controlClass = 'mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export default function EmailRemindersPage({ params }: { params: { eventId: string } }) {
  const [settings, setSettings] = useState<Setting[]>(defaults);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/email-reminders`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Reminder settings could not be loaded.');
      const saved = Array.isArray(data.settings) ? data.settings as Setting[] : [];
      setSettings(defaults.map((item) => saved.find((value) => value.reminder_key === item.reminder_key) ?? item));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reminder settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  function update(key: string, change: Partial<Setting>) {
    setSettings((current) => current.map((item) => item.reminder_key === key ? { ...item, ...change } : item));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/email-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Reminder settings could not be saved.');
      await load();
      setMessage('Reminder settings saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reminder settings could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-6xl space-y-6 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    <header className="border-b border-slate-200 pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event setup</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Email &amp; Reminders</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Choose when confirmed participants receive race-day reminders and add event-specific instructions.</p>
    </header>

    {message && <ToastFeedback message={String(message)} tone="auto">{!loading && !busy && message.toLowerCase().includes('could not') ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div> : undefined}</ToastFeedback>}

    {loading ? <div role="status" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><span className="sr-only">Loading reminder settings…</span><div className="h-5 w-48 animate-pulse rounded bg-slate-200" /><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-24 animate-pulse rounded-xl bg-slate-100" /></div> : !message || message === 'Reminder settings saved.' ? <form onSubmit={(event) => void save(event)} className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-[#071b41]">Race reminders</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">RaceDeck sends these messages to participants with confirmed registrations.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {reminders.map((reminder) => {
            const setting = settings.find((item) => item.reminder_key === reminder.key) ?? defaults.find((item) => item.reminder_key === reminder.key)!;
            return <article key={reminder.key} className={`rounded-xl border p-4 transition ${setting.enabled ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200 bg-slate-50'}`}>
              <label className="flex min-h-14 cursor-pointer items-start gap-3">
                <input type="checkbox" checked={setting.enabled} disabled={busy} onChange={(event) => update(setting.reminder_key, { enabled: event.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-orange-600" />
                <span><span className="block font-bold text-[#071b41]">{reminder.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{reminder.detail}</span></span>
              </label>
              <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor={`instructions-${reminder.key}`}>Organizer instructions <span className="font-normal text-slate-500">(optional)</span></label>
              <textarea id={`instructions-${reminder.key}`} value={setting.instructions ?? ''} onChange={(event) => update(setting.reminder_key, { instructions: event.target.value || null })} rows={4} maxLength={4000} disabled={busy || !setting.enabled} className={controlClass} placeholder="Add pickup, parking, or arrival notes." />
              <p className="mt-1 text-right text-xs text-slate-500">{(setting.instructions ?? '').length}/4,000</p>
            </article>;
          })}
        </div>
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">RaceDeck supplies event details, registration information, security notices, legal text, and the transactional email footer.</p>
      </section>
      <div className="flex justify-end border-t border-slate-200 pt-4">
        <button disabled={busy} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-wait disabled:opacity-60">{busy ? 'Saving…' : 'Save reminder settings'}</button>
      </div>
    </form> : null}
  </main>;
}
