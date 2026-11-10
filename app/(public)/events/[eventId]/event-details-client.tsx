'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PublicEventDetails } from '@/lib/public/events';
import Link from 'next/link';
import { CalendarDays, Globe, MapPin, Phone } from 'lucide-react';
import { ContentEditor } from '@/components/organizer/content-editor';

type Tab = string;
const unavailable = new Set(['closed', 'sold_out', 'not_yet_open']);
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateFormat = (value: string) => { const date = new Date(value.includes('T') ? value : `${value}T00:00:00`); return Number.isNaN(date.getTime()) ? 'Date to be announced' : new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date); };
const dateTimeFormat = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date to be announced' : new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date); };
function registrationMessage(event: PublicEventDetails) {
  if (event.registration_availability === 'not_yet_open') return event.registration_opens_at ? `Registration opens ${dateTimeFormat(event.registration_opens_at)} (Manila time).` : 'Registration has not opened yet.';
  if (event.registration_availability === 'sold_out') return 'All registration slots are currently sold out.';
  if (event.registration_closes_at && Date.now() >= new Date(event.registration_closes_at).getTime()) return `Registration closed ${dateTimeFormat(event.registration_closes_at)} (Manila time). Contact the organizer if you think the deadline should be extended.`;
  return 'The organizer has closed registration for this event.';
}
const peso = (value: number) => `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const hasRichContent = (value: string) => Boolean(value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || /<(img|table)\b/i.test(value));

function Countdown({ eventDate, startTime }: { eventDate: string; startTime?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const targetDate = new Date(`${eventDate}T${startTime?.slice(0, 8) || '00:00:00'}`); const target = targetDate.getTime(); const remaining = Number.isNaN(target) ? 0 : Math.max(0, target - now); const totalSeconds = Math.floor(remaining / 1000); const currentDate = new Date(now); let months = Math.max(0, (targetDate.getFullYear() - currentDate.getFullYear()) * 12 + targetDate.getMonth() - currentDate.getMonth()); const monthStart = new Date(currentDate); monthStart.setMonth(monthStart.getMonth() + months); if (monthStart.getTime() > target) { months = Math.max(0, months - 1); monthStart.setTime(currentDate.getTime()); monthStart.setMonth(monthStart.getMonth() + months); } const remainder = Math.max(0, target - monthStart.getTime()); const values = [months, Math.floor(remainder / 86_400_000), Math.floor((totalSeconds / 3_600) % 24), Math.floor((totalSeconds / 60) % 60), totalSeconds % 60]; const labels = ['Months', 'Days', 'Hours', 'Mins.', 'Secs.'];
  return <div className="mx-auto w-full max-w-[340px]">
    <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#071b41]">Countdown until event starts</p>
    <div className="mt-2 grid grid-cols-5 gap-2" role="timer" aria-label="Time remaining until the event starts">
      {values.map((value, index) => <div key={labels[index]} className="min-w-0 text-center">
        <div className="grid h-9 place-items-center rounded-lg bg-orange-600 text-base font-extrabold tabular-nums text-white">{String(value).padStart(2, '0')}</div>
        <p className="mt-1 text-[9px] font-medium leading-3 text-slate-600">{labels[index]}</p>
      </div>)}
    </div>
  </div>;
}

function splitContent(description: string | null) {
  const source = description ?? '';
  const markers = [
    { key: 'mechanics' as const, pattern: /(?:^|\n)\s*Race Mechanics\s*\n/i },
    { key: 'faqs' as const, pattern: /(?:^|\n)\s*(?:Frequently Asked Questions(?:\s*\(FAQs\))?|FAQs)\s*:?\s*\n/i },
  ].map((marker) => ({ ...marker, match: marker.pattern.exec(source) }))
    .filter((marker): marker is typeof marker & { match: RegExpExecArray } => marker.match !== null)
    .sort((a, b) => a.match.index - b.match.index);
  const sections: Record<'description' | 'mechanics' | 'faqs', string> = { description: '', mechanics: '', faqs: '' };
  if (!markers.length) return { description: source.trim().replace(/^Event Details\s*(?:\r?\n|$)/i, '').trim(), mechanics: '', faqs: '' };
  sections.description = source.slice(0, markers[0].match.index).trim().replace(/^Event Details\s*(?:\r?\n|$)/i, '').trim();
  markers.forEach((marker, index) => {
    const start = marker.match.index + marker.match[0].length;
    const end = markers[index + 1]?.match.index ?? source.length;
    sections[marker.key] = source.slice(start, end).trim();
  });
  return sections;
}

function parseFaqItems(content: string) {
  const items: Array<{ question: string; answer: string }> = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^(?:[-*•]|\d+[.)])\s*/, '');
    if (!line) continue;
    const question = line.match(/^(?:Q:\s*)?(.+\?)$/i);
    if (question) {
      items.push({ question: question[1].trim(), answer: '' });
    } else if (items.length) {
      const answer = line.replace(/^A:\s*/i, '');
      items[items.length - 1].answer += `${items[items.length - 1].answer ? '\n' : ''}${answer}`;
    }
  }
  return items.length ? items : null;
}

function EventLogo({ event }: { event: PublicEventDetails }) { return event.logo_url ? <img src={event.logo_url} alt={`${event.name} logo`} className="h-full w-full object-contain" /> : event.banner_url ? <img src={event.banner_url} alt={`${event.name} thumbnail`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-orange-50 text-4xl text-orange-500">Race</div>; }
function FacebookIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M14 8h3V4h-3c-3.31 0-5 1.98-5 5v3H6v4h3v8h4v-8h3.5l.5-4H13V9c0-.67.33-1 1-1Z" /></svg>; }
function safeSocialUrl(value: string | undefined) { if (!value) return null; try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null; } catch { return null; } }
function safePhoneHref(value: string | undefined) { const phone = value?.trim(); return phone && /^\+?[\d\s().-]{7,20}$/.test(phone) ? `tel:${phone.replace(/[^\d+]/g, '')}` : null; }

export function EventDetailsClient({ event }: { event: PublicEventDetails }) {
  const [tab, setTab] = useState<Tab>(() => {
    const pages = event.content_pages ?? [];
    if (!pages.length) return 'details';
    const firstVisible = [...pages].filter((page) => page.visible).sort((left, right) => left.display_order - right.display_order)[0];
    if (!firstVisible) return 'announcements';
    return firstVisible.id === 'event-details' ? 'details' : firstVisible.id === 'race-mechanics' ? 'mechanics' : firstVisible.id;
  });
  const tabs = useMemo(() => {
    const pages = event.content_pages ?? [];
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const system = [
      { id: 'details', name: 'Event Details', pageId: 'event-details' },
      { id: 'mechanics', name: 'Race Mechanics', pageId: 'race-mechanics' },
      { id: 'faqs', name: 'FAQs', pageId: 'faqs' },
    ].filter((item) => pageById.get(item.pageId)?.visible !== false);
    const custom = pages.filter((page) => page.type === 'custom' && page.visible).map((page) => ({ id: page.id, name: page.title }));
    return [...system, { id: 'announcements', name: 'Announcements' }, ...custom];
  }, [event.content_pages]);
  const pageById = new Map((event.content_pages ?? []).map((page) => [page.id, page]));
  const canRegister = !unavailable.has(event.registration_availability); const registerHref = `/events/${event.id}/register`;
  const facebookUrl = safeSocialUrl(event.social_links?.facebook);
  const phoneHref = safePhoneHref(event.social_links?.phone);
  const websiteUrl = safeSocialUrl(event.social_links?.website);
  return <main className="mx-auto max-w-7xl px-4 py-2 sm:px-6 sm:py-3"><div className="grid items-start gap-3 lg:grid-cols-[330px_minmax(0,1fr)]">
    <aside className="space-y-3 lg:sticky lg:top-6"><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <section className="overflow-hidden bg-white"><div className="mx-auto mt-3 h-28 w-28 overflow-hidden rounded-2xl bg-slate-50"><EventLogo event={event} /></div><div className="space-y-2 p-4"><h1 className="text-xl font-bold leading-tight text-[#071b41]">{event.name}</h1>{event.tagline && event.tagline !== event.name && <p className="line-clamp-3 text-sm leading-5 italic text-slate-600">{event.tagline}</p>}<p className="flex items-start gap-2 text-[13px] leading-5 text-slate-600"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /><span>{dateFormat(event.event_date)}</span></p><p className="flex items-start gap-2 text-[13px] leading-5 text-slate-600"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /><span className="line-clamp-2 min-w-0 break-words">{event.venue ?? event.address ?? 'Location to be announced'}</span></p><div className="border-t border-slate-100 pt-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Race Categories</p><div className="mt-2 flex flex-wrap gap-1.5">{event.categories.map((category) => <span key={category.id} className="rounded-full border border-orange-300 px-2.5 py-1 text-xs font-bold text-orange-600">{category.distance_km !== null ? `${category.distance_km}K` : category.name}</span>)}</div></div>{(facebookUrl || phoneHref || websiteUrl) && <div className="border-t border-slate-100 pt-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contact &amp; Follow</p><div className="mt-2 flex flex-wrap items-center gap-2">{facebookUrl && <a href={facebookUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-[#1877f2] text-white transition hover:opacity-90" aria-label="Open Facebook page"><FacebookIcon /></a>}{phoneHref && <a href={phoneHref} className="grid h-9 w-9 place-items-center rounded-full bg-[#0a2957] text-white transition hover:opacity-90" aria-label="Call event organizer"><Phone aria-hidden="true" className="h-4 w-4" /></a>}{websiteUrl && <a href={websiteUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-orange-600 text-white transition hover:opacity-90" aria-label="Visit event website"><Globe aria-hidden="true" className="h-4 w-4" /></a>}</div></div>}</div></section>
      <section className="overflow-hidden border-t border-slate-100 bg-white"><div className="p-2"><Countdown eventDate={event.event_date} startTime={event.start_time} /></div><div className="border-t border-slate-100 p-2">{canRegister ? <Link href={registerHref} className="block rounded-lg bg-orange-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-orange-700">Register Now</Link> : <><span className="block rounded-lg bg-slate-200 px-4 py-2.5 text-center text-sm font-bold text-slate-500">Registration unavailable</span><p className="mt-2 text-center text-xs leading-5 text-slate-600">{registrationMessage(event)}</p></>}</div></section>
      </div>
      <section aria-labelledby="event-partners-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 id="event-partners-title" className="text-xs font-bold uppercase tracking-wider text-[#071b41]">Sponsors &amp; Partners</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Supporting this event</p>
        </div>
        {event.partners.length === 0 ? <p role={event.partners_load_error ? 'alert' : undefined} className={`mt-3 rounded-lg px-3 py-4 text-center text-xs ${event.partners_load_error ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-500'}`}>{event.partners_load_error ? 'Sponsor information is temporarily unavailable. Please refresh the page later.' : 'Sponsor information will be announced soon.'}</p> : <div className="mt-3 space-y-4">
          {(['Presented By', 'Official Partners', 'Supported By'] as const).map((tier) => {
            const partners = event.partners.filter((partner) => partner.partner_type === tier);
            if (!partners.length) return null;
            return <div key={tier}>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{tier}</h3>
              <ul className="grid grid-cols-2 gap-2">
                {partners.map((partner) => <li key={partner.id} className="flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-slate-100 bg-white p-2 text-center">
                  {partner.logo_url && <img src={partner.logo_url} alt="" loading="lazy" className="h-10 max-w-full object-contain" />}
                  <span className="max-w-full break-words text-[11px] font-semibold leading-4 text-slate-700">{partner.name}</span>
                </li>)}
              </ul>
            </div>;
          })}
          {event.partners.some((partner) => !partner.partner_type || !['Presented By', 'Official Partners', 'Supported By'].includes(partner.partner_type)) && <ul className="grid grid-cols-2 gap-2">
            {event.partners.filter((partner) => !partner.partner_type || !['Presented By', 'Official Partners', 'Supported By'].includes(partner.partner_type)).map((partner) => <li key={partner.id} className="flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-slate-100 bg-white p-2 text-center">
              {partner.logo_url && <img src={partner.logo_url} alt="" loading="lazy" className="h-10 max-w-full object-contain" />}
              <span className="max-w-full break-words text-[11px] font-semibold leading-4 text-slate-700">{partner.name}</span>
            </li>)}
          </ul>}
        </div>}
      </section>
    </aside>
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="aspect-[4/1] min-h-40 bg-slate-100">{event.banner_url ? <img src={event.banner_url} alt={`${event.name} banner`} className={`h-full w-full ${event.poster_fallback ? 'bg-[#071b41] object-contain p-2' : 'object-cover'}`} /> : <div className="grid h-full place-items-center bg-[#071b41] text-2xl font-bold text-white">{event.name}</div>}</div><nav className="flex overflow-x-auto border-b border-slate-200 px-2 sm:px-4" aria-label="Event sections">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${tab === item.id ? 'border-orange-600 text-[#071b41]' : 'border-transparent text-slate-500 hover:text-[#071b41]'}`}>{item.name}</button>)}</nav><div className="p-2 sm:p-4">{tab === 'details' && <DetailsTab event={event} pageContent={pageById.get('event-details')?.content} />}{tab === 'mechanics' && <MechanicsTab event={event} pageContent={pageById.get('race-mechanics')?.content} />}{tab === 'announcements' && <AnnouncementsTab event={event} />}{tab === 'faqs' && <FaqsTab event={event} pageContent={pageById.get('faqs')?.content} />}{pageById.get(tab)?.type === 'custom' && <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7"><ContentEditor value={pageById.get(tab)?.content ?? ''} onChange={() => undefined} editorLabel={`${pageById.get(tab)?.title ?? 'Event section'}`} editable={false} /></section>}</div></section>
  </div></main>;
}

function DetailsTab({ event, pageContent }: { event: PublicEventDetails; pageContent?: string }) { const content = splitContent(event.description); const description = pageContent && hasRichContent(pageContent) ? pageContent : content.description; return <section><div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7"><div className="max-w-4xl">{description ? <ContentEditor value={description} onChange={() => undefined} editorLabel="Event description" editable={false} /> : <p className="text-lg leading-8 text-slate-600">Event details will be announced soon.</p>}</div>{event.content_images.length > 0 ? <div className="mt-6 grid grid-cols-1 gap-4">{event.content_images.map((image) => <img key={image.id} src={image.image_url} alt={`${event.name} poster`} className="block w-full rounded-lg object-contain" />)}</div> : <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No event posters available yet.</p>}</div></section>; }

function MechanicsTab({ event, pageContent }: { event: PublicEventDetails; pageContent?: string }) { const legacy = splitContent(event.description).mechanics; const mechanics = pageContent && hasRichContent(pageContent) ? pageContent : legacy; return <section className="space-y-7">{mechanics && <section><h2 className="text-2xl font-bold text-[#071b41]">Race Mechanics</h2><div className="mt-3 text-sm leading-6 text-slate-600"><ContentEditor value={mechanics} onChange={() => undefined} editorLabel="Race mechanics" editable={false} /></div></section>}<div><h2 className="text-2xl font-bold text-[#071b41]">Race Categories &amp; Registration</h2><div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Fee</th><th className="px-4 py-3">Availability</th><th className="px-4 py-3">Start / Cut-off</th></tr></thead><tbody>{event.categories.map((category) => <tr key={category.id} className="border-t border-slate-100"><td className="px-4 py-4 font-semibold text-[#071b41]">{category.name}<span className="mt-1 block text-xs font-normal text-slate-500">{category.distance_km !== null ? `${category.distance_km} km` : 'Distance TBA'}</span></td><td className="px-4 py-4 font-semibold">{peso(category.registration_fee)}</td><td className="px-4 py-4 text-xs text-slate-600">{label(category.registration_availability)}</td><td className="px-4 py-4 text-xs text-slate-600">{category.gun_start_time ?? event.gun_start_time ?? 'TBA'} / {category.cutoff_time ?? event.cutoff_time ?? 'TBA'}</td></tr>)}</tbody></table></div></div>{event.routes.length > 0 && <div><h3 className="text-xl font-bold text-[#071b41]">Route Information</h3><div className="mt-4 grid gap-4 md:grid-cols-2">{event.routes.map((route) => <article key={route.id} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold">{route.category_label ?? 'Event route'}</p>{route.description && <p className="mt-2 text-sm text-slate-600">{route.description}</p>}{route.route_map_url && <a href={route.route_map_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-orange-600">View route map</a>}</article>)}</div></div>}</section>; }

function AnnouncementsTab({ event }: { event: PublicEventDetails }) { return <section><h2 className="text-2xl font-bold text-[#071b41]">Announcements</h2><div className="mt-5 space-y-4">{event.announcements.map((announcement) => <article key={announcement.id} className="rounded-xl border border-slate-200 p-5"><h3 className="font-bold text-[#071b41]">{announcement.title}</h3>{announcement.published_at && <p className="mt-1 text-xs text-slate-500">Published {dateTimeFormat(announcement.published_at)}</p>}<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{announcement.message}</p></article>)}</div></section>; }
function FaqsTab({ event, pageContent }: { event: PublicEventDetails; pageContent?: string }) {
  const legacy = splitContent(event.description).faqs;
  const content = pageContent && hasRichContent(pageContent) ? pageContent : legacy;
  const items = content ? parseFaqItems(content) : null;
  const hasRichMarkup = Boolean(content && /<[a-z][^>]*>/i.test(content));
  return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 className="text-xl font-bold text-[#071b41]">Frequently Asked Questions</h2>
    {hasRichMarkup ? <div className="mt-4 text-sm leading-6 text-slate-600"><ContentEditor value={content ?? ''} onChange={() => undefined} editorLabel="Frequently asked questions" editable={false} /></div> : items ? <div className="mt-4 divide-y divide-slate-200">
      {items.map((item, index) => <details key={`${item.question}-${index}`} className="group py-3" open={index === 0}>
        <summary className="cursor-pointer list-none pr-8 font-semibold text-[#071b41] marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 [&::-webkit-details-marker]:hidden">{item.question}<span aria-hidden="true" className="float-right text-orange-600 transition-transform group-open:rotate-45">+</span></summary>
        {item.answer && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.answer}</p>}
      </details>)}
    </div> : content ? <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">{content.split(/\n\s*\n/).map((paragraph, index) => <p key={index} className="whitespace-pre-wrap">{paragraph.trim()}</p>)}</div> : <p className="mt-2 text-sm leading-6 text-slate-600">Frequently asked questions will appear here when the organizer adds them to the event description under a “FAQs” heading.</p>}
  </section>;
}
