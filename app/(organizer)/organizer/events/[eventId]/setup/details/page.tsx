'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Globe2, ImageIcon, Save, ShieldCheck } from 'lucide-react';
import { ContentEditor } from '@/components/organizer/content-editor';
import { OptionalEventLinks } from '@/components/organizer/optional-event-links';
import { type EventSocialLinks, type OptionalEventLinkPlatform } from '@/lib/events/event-social-links';
import { BannerFrameEditor, type BannerFrame } from '@/components/organizer/banner-frame-editor';
import { PartnersManager } from '../partners-manager';

type Event = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  venue: string | null;
  address: string | null;
  banner_url: string | null;
  banner_position_x: number | null;
  banner_position_y: number | null;
  banner_zoom: number | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  assembly_time: string | null;
  gun_start_time: string | null;
  cutoff_time: string | null;
  overall_capacity: number | null;
  lifecycle_status: string;
  registration_availability: string;
  review_status: string;
  review_feedback: string | null;
  social_links: EventSocialLinks | null;
};

const controlClass = 'mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

function localDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function timeValue(value: string | null) {
  return value?.slice(0, 5) ?? '';
}

function Field({ label, name, defaultValue, disabled = false, type = 'text', hint, required = false, min }: {
  label: string;
  name: string;
  defaultValue: string | number | null;
  disabled?: boolean;
  type?: string;
  hint?: string;
  required?: boolean;
  min?: number;
}) {
  return <label className="block text-sm font-semibold text-slate-700">
    {label}{required && <span className="ml-1 text-orange-600" aria-hidden="true">*</span>}
    <input name={name} type={type} required={required} disabled={disabled} min={min} defaultValue={defaultValue ?? ''} className={controlClass} />
    {hint && <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">{hint}</span>}
  </label>;
}

function Section({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof CalendarDays; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="mb-5 flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600"><Icon size={19} aria-hidden="true" /></span>
      <div><h2 className="font-bold text-[#071b41]">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
    </div>
    {children}
  </section>;
}

export default function EventDetailsSetup({ params }: { params: { eventId: string } }) {
  const [event, setEvent] = useState<Event | null>(null);
  const [message, setMessage] = useState('Loading event details…');
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [description, setDescription] = useState('');
  const [optionalLinks, setOptionalLinks] = useState<Partial<Record<OptionalEventLinkPlatform, string>>>({});
  const [bannerFrame, setBannerFrame] = useState<BannerFrame>({ x: 50, y: 50, zoom: 1 });

  const load = useCallback(async () => {
    setMessage('Loading event details…');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Event could not be loaded.');
      setEvent(body.event);
      setPreviewUrl(body.event.banner_url ?? '');
      setBannerFrame({ x: body.event.banner_position_x ?? 50, y: body.event.banner_position_y ?? 50, zoom: body.event.banner_zoom ?? 1 });
      setDescription(body.event.description ?? '');
      setOptionalLinks(Object.fromEntries((['phone', 'website', 'instagram', 'tiktok', 'youtube', 'x'] as const).filter((key) => body.event.social_links?.[key]).map((key) => [key, body.event.social_links[key]])));
      setPreviewFailed(false);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Event could not be loaded.');
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  const profileLocked = Boolean(event?.review_status === 'pending_review');
  const profileEditable = Boolean(event && !profileLocked);
  const operationsEditable = profileEditable;
  const anyEditable = profileEditable || operationsEditable;

  async function save(form: HTMLFormElement) {
    setBusy(true);
    setMessage('');
    const values: Record<string, unknown> = Object.fromEntries(new FormData(form).entries());
    values.banner_position_x = bannerFrame.x;
    values.banner_position_y = bannerFrame.y;
    values.banner_zoom = bannerFrame.zoom;
    if (profileEditable) {
      values.social_links = {
        facebook: typeof values.facebook === 'string' ? values.facebook : '',
        ...optionalLinks,
      };
      delete values.facebook;
    }
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Event changes could not be saved.');
      setEvent((current) => current ? { ...current, ...result.event } : result.event);
      setPreviewUrl(result.event.banner_url ?? '');
      setBannerFrame({ x: result.event.banner_position_x ?? bannerFrame.x, y: result.event.banner_position_y ?? bannerFrame.y, zoom: result.event.banner_zoom ?? bannerFrame.zoom });
      setDescription(result.event.description ?? '');
      setPreviewFailed(false);
      setMessage('Event details saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Event changes could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(event.currentTarget);
  }

  if (!event) return <main className="mx-auto max-w-5xl p-5 sm:p-8">
    {message.startsWith('Loading') ? <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">{message}</div> : <ToastFeedback message={String(message)} tone="auto"><div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div></ToastFeedback>}
  </main>;

  const reviewLabel = event.review_status.replaceAll('_', ' ');
  return <main className="mx-auto max-w-5xl space-y-5 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <span className="font-semibold text-slate-700">Review status</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">{reviewLabel}</span>
      <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden="true" />
      <span className="text-slate-500">Event URL</span>
      <span className="max-w-full truncate font-medium text-[#0b2a59]">/events/{event.slug}</span>
    </div>

    {event.review_feedback && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="font-bold">RaceDeck review feedback</h2><p className="mt-1 whitespace-pre-wrap">{event.review_feedback}</p></section>}
    {profileLocked && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><p className="font-bold">Editing is paused during review</p><p className="mt-1">RaceDeck is reviewing the current version. Editing will be available again when the review is complete.</p></div>}
    {event.lifecycle_status !== 'draft' && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><p className="font-bold">Live event updates</p><p className="mt-1">Changes saved here update the public event page right away. Please notify registered participants when a change affects their plans.</p></div>}

    {message && <ToastFeedback message={String(message)} tone="auto" />}

    <form onSubmit={submit} className="space-y-4">
      <Section title="Public event information" description="Name, URL, and description displayed on the public event page." icon={ImageIcon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event name" name="name" defaultValue={event.name} disabled={!profileEditable} required />
          <Field label="Event URL slug" name="slug" defaultValue={event.slug} disabled={!profileEditable} required hint="Use lowercase letters, numbers, and hyphens." />
          <div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold text-slate-700">Event description</label><ContentEditor value={description} onChange={setDescription} editorLabel="Event description" placeholder="Tell participants what to expect at your event." editable={profileEditable} /><input type="hidden" name="description" value={description} disabled={!profileEditable} /></div>
        </div>
      </Section>

      <Section title="Contact links" description="Add the required Facebook page and any optional contact links." icon={Globe2}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Facebook page URL" name="facebook" type="url" defaultValue={event.social_links?.facebook ?? ''} disabled={!profileEditable} required hint="Link to the event or organizer Facebook page." />
        </div>
        <div className="mt-5"><OptionalEventLinks links={optionalLinks} onChange={setOptionalLinks} disabled={!profileEditable} /></div>
      </Section>

      <Section title="Date, time & location" description="Set the event schedule and the venue participants should travel to." icon={CalendarDays}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event date" name="event_date" type="date" defaultValue={event.event_date} disabled={!profileEditable} required />
          <Field label="Venue name" name="venue" defaultValue={event.venue} disabled={!profileEditable} hint="Example: Bacolod City Government Center" />
          <Field label="Street address and city" name="address" defaultValue={event.address} disabled={!profileEditable} />
          <Field label="Public event start time" name="start_time" type="time" defaultValue={timeValue(event.start_time)} disabled={!profileEditable} />
          <Field label="Assembly time" name="assembly_time" type="time" defaultValue={timeValue(event.assembly_time)} disabled={!profileEditable} hint="Participant arrival time before the race starts." />
          <Field label="Gun start" name="gun_start_time" type="time" defaultValue={timeValue(event.gun_start_time)} disabled={!profileEditable} />
          <Field label="Course cutoff" name="cutoff_time" type="time" defaultValue={timeValue(event.cutoff_time)} disabled={!profileEditable} />
        </div>
      </Section>

      <Section title="Registration controls" description="Manage the registration window, event capacity, and participant availability." icon={ShieldCheck}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration opens" name="registration_opens_at" type="datetime-local" defaultValue={localDateTime(event.registration_opens_at)} disabled={!operationsEditable} />
          <Field label="Registration closes" name="registration_closes_at" type="datetime-local" defaultValue={localDateTime(event.registration_closes_at)} disabled={!operationsEditable} />
          <Field label="Maximum event capacity" name="overall_capacity" type="number" min={1} defaultValue={event.overall_capacity} disabled={!operationsEditable} hint="Leave blank for unlimited capacity." />
          <label className="block text-sm font-semibold text-slate-700">Registration availability
            <select name="registration_availability" defaultValue={event.registration_availability} disabled={!operationsEditable} className={controlClass}>
              <option value="not_yet_open">Not yet open</option><option value="open">Open</option><option value="closed">Closed</option><option value="sold_out">Sold out</option>
            </select>
            <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">This status does not bypass the registration dates or capacity rules.</span>
          </label>
        </div>
      </Section>

      <Section title="Event banner" description="The uploaded artwork shown on the public event page and featured banner." icon={ImageIcon}>
        <label className="block text-sm font-semibold text-slate-700">Banner image URL
          <input name="banner_url" type="url" value={previewUrl} disabled={!profileEditable} onChange={(e) => { setPreviewUrl(e.target.value); setPreviewFailed(false); }} placeholder="https://…" className={controlClass} />
          <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">Use the uploaded event banner URL. A wide image works best for the event page.</span>
        </label>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {previewUrl && !previewFailed ? <div className="relative aspect-[16/7] w-full bg-[#071b41]">
            <Image src={previewUrl} alt={`${event.name} banner preview`} fill unoptimized sizes="(max-width: 1024px) 100vw, 900px" className="object-contain" onError={() => setPreviewFailed(true)} />
          </div> : <div className="grid aspect-[16/7] place-items-center px-4 text-center text-sm text-slate-500">{previewUrl ? 'Banner preview could not be loaded.' : 'No event banner uploaded yet.'}</div>}
        </div>
        {previewUrl && !previewFailed && <BannerFrameEditor src={previewUrl} value={bannerFrame} onChange={setBannerFrame} disabled={!profileEditable} />}
      </Section>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/organizer/events/${event.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} aria-hidden="true" />Back to workspace</Link>
        {anyEditable && <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-wait disabled:opacity-60"><Save size={16} aria-hidden="true" />{busy ? 'Saving changes…' : 'Save event details'}</button>}
      </div>
    </form>
    <PartnersManager eventId={event.id} disabled={!profileEditable} />
  </main>;
}
