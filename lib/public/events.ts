import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';

const VISIBLE_LIFECYCLE = ['published', 'ongoing', 'completed'] as const;
const PAGE_SIZE = 12;

export type PublicEventCard = {
  id: string; slug: string; name: string; banner_url: string | null; event_date: string;
  venue: string | null; address: string | null; organizer: { name: string; logo_url: string | null } | null;
  distances: number[]; registration_availability: string; registration_closes_at: string | null;
  starting_registration_fee: number | null;
};
export type PublicEventDetails = PublicEventCard & {
  description: string | null; logo_url: string | null; start_time: string | null;
  registration_opens_at: string | null; assembly_time: string | null; gun_start_time: string | null;
  cutoff_time: string | null; overall_capacity: number | null;
  categories: Array<{ id: string; name: string; distance_km: number | null; registration_fee: number; max_slots: number | null; confirmed_count: number; available_slots: number | null; registration_availability: string; gun_start_time: string | null; cutoff_time: string | null }>;
  schedules: Array<{ id: string; label: string; scheduled_at: string; notes: string | null }>;
  routes: Array<{ id: string; category_label: string | null; route_map_url: string | null; starting_point: string | null; finish_point: string | null; description: string | null }>;
  content_images: Array<{ id: string; image_url: string; display_order: number }>;
  kits: Array<{ id: string; category_id: string | null; name: string; description: string | null; items: Array<{ id: string; item_name: string; quantity: number; details: unknown }> }>;
  partners: Array<{ id: string; name: string; logo_url: string | null; partner_type: string | null }>;
  organizer_details: { name: string; slug: string; logo_url: string | null; description: string | null; website: string | null; social_links: unknown } | null;
  announcements: Array<{ id: string; title: string; message: string; published_at: string | null }>;
  results_available: boolean;
};
type EventRow = { id: string; organization_id: string; slug: string; name: string; banner_url: string | null; logo_url: string | null; description: string | null; event_date: string; start_time: string | null; venue: string | null; address: string | null; registration_availability: string; registration_opens_at: string | null; registration_closes_at: string | null; assembly_time: string | null; gun_start_time: string | null; cutoff_time: string | null; overall_capacity: number | null; is_featured?: boolean };
type CategoryRow = { id: string; event_id: string; name: string; distance_km: number | null; registration_fee: number; max_slots: number | null; confirmed_count: number; registration_availability: string; gun_start_time: string | null; cutoff_time: string | null };

