import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export default async function EventReviewSummary({ eventId }: { eventId: string }) {
  const db = createAdminClient();
  const mediaDb = db as unknown as SupabaseClient;
  const [{ data: event }, { data: images }, { data: routes }, { data: fields }, { data: waivers }, { data: partners }] = await Promise.all([
    db.from('events').select('banner_url,logo_url,registration_opens_at,registration_closes_at,assembly_time,gun_start_time,cutoff_time,review_feedback').eq('id', eventId).maybeSingle(),
    mediaDb.from('event_content_images').select('id,image_url').eq('event_id', eventId).order('display_order').order('created_at'),
    db.from('event_routes').select('id,route_map_url,description').eq('event_id', eventId),
    db.from('event_registration_fields').select('id,label,field_type,is_required').eq('event_id', eventId).order('display_order'),
    db.from('event_waivers').select('id,title,version,status').eq('event_id', eventId).order('version', { ascending: false }).limit(1),
    db.from('event_partners').select('id,name,partner_type').eq('event_id', eventId).order('display_order'),
  ]);
  const posters = (images ?? []) as Array<{ id: string; image_url: string }>;
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="font-bold text-[#071b41]">Submission checklist</h2>
    {event?.review_feedback && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">Previous feedback: {event.review_feedback}</p>}
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-slate-500">Registration opens</dt><dd>{event?.registration_opens_at ? new Date(event.registration_opens_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not set'}</dd></div>
      <div><dt className="text-slate-500">Registration closes</dt><dd>{event?.registration_closes_at ? new Date(event.registration_closes_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not set'}</dd></div>
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
