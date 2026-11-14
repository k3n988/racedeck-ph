'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import Link from 'next/link';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, Globe2, ImageIcon, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { ContentEditor } from '@/components/organizer/content-editor';
import { OptionalEventLinks } from '@/components/organizer/optional-event-links';
import { type EventSocialLinks, type OptionalEventLinkPlatform } from '@/lib/events/event-social-links';
import { BannerFrameEditor, type BannerFrame } from '@/components/organizer/banner-frame-editor';
import { PartnersManager } from '../partners-manager';
import { validateInlineImage } from '@/lib/rich-text-content';
import { composeEventDescription, splitEventDescription } from '@/lib/events/event-description';

type Event = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  event_date: string;
  venue: string | null;
  address: string | null;
  logo_url: string | null;
  logo_position_x: number | null;
  logo_position_y: number | null;
  logo_zoom: number | null;
  banner_url: string | null;
  banner_position_x: number | null;
  banner_position_y: number | null;
  banner_zoom: number | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  assembly_time: string | null;
  overall_capacity: number | null;
  lifecycle_status: string;
  registration_availability: string;
  review_status: string;
  review_feedback: string | null;
  social_links: EventSocialLinks | null;
};

type EventContentPage = { id: string; title: string; type: 'system' | 'custom'; visible: boolean; content: string };
type EventPoster = { id: string; image_url: string };

