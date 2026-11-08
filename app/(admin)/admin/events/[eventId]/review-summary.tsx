import { createAdminClient } from '@/lib/supabase/admin';
import Image from 'next/image';
import type { SupabaseClient } from '@supabase/supabase-js';
import EventContentPreview from './event-content-preview';

type ContentPage = { id: string; page_key: string; title: string; content: string; is_visible: boolean };
const hasRichContent = (value: string) => Boolean(value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || /<(img|table)\b/i.test(value));

function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export default async function EventReviewSummary({ eventId, description }: { eventId: string; description: string | null }) {
  const db = createAdminClient();
  const mediaDb = db as unknown as SupabaseClient;
  const [eventResult, imagesResult, routesResult, fieldsResult, waiversResult, partnersResult, contentResult] = await Promise.all([
    db.from('events').select('banner_url,logo_url,assembly_time,gun_start_time,cutoff_time').eq('id', eventId).maybeSingle(),
    mediaDb.from('event_content_images').select('id,image_url').eq('event_id', eventId).order('display_order').order('created_at'),
    db.from('event_routes').select('id,route_map_url,description').eq('event_id', eventId),
    db.from('event_registration_fields').select('id,label,field_type,is_required').eq('event_id', eventId).order('display_order'),
    db.from('event_waivers').select('id,title,version,status').eq('event_id', eventId).order('version', { ascending: false }).limit(1),
    db.from('event_partners').select('id,name,partner_type').eq('event_id', eventId).order('display_order'),
    mediaDb.from('event_content_pages').select('id,page_key,title,content,is_visible').eq('event_id', eventId).order('display_order'),
  ]);
  const { data: event } = eventResult;
  const { data: images } = imagesResult;
  const { data: routes } = routesResult;
  const { data: fields } = fieldsResult;
  const { data: waivers } = waiversResult;
  const { data: partners } = partnersResult;
  const { data: contentPages } = contentResult;
  const setupLoadFailed = [eventResult, imagesResult, routesResult, fieldsResult, waiversResult, partnersResult, contentResult].some((result) => result.error);
  const posters = (images ?? []) as Array<{ id: string; image_url: string }>;
  const pages = (contentPages ?? []) as ContentPage[];
  const detailsPage = pages.find((page) => page.page_key === 'event-details' && page.is_visible);
  const eventDescription = detailsPage && hasRichContent(detailsPage.content) ? detailsPage.content : description ?? '';
  const otherPages = pages.filter((page) => page.is_visible && page.page_key !== 'event-details' && hasRichContent(page.content));
  const bannerUrl = safeUrl(event?.banner_url);
  const heroUrl = bannerUrl ?? safeUrl(posters[0]?.image_url);
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div><h2 className="text-lg font-extrabold text-[#071b41]">Artwork & setup</h2><p className="mt-1 text-sm text-slate-500">Review the same uploaded assets used by the event.</p></div>
    {setupLoadFailed && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Some saved event setup could not be loaded. Refresh and check the full submission before completing this review.</p>}
    {heroUrl ? <div className="relative aspect-[16/6] max-h-80 overflow-hidden rounded-xl bg-[#071b41]"><Image src={heroUrl} alt="Uploaded event banner or poster" fill unoptimized sizes="(max-width: 1280px) 100vw, 60vw" className={bannerUrl ? 'object-cover' : 'object-contain'} /></div> : !eventResult.error && !imagesResult.error ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No event banner or poster uploaded.</p> : null}
    <div className="border-t border-slate-100 pt-4"><h3 className="font-bold text-[#071b41]">Participant-facing event details</h3>{eventDescription.trim() ? <EventContentPreview content={eventDescription} label="Event details review preview" /> : <p className="mt-2 text-sm text-slate-500">No event description provided.</p>}</div>
    {otherPages.length > 0 && <div className="space-y-2"><h3 className="font-bold text-[#071b41]">Other visible event sections</h3>{otherPages.map((page) => <details key={page.id} className="rounded-lg border border-slate-200"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#071b41]">{page.title}</summary><div className="border-t border-slate-100 px-4 pb-4"><EventContentPreview content={page.content} label={`${page.title} review preview`} /></div></details>)}</div>}
    <h3 className="font-bold text-[#071b41]">Submission checklist</h3>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-slate-500">Assembly / gun start</dt><dd>{event?.assembly_time ?? '—'} / {event?.gun_start_time ?? '—'}</dd></div>
      <div><dt className="text-slate-500">Cutoff</dt><dd>{event?.cutoff_time ?? '—'}</dd></div>
      <div><dt className="text-slate-500">Registration fields</dt><dd>{fields?.length ? fields.map((field) => `${field.label}${field.is_required ? ' *' : ''}`).join(', ') : 'Default fields only'}</dd></div>
      <div><dt className="text-slate-500">Waiver</dt><dd>{waivers?.[0] ? `${waivers[0].title} v${waivers[0].version} (${waivers[0].status})` : 'Not configured'}</dd></div>
      <div><dt className="text-slate-500">Partners</dt><dd>{partners?.length ? partners.map((partner) => partner.name).join(', ') : 'None'}</dd></div>
    </dl>
    <div className="flex flex-wrap gap-2 text-sm">
      {safeUrl(event?.banner_url) && <a href={safeUrl(event?.banner_url)!} target="_blank" rel="noreferrer" className="rounded border px-3 py-2 font-semibold text-orange-700">View banner</a>}
      {safeUrl(event?.logo_url) && <a href={safeUrl(event?.logo_url)!} target="_blank" rel="noreferrer" className="rounded border px-3 py-2 font-semibold text-orange-700">View logo</a>}
      {posters.map((image, index) => safeUrl(image.image_url) && <a key={image.id} href={safeUrl(image.image_url)!} target="_blank" rel="noreferrer" className="rounded border px-3 py-2 font-semibold text-orange-700">View poster {index + 1}</a>)}
      {(routes ?? []).map((route, index) => safeUrl(route.route_map_url) && <a key={route.id} href={safeUrl(route.route_map_url)!} target="_blank" rel="noreferrer" className="rounded border px-3 py-2 font-semibold text-orange-700">View route {index + 1}</a>)}
    </div>
  </section>;
}
