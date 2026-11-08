'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PublicEventDetails } from '@/lib/public/events';
import { ContentEditor } from '@/components/organizer/content-editor';

type Event = { id: string; name: string; description: string | null; event_date: string; start_time: string | null; venue: string | null; address: string | null; logo_url: string | null; banner_url: string | null; registration_availability: string; lifecycle_status: string; poster_fallback?: boolean; review_status: string };
type Tab = string;
type PreviewPage = { id: string; title: string; type: 'system' | 'custom'; content: string; visible: boolean; display_order?: number };
function splitContent(description: string | null) {
  const source = description ?? '';
  const markers = [
    { key: 'mechanics' as const, pattern: /(?:^|\n)\s*Race Mechanics\s*\n/i },
    { key: 'faqs' as const, pattern: /(?:^|\n)\s*(?:Frequently Asked Questions(?:\s*\(FAQs\))?|FAQs)\s*:?\s*\n/i },
  ].map((marker) => ({ ...marker, match: marker.pattern.exec(source) }))
    .filter((marker): marker is typeof marker & { match: RegExpExecArray } => marker.match !== null)
    .sort((left, right) => left.match.index - right.match.index);
  const sections: Record<'description' | 'mechanics' | 'faqs', string> = { description: '', mechanics: '', faqs: '' };
  if (!markers.length) return { description: source.trim(), mechanics: '', faqs: '' };
  sections.description = source.slice(0, markers[0].match.index).trim();
  markers.forEach((marker, index) => {
    const start = marker.match.index + marker.match[0].length;
    sections[marker.key] = source.slice(start, markers[index + 1]?.match.index ?? source.length).trim();
  });
  return sections;
}
const hasRichContent = (value: string) => Boolean(value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || /<(img|table)\b/i.test(value));