function defaultContentPages(description: string): EventContentPage[] {
  return [
    { id: 'event-details', title: 'Event Details', type: 'system', visible: true, content: description },
    { id: 'race-mechanics', title: 'Race Mechanics', type: 'system', visible: true, content: '' },
    { id: 'faqs', title: 'FAQs', type: 'system', visible: true, content: '' },
  ];
}

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
  const [message, setMessage] = useState('Loading event detailsâ€¦');
  const [busy, setBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState('');
  const [tagline, setTagline] = useState('');
  const [eventPages, setEventPages] = useState<EventContentPage[]>(defaultContentPages(''));
  const [activePage, setActivePage] = useState('event-details');
  const [addingCustomPage, setAddingCustomPage] = useState(false);
  const [customPageTitle, setCustomPageTitle] = useState('');
  const [posters, setPosters] = useState<EventPoster[]>([]);
  const [contentPagesUnavailable, setContentPagesUnavailable] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const customPageTitleRef = useRef<HTMLInputElement>(null);
  const [optionalLinks, setOptionalLinks] = useState<Partial<Record<OptionalEventLinkPlatform, string>>>({});
  const [bannerFrame, setBannerFrame] = useState<BannerFrame>({ x: 50, y: 50, zoom: 1 });
  const [logoFrame, setLogoFrame] = useState<BannerFrame>({ x: 50, y: 50, zoom: 1 });

  const load = useCallback(async () => {
    setMessage('Loading event detailsâ€¦');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Event could not be loaded.');
      setEvent(body.event);
      setLogoUrl(body.event.logo_url ?? '');
      setPreviewUrl(body.event.banner_url ?? '');
      setBannerFrame({ x: body.event.banner_position_x ?? 50, y: body.event.banner_position_y ?? 50, zoom: body.event.banner_zoom ?? 1 });
      setLogoFrame({ x: body.event.logo_position_x ?? 50, y: body.event.logo_position_y ?? 50, zoom: body.event.logo_zoom ?? 1 });
      const publicDescription = splitEventDescription(body.event.description);
      setTagline(publicDescription.tagline);
      const savedPages = Array.isArray(body.content_pages) ? body.content_pages as EventContentPage[] : [];
      const systemDefaults = defaultContentPages(publicDescription.description);
      const pages = savedPages.length ? [
        ...systemDefaults.map((page) => savedPages.find((savedPage) => savedPage.id === page.id) ?? page),
        ...savedPages.filter((page) => page.type === 'custom'),
      ] : systemDefaults;
      setEventPages(pages);
      setActivePage(pages.find((page) => page.id === 'event-details')?.id ?? pages[0]?.id ?? 'event-details');
      setPosters(Array.isArray(body.content_images) ? body.content_images : []);
      setContentPagesUnavailable(body.content_pages_available === false);
      setMediaError('');
      setOptionalLinks(Object.fromEntries((['phone', 'website', 'instagram', 'tiktok', 'youtube', 'x'] as const).filter((key) => body.event.social_links?.[key]).map((key) => [key, body.event.social_links[key]])));
      setBannerUploadError('');
      setLogoUploadError('');
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Event could not be loaded.');
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  const uploadDescriptionImage = useCallback(async (file: File) => {
    const data = new FormData();
    data.append('file', file);
    data.append('kind', 'content_image');
    const response = await fetch(`/api/organizer/events/${params.eventId}/assets`, { method: 'POST', body: data });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? 'Image upload failed. Try again.');
    if (typeof body.url !== 'string' || !body.url) throw new Error('Image upload completed without a usable URL.');
    return body.url;
  }, [params.eventId]);

  function updatePage(id: string, changes: Partial<EventContentPage>) {
    setEventPages((current) => current.map((page) => page.id === id ? { ...page, ...changes } : page));
  }

  function addCustomPage() {
    const title = customPageTitle.trim();
    if (!title || title.length > 80 || eventPages.length >= 12 || eventPages.some((page) => page.title.toLowerCase() === title.toLowerCase())) return;
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `custom-${Date.now()}`;
    if (eventPages.some((page) => page.id === id)) return;
    setEventPages((current) => [...current, { id, title, type: 'custom', visible: true, content: '' }]);
    setActivePage(id);
    setCustomPageTitle('');
  }

  async function uploadInlineContentImages(content: string, pageId: string) {
    const matches = Array.from(content.matchAll(/src=(["'])(data:image\/(jpeg|png|webp);base64,[^"']+)\1/gi));
    let result = content;
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const blob = await fetch(match[2]).then((response) => response.blob());
      if (blob.size > 10 * 1024 * 1024) throw new Error('Images inserted into event content must be 10 MB or smaller.');
      const mime = `image/${match[3].toLowerCase()}`;
      const file = new File([blob], `${pageId}-inline-${index + 1}.${match[3].toLowerCase()}`, { type: mime });
      const url = await uploadDescriptionImage(file);
      result = result.replace(match[0], `src=${match[1]}${url}${match[1]}`);
    }
    if (/src=["']data:image\//i.test(result)) throw new Error('Inline images must be JPG, PNG, or WEBP. Remove the unsupported image and upload it as a poster instead.');
    return result;
  }

  async function uploadPosters(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    const invalid = selectedFiles.find((file) => validateInlineImage(file));
    if (invalid) {
      setMediaError(validateInlineImage(invalid) ?? 'Choose a valid event poster.');
      return;
    }
    setMediaError('');
    setMediaBusy(true);
    try {
      for (const file of selectedFiles) {
        const data = new FormData();
        data.append('file', file);
        data.append('kind', 'poster');
        const response = await fetch(`/api/organizer/events/${params.eventId}/assets`, { method: 'POST', body: data });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? 'Event poster upload failed.');
        if (typeof body.url !== 'string' || !body.url) throw new Error('Poster upload completed without a usable URL.');
        setPosters((current) => [...current, { id: body.id ?? body.url, image_url: body.url }]);
      }
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Event poster upload failed.');
    } finally {
      setMediaBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    const validationError = validateInlineImage(file);
    if (validationError) {
      setLogoUploadError(validationError);
      return;
    }
    setLogoUploadError('');
    setLogoUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('kind', 'logo');
      const response = await fetch(`/api/organizer/events/${params.eventId}/assets`, { method: 'POST', body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Event logo could not be uploaded.');
      if (typeof body.url !== 'string' || !body.url) throw new Error('Logo upload completed without a usable image URL.');
      setLogoUrl(body.url);
      setLogoFrame({ x: 50, y: 50, zoom: 1 });
      setEvent((current) => current ? { ...current, logo_url: body.url } : current);
      setMessage('Event logo uploaded. Adjust its crop below, then save event details.');
    } catch (error) {
      setLogoUploadError(error instanceof Error ? error.message : 'Event logo could not be uploaded.');
    } finally {
      setLogoUploading(false);
    }
  }

  async function uploadBanner(file: File) {
    const validationError = validateInlineImage(file);
    if (validationError) {
      setBannerUploadError(validationError);
      return;
    }
    setBannerUploadError('');
    setBannerUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('kind', 'banner');
      const response = await fetch(`/api/organizer/events/${params.eventId}/assets`, { method: 'POST', body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Banner image could not be uploaded.');
      if (typeof body.url !== 'string' || !body.url) throw new Error('Banner upload completed without a usable image URL.');
      setPreviewUrl(body.url);
      setBannerFrame({ x: 50, y: 50, zoom: 1 });
      setEvent((current) => current ? { ...current, banner_url: body.url } : current);
      setMessage('Banner uploaded. Adjust its crop below, then save event details.');
    } catch (error) {
      setBannerUploadError(error instanceof Error ? error.message : 'Banner image could not be uploaded.');
    } finally {
      setBannerUploading(false);
    }
  }

  const profileLocked = Boolean(event?.review_status === 'pending_review');
  const profileEditable = Boolean(event && !profileLocked);
  const operationsEditable = profileEditable;
  const anyEditable = profileEditable || operationsEditable;
  const contentPagesEditable = Boolean(event && profileEditable && !contentPagesUnavailable);

  async function save(form: HTMLFormElement) {
    setBusy(true);
    setMessage('');
    const values: Record<string, unknown> = Object.fromEntries(new FormData(form).entries());
    values.banner_position_x = bannerFrame.x;
    values.banner_position_y = bannerFrame.y;
    values.banner_zoom = bannerFrame.zoom;
    values.logo_position_x = logoFrame.x;
    values.logo_position_y = logoFrame.y;
    values.logo_zoom = logoFrame.zoom;
    if (profileEditable) {
      values.social_links = {
        facebook: typeof values.facebook === 'string' ? values.facebook : '',
        ...optionalLinks,
      };
      delete values.facebook;
    }
    try {
      const savedPages = contentPagesEditable
        ? await Promise.all(eventPages.map(async (page) => ({ ...page, content: await uploadInlineContentImages(page.content, page.id) })))
        : null;
      if (savedPages) {
        const detailsContent = savedPages.find((page) => page.id === 'event-details')?.content ?? '';
        values.description = composeEventDescription(tagline, detailsContent);
      }
      const response = await fetch(`/api/organizer/events/${params.eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Event changes could not be saved.');
      if (result.logo_frame_saved === false && (logoFrame.x !== 50 || logoFrame.y !== 50 || logoFrame.zoom !== 1)) {
        throw new Error('The selected logo crop was not saved. Apply the pending Supabase logo framing migration, then try again.');
      }
      if (savedPages) {
        const contentResponse = await fetch(`/api/organizer/events/${params.eventId}/content-pages`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pages: savedPages }),
        });
        const contentBody = await contentResponse.json().catch(() => ({}));
        if (!contentResponse.ok) throw new Error(contentBody.error ?? 'Event content tabs could not be saved.');
        setEventPages(savedPages);
      }
      setEvent((current) => current ? { ...current, ...result.event } : result.event);
      setLogoUrl(result.event.logo_url ?? '');
      setPreviewUrl(result.event.banner_url ?? '');
      setBannerFrame({ x: result.event.banner_position_x ?? bannerFrame.x, y: result.event.banner_position_y ?? bannerFrame.y, zoom: result.event.banner_zoom ?? bannerFrame.zoom });
      setLogoFrame({ x: result.event.logo_position_x ?? logoFrame.x, y: result.event.logo_position_y ?? logoFrame.y, zoom: result.event.logo_zoom ?? logoFrame.zoom });
      const publicDescription = splitEventDescription(result.event.description);
      setTagline(publicDescription.tagline);
      if (!savedPages) setEventPages((current) => current.map((page) => page.id === 'event-details' ? { ...page, content: publicDescription.description } : page));
      setBannerUploadError('');
      setLogoUploadError('');
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
  return <main className="mx-auto max-w-6xl space-y-5 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <span className="font-semibold text-slate-700">Review status</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">{reviewLabel}</span>
      <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden="true" />
      <span className="text-slate-500">Event URL</span>
      <span className="max-w-full truncate font-medium text-[#0b2a59]">/events/{event.slug}</span>
    </div>

    {event.review_feedback && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="font-bold">RaceDeck review feedback</h2><p className="mt-1 whitespace-pre-wrap">{event.review_feedback}</p></section>}
    {profileLocked && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><p className="font-bold">Editing is paused during review</p><p className="mt-1">RaceDeck is reviewing the current version. Editing will be available again when the review is complete.</p></div>}

    {message && <ToastFeedback message={String(message)} tone="auto" />}

    <form id="event-details-form" onSubmit={submit} className="space-y-4">
      <Section title="Public event information" description="Name, URL, and description displayed on the public event page." icon={ImageIcon}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event name" name="name" defaultValue={event.name} disabled={!profileEditable} required />
          <Field label="Event URL slug" name="slug" defaultValue={event.slug} disabled={!profileEditable} required hint="Use lowercase letters, numbers, and hyphens." />
          <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Event tagline
            <input aria-label="Event tagline" value={tagline} onChange={(inputEvent) => setTagline(inputEvent.target.value)} maxLength={180} disabled={!profileEditable} className={controlClass} placeholder="A short introduction shown with your event name" />
            <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">Edit the short line shown on the public event page. {tagline.length}/180 characters.</span>
          </label>
          <div className="sm:col-span-2">
            <div className="mb-3">
              <h3 className="font-bold text-[#071b41]">Content &amp; Media</h3>
              <p className="mt-1 text-sm text-slate-500">Edit the public event tabs and upload posters, just like Create Event.</p>
            </div>
            {contentPagesUnavailable && <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Event content tabs are unavailable until the Supabase event-content-pages migration is applied.</p>}
            <div role="tablist" aria-label="Event content tabs" className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
              {eventPages.map((page) => <button key={page.id} type="button" role="tab" aria-selected={activePage === page.id} onClick={() => setActivePage(page.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-bold ${activePage === page.id ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600'}`}>{page.title}{!page.visible && ' (Hidden)'}</button>)}
              <button type="button" disabled={!contentPagesEditable || eventPages.length >= 12} onClick={() => setAddingCustomPage((current) => !current)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={15} aria-hidden="true" />Add Custom Tab</button>
            </div>
            {addingCustomPage && <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row">
              <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">Tab title<input ref={customPageTitleRef} value={customPageTitle} onChange={(inputEvent) => setCustomPageTitle(inputEvent.target.value)} onKeyDown={(inputEvent) => { if (inputEvent.key === 'Enter') { inputEvent.preventDefault(); addCustomPage(); } }} maxLength={80} className={controlClass} placeholder="e.g. International Runners' Guide" /></label>
              <div className="flex items-end gap-2"><button type="button" onClick={() => { addCustomPage(); setAddingCustomPage(false); }} disabled={!customPageTitle.trim() || eventPages.length >= 12 || eventPages.some((page) => page.title.toLowerCase() === customPageTitle.trim().toLowerCase())} className="rounded-lg bg-orange-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">Add tab</button><button type="button" onClick={() => { setAddingCustomPage(false); setCustomPageTitle(''); }} aria-label="Cancel adding custom tab" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600"><X size={16} aria-hidden="true" /></button></div>
            </div>}
            {eventPages.filter((page) => page.id === activePage).map((page) => <section key={page.id} role="tabpanel" className="mt-3 rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h4 className="text-sm font-bold text-[#071b41]">{page.title}</h4><div className="flex items-center gap-2">
                {page.type === 'custom' && <button type="button" disabled={!contentPagesEditable} onClick={() => { const nextPages = eventPages.filter((item) => item.id !== page.id); setEventPages(nextPages); setActivePage(nextPages[0]?.id ?? 'event-details'); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} aria-hidden="true" />Delete tab</button>}
                <button type="button" disabled={!contentPagesEditable} onClick={() => updatePage(page.id, { visible: !page.visible })} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-50">{page.visible ? 'Hide tab' : 'Show tab'}</button>
              </div></div>
              <ContentEditor value={page.content} onChange={(value) => updatePage(page.id, { content: value })} onImageUpload={uploadDescriptionImage} editorLabel={page.title} placeholder={page.id === 'event-details' ? 'Tell participants what to expect at your event.' : `Add ${page.title.toLowerCase()} for participants.`} editable={contentPagesEditable} />
            </section>)}
            <input type="hidden" name="description" value={composeEventDescription(tagline, eventPages.find((page) => page.id === 'event-details')?.content ?? '')} disabled={!profileEditable} />

            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-bold text-[#071b41]">Event posters</h4><p className="mt-1 text-sm text-slate-500">Upload images to display with the event details.</p></div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-50">{mediaBusy ? 'Uploading...' : 'Add posters'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!contentPagesEditable || mediaBusy} onChange={(inputEvent) => { const field = inputEvent.currentTarget; void uploadPosters(field.files); field.value = ''; }} className="sr-only" /></label>
              </div>
              {mediaError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{mediaError}</p>}
              {posters.length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{posters.map((poster, index) => <div key={`${poster.id}-${index}`} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"><Image src={poster.image_url} alt={`${event.name} poster ${index + 1}`} width={640} height={360} unoptimized className="aspect-video h-auto w-full object-contain" /></div>)}</div> : <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No event posters uploaded yet.</p>}
            </div>

          </div>
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
          <Field label="Venue name" name="venue" defaultValue={event.venue} disabled={!profileEditable} />
          <Field label="Street address and city" name="address" defaultValue={event.address} disabled={!profileEditable} />
          <Field label="Assembly time" name="assembly_time" type="time" defaultValue={timeValue(event.assembly_time)} disabled={!profileEditable} />
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

      <Section title="Event artwork" description="Manage the event logo and banner together. Adjust the banner crop to match Create Event." icon={ImageIcon}>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm font-semibold text-slate-700">Event logo / thumbnail
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!profileEditable || logoUploading} onChange={(inputEvent) => {
                const field = inputEvent.currentTarget;
                const file = field.files?.[0];
                field.value = '';
                if (file) void uploadLogo(file);
              }} className={`${controlClass} h-auto file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700`} />
              <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">JPG, PNG, or WEBP Â· up to 10 MB. Square images work best.</span>
            </label>
            {logoUploading && <p role="status" className="mt-3 text-sm font-semibold text-slate-600">Uploading logoâ€¦</p>}
            {logoUploadError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{logoUploadError}</p>}
            {logoUrl ? <BannerFrameEditor src={logoUrl} value={logoFrame} onChange={setLogoFrame} disabled={!profileEditable || logoUploading} variant="logo" title="Event logo framing" /> : <div className="mt-4 grid h-36 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">Upload an event logo to preview and adjust its crop.</div>}
          </div>

          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm font-semibold text-slate-700">Banner image
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!profileEditable || bannerUploading} onChange={(inputEvent) => {
                const field = inputEvent.currentTarget;
                const file = field.files?.[0];
                field.value = '';
                if (file) void uploadBanner(file);
              }} className={`${controlClass} h-auto file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700`} />
              <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">JPG, PNG, or WEBP Â· up to 10 MB. Landscape images work best.</span>
            </label>
            {bannerUploading && <p role="status" className="mt-3 text-sm font-semibold text-slate-600">Uploading bannerâ€¦</p>}
            {bannerUploadError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{bannerUploadError}</p>}
            {!previewUrl ? <div className="mt-4 grid min-h-36 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">Upload a banner to preview and adjust its crop.</div> : <div className="mt-4"><BannerFrameEditor src={previewUrl} value={bannerFrame} onChange={setBannerFrame} disabled={!profileEditable || bannerUploading} /></div>}
          </div>
        </div>
      </Section>

    </form>
    <PartnersManager eventId={event.id} disabled={!profileEditable} />
    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/organizer/events/${event.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} aria-hidden="true" />Back to workspace</Link>
      {anyEditable && <button type="submit" form="event-details-form" disabled={busy || bannerUploading || logoUploading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-wait disabled:opacity-60"><Save size={16} aria-hidden="true" />{busy ? 'Saving changesâ€¦' : 'Save event details'}</button>}
    </div>
  </main>;
}