async function getVisibleEvent(identifier: string) {
  const admin = createAdminClient();
  const fields = 'id,organization_id,slug,name,banner_url,logo_url,description,event_date,start_time,venue,address,registration_availability,registration_opens_at,registration_closes_at,assembly_time,gun_start_time,cutoff_time,overall_capacity';
  const byId = await admin.from('events').select(fields).eq('id', identifier).in('lifecycle_status', [...VISIBLE_LIFECYCLE]).eq('review_status', 'approved').maybeSingle();
  if (byId.data) return byId.data as EventRow;
  if (byId.error && byId.error.code !== '22P02') return null;
  const bySlug = await admin.from('events').select(fields).eq('slug', identifier).in('lifecycle_status', [...VISIBLE_LIFECYCLE]).eq('review_status', 'approved').maybeSingle();
  return (bySlug.data as EventRow | null) ?? null;
}
async function categoriesForEvent(eventId: string) {
  const { data } = await createAdminClient().from('race_categories').select('id,event_id,name,distance_km,registration_fee,max_slots,confirmed_count,registration_availability,gun_start_time,cutoff_time').eq('event_id', eventId).order('distance_km', { ascending: true, nullsFirst: false }).order('name');
  return (data ?? []) as CategoryRow[];
}
async function organizerForEvent(organizationId: string) {
  const { data } = await createAdminClient().from('organizations').select('name,slug,logo_url,description,website,social_links').eq('id', organizationId).maybeSingle();
  return data ?? null;
}
function card(event: EventRow, categories: CategoryRow[], organizer: Awaited<ReturnType<typeof organizerForEvent>>): PublicEventCard {
  const fees = categories.map((category) => Number(category.registration_fee)).filter(Number.isFinite);
  return { id: event.id, slug: event.slug, name: event.name, banner_url: event.banner_url, event_date: event.event_date, venue: event.venue, address: event.address, organizer: organizer ? { name: organizer.name, logo_url: organizer.logo_url } : null, distances: categories.map((category) => category.distance_km).filter((value): value is number => value !== null), registration_availability: event.registration_availability, registration_closes_at: event.registration_closes_at, starting_registration_fee: fees.length ? Math.min(...fees) : null };
}
export async function getPublicEvents(input: { search?: string; location?: string; distance?: string; status?: string; sort?: string; page?: number }) {
  noStore();
  const admin = createAdminClient();
  let distanceEventIds: string[] | null = null;
  const distance = input.distance?.trim();
  if (distance) {
    const numericDistance = Number(distance);
    if (Number.isFinite(numericDistance) && numericDistance >= 0) {
      const { data: matchingCategories, error: categoryError } = await admin.from('race_categories').select('event_id').eq('distance_km', numericDistance);
      if (categoryError) throw new Error('Public event filters could not be loaded');
      distanceEventIds = Array.from(new Set((matchingCategories ?? []).map((category) => category.event_id)));
    }
  }
  let query = admin.from('events').select('id,organization_id,slug,name,banner_url,event_date,venue,address,registration_availability,registration_closes_at,is_featured', { count: 'exact' }).in('lifecycle_status', [...VISIBLE_LIFECYCLE]).eq('review_status', 'approved');
  if (distanceEventIds) {
    if (!distanceEventIds.length) return { events: [], featured: null, page: Math.max(1, input.page ?? 1), pageSize: PAGE_SIZE, total: 0, totalPages: 0 };
    query = query.in('id', distanceEventIds);
  }
  const search = input.search?.trim(); const location = input.location?.trim();
  if (search) query = query.ilike('name', `%${search.replace(/[%_]/g, '\\$&')}%`);
  if (location) { const safe = location.replace(/[%_]/g, '\\$&'); query = query.or(`venue.ilike.%${safe}%,address.ilike.%${safe}%`); }
  if (input.status && ['not_yet_open', 'open', 'closed', 'sold_out'].includes(input.status)) query = query.eq('registration_availability', input.status as 'not_yet_open' | 'open' | 'closed' | 'sold_out');
  query = query.order(input.sort === 'name' ? 'name' : 'event_date', { ascending: input.sort !== 'date_desc' }).order('name');
  const page = Math.max(1, input.page ?? 1); query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const { data, count, error } = await query; if (error) throw new Error('Public events could not be loaded');
  const rows = (data ?? []) as unknown as EventRow[];
  const eventIds = rows.map((event) => event.id);
  const organizationIds = Array.from(new Set(rows.map((event) => event.organization_id)));
  const [{ data: categoryRows, error: categoryError }, { data: organizationRows, error: organizationError }] = await Promise.all([
    eventIds.length ? admin.from('race_categories').select('id,event_id,name,distance_km,registration_fee,max_slots,confirmed_count,registration_availability,gun_start_time,cutoff_time').in('event_id', eventIds).order('distance_km', { ascending: true, nullsFirst: false }).order('name') : Promise.resolve({ data: [], error: null }),
    organizationIds.length ? admin.from('organizations').select('id,name,slug,logo_url,description,website,social_links').in('id', organizationIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (categoryError || organizationError) throw new Error('Public event details could not be loaded');
  const categoriesByEvent = new Map<string, CategoryRow[]>();
  for (const category of (categoryRows ?? []) as CategoryRow[]) categoriesByEvent.set(category.event_id, [...(categoriesByEvent.get(category.event_id) ?? []), category]);
  const organizationsById = new Map((organizationRows ?? []).map((organization) => [organization.id, organization]));
  const cards = rows.map((event) => card(event, categoriesByEvent.get(event.id) ?? [], organizationsById.get(event.organization_id) ?? null));
  return { events: cards, featured: cards.find((_item, index) => rows[index].is_featured) ?? cards[0] ?? null, page, pageSize: PAGE_SIZE, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / PAGE_SIZE) };
}
export async function getPublicEventDetails(identifier: string): Promise<PublicEventDetails | null> {
  noStore();
  const event = await getVisibleEvent(identifier); if (!event) return null; const admin = createAdminClient(); const db = admin as unknown as SupabaseClient;
  const [categories, organizer, schedules, routes, partners, kits, announcements, resultBatches, contentImages] = await Promise.all([
    categoriesForEvent(event.id), organizerForEvent(event.organization_id),
    admin.from('event_schedules').select('id,label,scheduled_at,notes').eq('event_id', event.id).order('scheduled_at'),
    admin.from('event_routes').select('id,category_label,route_map_url,starting_point,finish_point,description').eq('event_id', event.id).order('id'),
    admin.from('event_partners').select('id,name,logo_url,partner_type').eq('event_id', event.id).order('display_order').order('name'),
    admin.from('race_kit_configs').select('id,category_id,name,description,race_kit_items(id,item_name,quantity,details)').eq('event_id', event.id).eq('status', 'active').order('name'),
    admin.from('announcements').select('id,title,message,published_at').eq('event_id', event.id).in('status', ['published', 'sent']).order('published_at', { ascending: false }),
    admin.from('result_batches').select('id').eq('event_id', event.id).eq('publication_status', 'published').limit(1),
    db.from('event_content_images').select('id,image_url,display_order').eq('event_id', event.id).order('display_order').order('created_at'),
  ]);
  const categoryViews = categories.map((category) => ({ ...category, registration_fee: Number(category.registration_fee), available_slots: category.max_slots === null ? null : Math.max(0, category.max_slots - category.confirmed_count) }));
  return { ...card(event, categories, organizer), description: event.description, logo_url: event.logo_url, start_time: event.start_time, registration_opens_at: event.registration_opens_at, assembly_time: event.assembly_time, gun_start_time: event.gun_start_time, cutoff_time: event.cutoff_time, overall_capacity: event.overall_capacity, categories: categoryViews, schedules: schedules.data ?? [], routes: routes.data ?? [], content_images: contentImages.data ?? [], kits: (kits.data ?? []).map((kit) => ({ id: kit.id, category_id: kit.category_id, name: kit.name, description: kit.description, items: kit.race_kit_items ?? [] })), partners: partners.data ?? [], organizer_details: organizer, announcements: announcements.data ?? [], results_available: (resultBatches.data?.length ?? 0) > 0 };
}
export async function getPublicResults(input: { event?: string; participant?: string; bib?: string; category?: string; page?: number }) {
  const admin = createAdminClient(); const page = Math.max(1, input.page ?? 1);
  let query = admin.from('results').select('event_id,bib_code,bib_number,participant_display_name,category_name,gun_time,overall_rank,classification_rank,category_rank,result_status,result_batches!inner(publication_status)', { count: 'exact' }).eq('result_batches.publication_status', 'published');
  if (input.event?.trim()) query = query.eq('event_id', input.event.trim());
  if (input.participant?.trim()) query = query.ilike('participant_display_name', `%${input.participant.trim().replace(/[%_]/g, '\\$&')}%`);
  if (input.bib?.trim()) query = query.or(`bib_code.ilike.%${input.bib.trim()}%,source_bib.ilike.%${input.bib.trim()}%`);
  if (input.category?.trim()) query = query.ilike('category_name', `%${input.category.trim().replace(/[%_]/g, '\\$&')}%`);
  const { data, count, error } = await query.order('event_id').order('overall_rank', { ascending: true, nullsFirst: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1); if (error) throw new Error('Public results could not be loaded');
  return { results: (data ?? []).map((row) => ({ event_id: row.event_id, bib: row.bib_code ?? row.bib_number, participant_name: row.participant_display_name, category: row.category_name, gun_time: row.gun_time, overall_rank: row.overall_rank, classification_rank: row.classification_rank, category_rank: row.category_rank, status: row.result_status })), page, pageSize: PAGE_SIZE, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / PAGE_SIZE) };
}
