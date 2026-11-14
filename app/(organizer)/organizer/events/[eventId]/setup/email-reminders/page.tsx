'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { reminderHtmlToPlainText, reminderTextToHtml, sanitizeReminderHtml } from '@/lib/email/reminder-content';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type ReminderSetting = {
  id: string;
  reminder_key: string;
  lead_time_minutes: number;
  enabled: boolean;
  email_subject: string;
  email_body: string;
  email_body_format: 'text' | 'html';
  dispatched_at: string | null;
};

const choices = [
  { minutes: 10080, title: 'One week before', detail: 'Give participants time to plan and prepare.' },
  { minutes: 4320, title: 'Three days before', detail: 'A reminder closer to race day.' },
  { minutes: 1440, title: 'One day before', detail: 'A final reminder before the event.' },
] as const;

const fieldClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

function scheduleDate(eventDate: string, minutes: number) {
  if (!eventDate) return null;
  const date = new Date(new Date(`${eventDate}T00:00:00+08:00`).getTime() - minutes * 60_000);
  return Number.isFinite(date.getTime()) ? date : null;
}

function manilaDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(date);
}

export default function EmailRemindersPage({ params }: { params: { eventId: string } }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventName, setEventName] = useState('your event');
  const [minutes, setMinutes] = useState<number>(10080);
  const [enabled, setEnabled] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [bodyFormat, setBodyFormat] = useState<'text' | 'html'>('text');
  const [dispatchedAt, setDispatchedAt] = useState<string | null>(null);
  const announcementEditorRef = useRef<HTMLDivElement>(null);
  const pendingEditorContentRef = useRef({ body: '', format: 'text' as 'text' | 'html' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/email-reminders`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Reminder settings could not be loaded.');
      const saved = data.setting as ReminderSetting | null;
      const name = typeof data.event_name === 'string' ? data.event_name : 'your event';
      setEventName(name);
      setEventDate(typeof data.event_date === 'string' ? data.event_date : '');
      setMinutes(saved?.lead_time_minutes ?? 10080);
      setEnabled(saved?.enabled ?? false);
      setSubject(saved?.email_subject ?? `Reminder: ${name}`);
      const announcement = saved?.email_body ?? `This is a reminder that ${name} is coming up. Please review your registration for event details.`;
      const announcementFormat = saved?.email_body_format ?? 'text';
      setBody(announcement);
      setBodyFormat(announcementFormat);
      pendingEditorContentRef.current = { body: announcement, format: announcementFormat };
      setDispatchedAt(saved?.dispatched_at ?? null);
      setLoadFailed(false);
      setError(false);
      setMessage('');
    } catch (loadError) {
      setLoadFailed(true);
      setError(true);
      setMessage(loadError instanceof Error ? loadError.message : 'Reminder settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (loading || !announcementEditorRef.current) return;
    const pending = pendingEditorContentRef.current;
    announcementEditorRef.current.innerHTML = pending.format === 'html'
      ? sanitizeReminderHtml(pending.body)
      : reminderTextToHtml(pending.body);
  }, [loading]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/email-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_time_minutes: minutes, enabled, email_subject: subject, email_body: body, email_body_format: bodyFormat }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Reminder could not be saved.');
      const saved = data.setting as ReminderSetting;
      setBody(saved.email_body);
      setBodyFormat(saved.email_body_format);
      setDispatchedAt(saved.dispatched_at);
      setMessage(enabled ? 'One-time email reminder scheduled.' : 'Reminder announcement saved. Sending is turned off.');
    } catch (saveError) {
      setError(true);
      setMessage(saveError instanceof Error ? saveError.message : 'Reminder could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const locked = Boolean(dispatchedAt);
  const activeChoices = choices.filter((choice) => {
    const at = scheduleDate(eventDate, choice.minutes);
    return Boolean(at && at.getTime() > Date.now());
  });
  const selectedAt = scheduleDate(eventDate, minutes);
  const isUpcoming = Boolean(selectedAt && selectedAt.getTime() > Date.now());
  const bodyText = bodyFormat === 'html' ? reminderHtmlToPlainText(body) : body;

  return <main className="mx-auto max-w-6xl space-y-5 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    {message && <ToastFeedback message={message} tone={error ? 'error' : 'auto'}>{error && !loading && !busy && <div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div>}</ToastFeedback>}
    {loading ? <div role="status" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><span className="sr-only">Loading email reminder settings</span><div className="h-5 w-48 animate-pulse rounded bg-slate-200" /><div className="h-24 animate-pulse rounded-xl bg-slate-100" /></div> : !loadFailed ? <form onSubmit={(event) => void save(event)} className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold text-[#071b41]">Participant email reminder</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Schedule one email for confirmed participants. Choose one send time and write the subject and announcement.</p></div>
          {dispatchedAt && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Queued once · {manilaDateTime(new Date(dispatchedAt))}</span>}
        </div>

        {locked ? <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">This event reminder has already been queued once and cannot be edited or sent again.</div> : <>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={busy} className="mt-1 h-4 w-4 accent-orange-600" />
            <span><span className="block font-semibold text-[#071b41]">Send one reminder email</span><span className="mt-1 block text-sm text-slate-600">When enabled, RaceDeck queues it once at the selected time for each confirmed participant.</span></span>
          </label>

          <fieldset className="mt-5" disabled={busy || locked}>
            <legend className="text-sm font-semibold text-slate-800">When should it be sent?</legend>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {choices.map((choice) => {
                const at = scheduleDate(eventDate, choice.minutes);
                const available = Boolean(at && at.getTime() > Date.now());
                return <label key={choice.minutes} className={`rounded-xl border p-4 transition ${minutes === choice.minutes ? 'border-orange-300 bg-orange-50/60' : 'border-slate-200'} ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                  <span className="flex items-start gap-3"><input type="radio" name="reminder-time" value={choice.minutes} checked={minutes === choice.minutes} onChange={() => setMinutes(choice.minutes)} disabled={!available} className="mt-1 h-4 w-4 accent-orange-600" /><span className="min-w-0"><span className="block font-bold text-[#071b41]">{choice.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{choice.detail}</span>{at && <span className="mt-2 block text-xs font-semibold text-slate-500">{manilaDateTime(at)} · Manila time</span>}</span></span>
                </label>;
              })}
            </div>
            {enabled && !activeChoices.length && <p role="alert" className="mt-3 text-sm text-amber-700">All reminder times have passed for {eventName}. You can still save the announcement, but this reminder cannot be scheduled.</p>}
          </fieldset>

          <div className="mt-5 grid gap-4">
            <label className="block text-sm font-semibold text-slate-800">Email subject<input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} disabled={busy || locked} className={fieldClass} placeholder={`Reminder: ${eventName}`} /></label>
            <div>
              <span className="block text-sm font-semibold text-slate-800">Announcement</span>
              <p id="announcement-format-help" className="mt-1 text-xs text-slate-500">Regular text by default. Select text and press Ctrl+B to bold.</p>
              <div
                ref={announcementEditorRef}
                role="textbox"
                aria-label="Announcement"
                aria-describedby="announcement-format-help"
                aria-multiline="true"
                contentEditable={!busy && !locked}
                suppressContentEditableWarning
                onInput={(event) => { setBody(event.currentTarget.innerHTML); setBodyFormat('html'); }}
                onPaste={(event) => {
                  event.preventDefault();
                  const pastedText = event.clipboardData.getData('text/plain');
                  document.execCommand('insertText', false, pastedText);
                }}
                className={`${fieldClass} min-h-40 whitespace-pre-wrap leading-6`}
              />
              <span className={`mt-1 block text-right text-xs font-normal ${bodyText.length > 4000 ? 'text-red-700' : 'text-slate-500'}`}>{bodyText.length}/4,000</span>
            </div>
          </div>
        </>}

        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">Sent to confirmed participants through RaceDeck’s configured email provider. The email includes your subject and announcement.</p>
      </section>
      {!locked && <div className="flex justify-end border-t border-slate-200 pt-4"><button disabled={busy || (enabled && !isUpcoming) || bodyText.length > 4000 || !bodyText.trim()} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Saving…' : 'Save reminder'}</button></div>}
    </form> : null}
  </main>;
}