export default function OrganizerEventPreview({ params }: { params: { eventId: string } }) {
  const [event, setEvent] = useState<Event | null>(null); const [content, setContent] = useState<PublicEventDetails | null>(null); const [draftImages, setDraftImages] = useState<Array<{ id: string; image_url: string }>>([]); const [contentPages, setContentPages] = useState<PreviewPage[]>([]); const [contentStorageAvailable, setContentStorageAvailable] = useState(true); const [message, setMessage] = useState('Loading preview...'); const [tab, setTab] = useState<Tab>('event-details');
  useEffect(() => {
    Promise.all([
      fetch(`/api/organizer/events/${params.eventId}`),
      fetch(`/api/public/events/${params.eventId}`).catch(() => null),
    ]).then(async ([eventResponse, contentResponse]) => {
      const eventBody = await eventResponse.json();
      if (!eventResponse.ok) throw new Error(eventBody.error ?? 'Preview could not be loaded.');
      setDraftImages(eventBody.content_images ?? []);
      setContentStorageAvailable(eventBody.content_pages_available !== false);
      const draftPages = (eventBody.content_pages ?? []) as PreviewPage[];
      setContentPages(draftPages);
      const firstVisiblePage = draftPages.filter((page) => page.visible).sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))[0];
      setTab(firstVisiblePage?.id ?? 'announcements');
      const publicBody = contentResponse?.ok ? await contentResponse.json() : null;
      const publicEvent = publicBody?.event as PublicEventDetails | undefined;
      if (publicEvent && publicEvent.id === eventBody.event.id) {
        setContent(publicEvent);
        const publicPages = publicEvent.content_pages ?? [];
        setContentPages(publicPages);
        const firstPublicPage = publicPages[0];
        setTab(firstPublicPage?.id ?? 'announcements');
        setEvent({ ...eventBody.event, ...publicEvent, lifecycle_status: publicEvent.event_status ?? eventBody.event.lifecycle_status });
      } else {
        setEvent(eventBody.event);
        setContent(null);
      }
      setMessage('');
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'Preview could not be loaded.'));
  }, [params.eventId]);
  if (!event) return <main className="p-6"><p role="status">{message}</p><Link href={`/organizer/events/${params.eventId}/setup/details`} className="mt-4 inline-block text-orange-600">Back to edit</Link></main>;
  const posterImages = content?.content_images?.length ? content.content_images : draftImages;
  // Match the main event cards and homepage hero: prefer the event banner, then
  // fall back to the first uploaded poster for events without a dedicated banner.
  const heroImage = event.banner_url ?? posterImages[0]?.image_url ?? null;
  const heroUsesPosterFallback = Boolean(event.poster_fallback || !event.banner_url);
  const text = splitContent(event.description);
  const mechanicsPage = contentPages.find((page) => page.id === 'race-mechanics')?.content ?? '';
  const mechanics = hasRichContent(mechanicsPage) ? mechanicsPage : text.mechanics || content?.description && splitContent(content.description).mechanics;
  const visiblePages = contentPages.filter((page) => page.visible).sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0));
  const tabs = contentPages.length ? [...visiblePages, { id: 'announcements', title: 'Announcements', type: 'system' as const, content: '', visible: true }] : [
    { id: 'event-details', title: 'Event Details', type: 'system' as const, content: '', visible: true },
    { id: 'race-mechanics', title: 'Race Mechanics', type: 'system' as const, content: '', visible: true },
    { id: 'announcements', title: 'Announcements', type: 'system' as const, content: '', visible: true },
    { id: 'faqs', title: 'FAQs', type: 'system' as const, content: '', visible: true },
  ];
  const activeContentPage = contentPages.find((page) => page.id === tab);
  const faqContent = activeContentPage?.content && hasRichContent(activeContentPage.content) ? activeContentPage.content : text.faqs;
  const heroLabel = ['published', 'ongoing'].includes(event.lifecycle_status) ? 'Featured Event' : event.lifecycle_status === 'completed' ? 'Featured Event' : 'Draft Event';
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-orange-600">{heroLabel}</p>
          <p className="text-sm font-semibold text-[#071b41]">Previewing your event page</p>
        </div>
        <Link href={`/organizer/events/${event.id}/setup/details`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">← Back to Edit</Link>
      </div>

      {!contentStorageAvailable && <p role="status" className="mx-auto mt-4 max-w-6xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Preview is showing the saved event details, but FAQ and custom-tab content is unavailable until the pending Supabase event-content migration is applied.</p>}

      <article className="mx-auto max-w-6xl overflow-hidden bg-white shadow-sm">
        <section className="relative aspect-[4/1] min-h-[180px] max-h-[320px] w-full overflow-hidden bg-[#071b41]">
          {heroImage ? (
            <img src={heroImage} alt={`${event.name} event banner`} className={`h-full w-full ${heroUsesPosterFallback ? 'object-contain p-2' : 'object-cover object-center'}`} />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-[#071b41] to-orange-700 px-6 text-center text-2xl font-black text-white">{event.name}</div>
          )}
        </section>

        <nav className="flex gap-6 overflow-x-auto border-b border-slate-200 px-5 sm:px-10" aria-label="Event content preview">
          {tabs.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-bold ${tab === item.id ? 'border-orange-600 text-[#071b41]' : 'border-transparent text-slate-500 hover:text-[#071b41]'}`}>{item.title}</button>
          ))}
        </nav>

        <div className="p-5 sm:p-8">
          {(tab === 'event-details' || (visiblePages.length === 0 && tab === 'Event Details')) && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
              {hasRichContent(contentPages.find((page) => page.id === 'event-details')?.content ?? '') || text.description ? <div className="text-base leading-8 text-slate-600"><ContentEditor value={hasRichContent(contentPages.find((page) => page.id === 'event-details')?.content ?? '') ? contentPages.find((page) => page.id === 'event-details')!.content : text.description} onChange={() => undefined} editorLabel="Event description preview" editable={false} /></div> : <p className="text-base leading-8 text-slate-500">Your event description will appear here after you add it in the Event Content section.</p>}
              {posterImages.length > 0 && <div className="mt-8 space-y-5">{posterImages.map((image) => <img key={image.id} src={image.image_url} alt={`${event.name} poster`} className="h-auto w-full rounded-lg object-contain" />)}</div>}
            </section>
          )}
          {tab === 'race-mechanics' && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
              {mechanics ? <div className="text-base leading-8 text-slate-600"><ContentEditor value={mechanics} onChange={() => undefined} editorLabel="Race mechanics preview" editable={false} /></div> : <p className="text-base leading-8 text-slate-500">Race mechanics will appear here after you add them in Content &amp; Media.</p>}
            </section>
          )}
          {tab === 'announcements' && (
            <section className="space-y-4">
              {content?.announcements?.length ? content.announcements.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-[#071b41]">{item.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.message}</p></article>) : <PreviewEmpty text="Published event announcements will appear here." />}
            </section>
          )}
          {tab === 'faqs' && (faqContent ? <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8"><ContentEditor value={faqContent} onChange={() => undefined} editorLabel="Frequently asked questions preview" editable={false} /></section> : <PreviewEmpty text="Frequently asked questions will appear here after you add them." />)}
          {activeContentPage?.type === 'custom' && <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8"><ContentEditor value={activeContentPage.content} onChange={() => undefined} editorLabel={`${activeContentPage.title} preview`} editable={false} /></section>}
        </div>
      </article>
    </main>
  );
}
function PreviewEmpty({ text }: { text: string }) { return <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">{text}</div>; }
