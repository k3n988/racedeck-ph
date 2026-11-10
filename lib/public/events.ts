import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';
import { effectiveRegistrationAvailability } from '@/lib/events/registration-availability';
import { getCategoryPricing } from '@/lib/events/category-pricing';
import type { EventSocialLinks } from '@/lib/events/event-social-links';
export { publicRegistrationPath } from '@/lib/public/event-paths';

const VISIBLE_LIFECYCLE = ['published', 'ongoing', 'completed'] as const;
const PAGE_SIZE = 12;
const EVENT_BANNER_FRAME_COLUMNS = ['banner_position_x', 'banner_position_y', 'banner_zoom'] as const;

function isMissingBannerFrameColumns(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? '';
  return (error.code === '42703' || error.code === 'PGRST204') &&
    EVENT_BANNER_FRAME_COLUMNS.some((column) => message.includes(column));
}

function withDefaultBannerFrame<T extends { banner_position_x?: number | null; banner_position_y?: number | null; banner_zoom?: number | null }>(event: T): T {
  return {
    ...event,
    banner_position_x: event.banner_position_x ?? 50,
    banner_position_y: event.banner_position_y ?? 50,
    banner_zoom: event.banner_zoom ?? 1,
  };
}

export type PublicEventCard = {
  id: string; slug: string; name: string; banner_url: string | null; banner_position_x: number; banner_position_y: number; banner_zoom: number; event_date: string;
  venue: string | null; address: string | null; organizer: { name: string; slug: string | null; logo_url: string | null } | null;
  social_links: EventSocialLinks | null;
  distances: number[]; category_labels: Array<{ name: string; distance_km: number | null }>; registration_availability: string; registration_closes_at: string | null;
  starting_registration_fee: number | null; registration_enabled: boolean; event_status: string | null; results_available: boolean;
  poster_fallback: boolean; event_period: 'ongoing' | 'upcoming' | 'past';
};
export type FeaturedPublicEvent = PublicEventCard;
export type HomepagePublicEventsData = { events: PublicEventCard[]; carouselEvents: PublicEventCard[] };
export type HomepagePublicEventsResult = HomepagePublicEventsData & { error: boolean };
export type PublicEventDetails = PublicEventCard & {
  description: string | null; tagline: string | null; logo_url: string | null; start_time: string | null;
  registration_opens_at: string | null; assembly_time: string | null; gun_start_time: string | null;
  cutoff_time: string | null; overall_capacity: number | null;
  categories: Array<{ id: string; name: string; distance_km: number | null; registration_fee: number; regular_registration_fee: number; early_bird_fee: number | null; early_bird_deadline: string | null; max_slots: number | null; confirmed_count: number; available_slots: number | null; registration_availability: string; gun_start_time: string | null; cutoff_time: string | null }>;
  schedules: Array<{ id: string; label: string; scheduled_at: string; notes: string | null }>;
  routes: Array<{ id: string; category_label: string | null; route_map_url: string | null; starting_point: string | null; finish_point: string | null; description: string | null }>;
  content_images: Array<{ id: string; image_url: string; display_order: number }>;
  content_pages: Array<{ id: string; title: string; type: 'system' | 'custom'; content: string; visible: boolean; display_order: number }>;
  kits: Array<{ id: string; category_id: string | null; name: string; description: string | null; items: Array<{ id: string; item_name: string; quantity: number; details: unknown }> }>;
  partners: Array<{ id: string; name: string; logo_url: string | null; partner_type: string | null }>;
  partners_load_error: boolean;
  organizer_details: { name: string; slug: string; logo_url: string | null; description: string | null; website: string | null; social_links: unknown } | null;
  announcements: Array<{ id: string; title: string; message: string; published_at: string | null }>;
  results_available: boolean;
};
type EventRow = { id: string; organization_id: string; slug: string; name: string; banner_url: string | null; banner_position_x?: number | null; banner_position_y?: number | null; banner_zoom?: number | null; logo_url: string | null; description: string | null; event_date: string; start_time: string | null; venue: string | null; address: string | null; social_links: EventSocialLinks | null; registration_availability: string; registration_opens_at: string | null; registration_closes_at: string | null; assembly_time: string | null; gun_start_time: string | null; cutoff_time: string | null; overall_capacity: number | null; is_featured?: boolean; created_at?: string; lifecycle_status?: string };
type CategoryRow = { id: string; event_id: string; name: string; category_group_name?: string | null; distance_km: number | null; registration_fee: number; early_bird_fee: number | null; early_bird_deadline: string | null; max_slots: number | null; confirmed_count: number; registration_availability: string; gun_start_time: string | null; cutoff_time: string | null };

const CATEGORY_CARD_FIELDS = 'id,event_id,name,category_group_name,distance_km,registration_fee,early_bird_fee,early_bird_deadline,max_slots,confirmed_count,registration_availability,gun_start_time,cutoff_time';
const CATEGORY_CORE_FIELDS = 'id,event_id,name,distance_km,registration_fee,max_slots,confirmed_count,registration_availability,gun_start_time,cutoff_time';
const CATEGORY_DISPLAY_FIELDS = 'id,event_id,name,distance_km';

/**
 * Categories are essential card content. Try the complete current schema first,
 * then retry with the original race_categories columns when an environment has
 * not applied optional pricing/group migrations yet. This prevents one missing
 * optional column from hiding every category on the public event cards.
 */
async function loadCardCategories(admin: SupabaseClient, eventIds: string[]) {
  if (!eventIds.length) return [] as CategoryRow[];
  const load = (fields: string) => admin.from('race_categories').select(fields).in('event_id', eventIds)
    .order('distance_km', { ascending: true, nullsFirst: false }).order('name');

  let result = await load(CATEGORY_CARD_FIELDS);
  if (result.error) {
    const fullProjectionError = result.error;
    result = await load(CATEGORY_CORE_FIELDS);
    if (result.error) {
      const coreProjectionError = result.error;
      result = await load(CATEGORY_DISPLAY_FIELDS);
      if (result.error) {
        console.error('Public event categories could not be loaded', {
          code: result.error.code,
          message: result.error.message,
          fullProjectionCode: fullProjectionError.code,
          coreProjectionCode: coreProjectionError.code,
        });
        return [] as CategoryRow[];
      }
      console.warn('Public event category labels loaded with display fields only; category migrations may be pending.', {
        code: fullProjectionError.code,
        coreProjectionCode: coreProjectionError.code,
      });
    } else {
      console.warn('Public event categories loaded with core fields; optional category migrations may be pending.', { code: fullProjectionError.code });
    }
  }

  return ((result.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    event_id: String(row.event_id),
    name: String(row.name ?? ''),
    category_group_name: typeof row.category_group_name === 'string' ? row.category_group_name : null,
    distance_km: row.distance_km == null ? null : Number(row.distance_km),
    registration_fee: Number(row.registration_fee ?? 0),
    early_bird_fee: row.early_bird_fee == null ? null : Number(row.early_bird_fee),
    early_bird_deadline: typeof row.early_bird_deadline === 'string' ? row.early_bird_deadline : null,
    max_slots: row.max_slots == null ? null : Number(row.max_slots),
    confirmed_count: Number(row.confirmed_count ?? 0),
    registration_availability: String(row.registration_availability ?? 'not_yet_open'),
    gun_start_time: typeof row.gun_start_time === 'string' ? row.gun_start_time : null,
    cutoff_time: typeof row.cutoff_time === 'string' ? row.cutoff_time : null,
  }));
}

async function getVisibleEvent(identifier: string) {
  const admin = createAdminClient();
  const fields = 'id,organization_id,slug,name,banner_url,banner_position_x,banner_position_y,banner_zoom,logo_url,description,event_date,start_time,venue,address,social_links,registration_availability,registration_opens_at,registration_closes_at,assembly_time,gun_start_time,cutoff_time,overall_capacity,lifecycle_status';
  const legacyFields = 'id,organization_id,slug,name,banner_url,logo_url,description,event_date,start_time,venue,address,social_links,registration_availability,registration_opens_at,registration_closes_at,assembly_time,gun_start_time,cutoff_time,overall_capacity,lifecycle_status';
  const load = async (column: 'id' | 'slug', value: string, projection: string) => admin.from('events').select(projection).eq(column, value).in('lifecycle_status', [...VISIBLE_LIFECYCLE]).eq('review_status', 'approved').maybeSingle();

  let byId = await load('id', identifier, fields);
  if (isMissingBannerFrameColumns(byId.error)) {
    console.warn('Public event banner framing columns are not available yet; using centered banner framing.');
    byId = await load('id', identifier, legacyFields);
  }
  if (byId.data) return withDefaultBannerFrame(byId.data as unknown as EventRow);
  if (byId.error && byId.error.code !== '22P02') return null;

  let bySlug = await load('slug', identifier, fields);
  if (isMissingBannerFrameColumns(bySlug.error)) bySlug = await load('slug', identifier, legacyFields);
  return bySlug.data ? withDefaultBannerFrame(bySlug.data as unknown as EventRow) : null;
}
async function categoriesForEvent(eventId: string) {
  return loadCardCategories(createAdminClient() as unknown as SupabaseClient, [eventId]);
}
async function organizerForEvent(organizationId: string) {
  const { data } = await createAdminClient().from('organizations').select('name,slug,logo_url,description,website,social_links').eq('id', organizationId).maybeSingle();
  return data ?? null;
}
function card(event: EventRow, categories: CategoryRow[], organizer: { name: string; slug: string | null; logo_url: string | null } | null): PublicEventCard {
  const eventAvailability = effectiveAvailability(event);
  const availableCategories = categories.filter((category) => (
    ['open', 'closing_soon'].includes(category.registration_availability) ||
    (category.registration_availability === 'not_yet_open' && ['open', 'closing_soon'].includes(eventAvailability))
  ) && (category.max_slots === null || category.confirmed_count < category.max_slots));
  const fees = availableCategories.map((category) => getCategoryPricing(category).amount).filter(Number.isFinite);
  const distances = Array.from(new Set(categories.map((category) => category.distance_km).filter((value): value is number => value !== null)));
  const categoryLabels = categories.map((category) => ({ name: category.category_group_name?.trim() || category.name.trim(), distance_km: category.distance_km }));
  const overallCapacityReached = event.overall_capacity !== null && categories.reduce((total, category) => total + category.confirmed_count, 0) >= event.overall_capacity;
  const categoryCapacityReached = categories.length > 0 && categories.every((category) => category.registration_availability === 'sold_out' || (category.max_slots !== null && category.confirmed_count >= category.max_slots));
  const availability = overallCapacityReached || categoryCapacityReached ? 'sold_out' : eventAvailability;
  const closesAt = event.registration_closes_at ? new Date(event.registration_closes_at).getTime() : null;
  const closingSoon = availability === 'open' && closesAt !== null && closesAt > Date.now() && closesAt <= Date.now() + 7 * 24 * 60 * 60 * 1000;
  const finalAvailability = closingSoon ? 'closing_soon' : availability;
  const registrationEnabled = event.lifecycle_status !== 'completed' && ['open', 'closing_soon'].includes(finalAvailability) && availableCategories.length > 0 && !overallCapacityReached;
  const priceAvailable = event.lifecycle_status !== 'completed' && !['closed', 'sold_out'].includes(finalAvailability);
  return { id: event.id, slug: event.slug, name: event.name, banner_url: event.banner_url, banner_position_x: event.banner_position_x ?? 50, banner_position_y: event.banner_position_y ?? 50, banner_zoom: event.banner_zoom ?? 1, event_date: event.event_date, venue: event.venue, address: event.address, organizer, social_links: event.social_links, distances, category_labels: categoryLabels, registration_availability: finalAvailability, registration_closes_at: event.registration_closes_at, starting_registration_fee: priceAvailable && fees.length ? Math.min(...fees) : null, registration_enabled: registrationEnabled, event_status: event.lifecycle_status ?? null, results_available: false, poster_fallback: false, event_period: 'upcoming' };
}
export const effectiveAvailability = effectiveRegistrationAvailability;
function extractTagline(description: string | null) {
  const firstBlock = description?.trim().split(/\n\s*\n/)[0] ?? '';
  const tagline = firstBlock.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  // A tagline is deliberately short. This prevents a full Event Details paragraph
  // from being duplicated in the left event profile card.
  return tagline && tagline.length <= 160 && tagline.split(/[.!?]/).filter(Boolean).length <= 1 ? tagline : null;
}
function manilaDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function getHomepagePublicEvents(): Promise<HomepagePublicEventsData> {
  noStore();
  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;
  const pageSize = 250;
  const rows: EventRow[] = [];
  const fields = 'id,organization_id,slug,name,banner_url,banner_position_x,banner_position_y,banner_zoom,event_date,venue,address,social_links,registration_availability,registration_opens_at,registration_closes_at,overall_capacity,lifecycle_status,is_featured';
  const legacyFields = 'id,organization_id,slug,name,banner_url,event_date,venue,address,social_links,registration_availability,registration_opens_at,registration_closes_at,overall_capacity,lifecycle_status,is_featured';
  let useLegacyEventFields = false;

  for (let offset = 0; ; offset += pageSize) {
    const loadPage = (projection: string) => db.from('events')
      .select(projection)
      .in('lifecycle_status', [...VISIBLE_LIFECYCLE])
      .eq('review_status', 'approved')
      .order('event_date', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, offset + pageSize - 1);
    let { data, error } = await loadPage(useLegacyEventFields ? legacyFields : fields);
    if (isMissingBannerFrameColumns(error) && !useLegacyEventFields) {
      console.warn('Homepage event banner framing columns are not available yet; loading events with centered banner framing.');
      useLegacyEventFields = true;
      ({ data, error } = await loadPage(legacyFields));
    }
    if (error) throw new Error(`Homepage events could not be loaded: ${error.code ?? 'unknown'} ${error.message}`);
    const page = ((data ?? []) as unknown as EventRow[]).map(withDefaultBannerFrame);
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  if (!rows.length) return { events: [], carouselEvents: [] };
  const chunks = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
  const eventIds = rows.map((event) => event.id);
  const missingBannerIds = rows.filter((event) => !event.banner_url).map((event) => event.id);
  const organizationIds = Array.from(new Set(rows.map((event) => event.organization_id)));

  const [categories, organizationPages, resultPages, imagePages] = await Promise.all([
    Promise.all(chunks(eventIds, 250).map((ids) => loadCardCategories(admin, ids))).then((pages) => pages.flat()),
    Promise.all(chunks(organizationIds, 250).map((ids) => admin.from('organizations').select('id,name,slug,logo_url').in('id', ids))),
    // This runs only on the server and returns a boolean per event. Use the
    // server client so an anonymous grant/RLS mismatch cannot hide the event
    // cards themselves from the homepage.
    Promise.all(chunks(eventIds, 250).map((ids) => admin.from('result_batches').select('event_id').in('event_id', ids).eq('publication_status', 'published'))),
    Promise.all(chunks(missingBannerIds, 250).map((ids) => db.from('event_content_images').select('event_id,image_url,display_order').in('event_id', ids).order('display_order', { ascending: true }))),
  ]);
  const organizationError = organizationPages.find((page) => page.error)?.error;
  if (organizationError) console.error('Homepage event organizers could not be loaded', { code: organizationError.code, message: organizationError.message });
  const resultError = resultPages.find((page) => page.error)?.error;
  if (resultError) console.error('Homepage published-result availability could not be loaded', { code: resultError.code, message: resultError.message });
  const imageError = imagePages.find((page) => page.error)?.error;
  if (imageError) console.error('Homepage event poster fallbacks could not be loaded', { code: imageError.code, message: imageError.message });

  const organizations = organizationPages.flatMap((page) => page.data ?? []);
  const resultEventIds = new Set(resultPages.flatMap((page) => page.error ? [] : page.data ?? []).map((batch) => batch.event_id));
  const posterByEvent = new Map<string, string>();
  for (const image of imagePages.flatMap((page) => page.error ? [] : page.data ?? [])) {
    if (!posterByEvent.has(image.event_id)) posterByEvent.set(image.event_id, image.image_url);
  }
  const categoriesByEvent = new Map<string, CategoryRow[]>();
  for (const category of categories) categoriesByEvent.set(category.event_id, [...(categoriesByEvent.get(category.event_id) ?? []), category]);
  const organizationsById = new Map(organizations.map((organization) => [organization.id, { name: organization.name, slug: organization.slug, logo_url: organization.logo_url }]));
  const today = manilaDate(new Date());
  const events = rows.map((event) => {
    const poster = !event.banner_url ? posterByEvent.get(event.id) ?? null : null;
    const isOngoing = event.lifecycle_status === 'ongoing';
    const eventPeriod: PublicEventCard['event_period'] = isOngoing ? 'ongoing' : event.lifecycle_status === 'completed' || event.event_date < today ? 'past' : 'upcoming';
    const eventCard = card({ ...event, banner_url: event.banner_url ?? poster, social_links: event.social_links ?? null }, categoriesByEvent.get(event.id) ?? [], organizationsById.get(event.organization_id) ?? null);
    return {
      ...eventCard,
      results_available: resultEventIds.has(event.id),
      poster_fallback: Boolean(poster),
      event_period: eventPeriod,
      registration_enabled: eventPeriod !== 'past' && eventCard.registration_enabled,
    };
  });

  // Keep every public event reachable in the homepage carousel. Admin-featured
  // events lead within their event period, while the normal period/date order
  // keeps upcoming and ongoing races easy to discover when no event is featured.
  const featuredEventIds = new Set(rows.filter((event) => event.is_featured).map((event) => event.id));
  const carouselEvents = [...events].sort((a, b) => {
    const stage = (event: PublicEventCard) => event.event_period === 'ongoing' ? 0 : event.event_period === 'past' ? 2 : 1;
    const aStage = stage(a);
    const bStage = stage(b);
    if (aStage !== bStage) return aStage - bStage;
    const aFeatured = featuredEventIds.has(a.id);
    const bFeatured = featuredEventIds.has(b.id);
    if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
    const byDate = a.event_date.localeCompare(b.event_date);
    return (aStage === 2 ? -byDate : byDate) || a.name.localeCompare(b.name);
  });
  return { events, carouselEvents };
}

export async function getPublicEvents(input: { search?: string; location?: string; date?: string; distance?: string; status?: string; sort?: string; period?: string; page?: number }) {
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
    } else if (distance === 'other') {
      const { data: matchingCategories, error: categoryError } = await admin.from('race_categories').select('event_id,distance_km');
      if (categoryError) throw new Error('Public event filters could not be loaded');
      const commonDistances = new Set([3, 5, 10, 21, 42]);
      distanceEventIds = Array.from(new Set((matchingCategories ?? []).filter((category) => category.distance_km === null || !commonDistances.has(Number(category.distance_km))).map((category) => category.event_id)));
    }
  }
  const db = admin as unknown as SupabaseClient;
  let query = db.from('events').select('id,organization_id,slug,name,banner_url,banner_position_x,banner_position_y,banner_zoom,event_date,venue,address,social_links,registration_availability,registration_opens_at,registration_closes_at,is_featured,created_at,lifecycle_status,overall_capacity', { count: 'exact' })
    .in('lifecycle_status', [...VISIBLE_LIFECYCLE]).eq('review_status', 'approved');
  const today = manilaDate(new Date());
  if (input.period === 'upcoming') query = query.gte('event_date', today).neq('lifecycle_status', 'completed');
  if (input.period === 'past') query = query.or(`lifecycle_status.eq.completed,event_date.lt.${today}`);
  if (distanceEventIds) {
    if (!distanceEventIds.length) return { events: [], featured: null, page: Math.max(1, input.page ?? 1), pageSize: PAGE_SIZE, total: 0, totalPages: 0 };
    query = query.in('id', distanceEventIds);
  }
  const search = input.search?.trim(); const location = input.location?.trim();
  if (search) {
    const safe = search.replace(/[%_]/g, '\\$&').replaceAll('"', '\\"');
    const { data: matchingOrganizations, error: organizationSearchError } = await admin.from('organizations').select('id').ilike('name', `%${search.replace(/[%_]/g, '\\$&')}%`);
    if (organizationSearchError) throw new Error('Public event search could not be loaded');
    const organizationIdsForSearch = (matchingOrganizations ?? []).map((organization) => organization.id);
    const clauses = [`name.ilike."%${safe}%"`, `venue.ilike."%${safe}%"`, `address.ilike."%${safe}%"`];
    if (organizationIdsForSearch.length) clauses.push(`organization_id.in.(${organizationIdsForSearch.join(',')})`);
    query = query.or(clauses.join(','));
  }
  if (location) { const safe = location.replace(/[%_]/g, '\\$&').replaceAll('"', '\\"'); query = query.or(`venue.ilike."%${safe}%",address.ilike."%${safe}%"`); }
  if (input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) query = query.eq('event_date', input.date);
  if (input.status === 'sold_out') query = query.eq('registration_availability', 'sold_out');
  if (input.status === 'open') query = query.eq('registration_availability', 'open').or(`registration_closes_at.is.null,registration_closes_at.gt.${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}`);
  if (input.status === 'closing_soon') {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    query = query.eq('registration_availability', 'open').gt('registration_closes_at', now.toISOString()).lte('registration_closes_at', soon.toISOString());
  }
  if (input.sort === 'name') query = query.order('name', { ascending: true });
  else if (input.sort === 'latest') query = query.order('created_at', { ascending: false });
  else query = query.order('event_date', { ascending: true });
  query = query.order('name', { ascending: true });
  const page = Math.max(1, input.page ?? 1); query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const { data, count, error } = await query;
  if (error) {
    console.error('Public events query failed', { code: error.code, message: error.message, details: error.details, hint: error.hint });
    throw new Error(`Public events query failed (${error.code || 'unknown'}): ${error.message}`);
  }
  const rows = (data ?? []) as unknown as EventRow[];
  const eventIds = rows.map((event) => event.id);
  const missingBannerIds = rows.filter((event) => !event.banner_url).map((event) => event.id);
  const organizationIds = Array.from(new Set(rows.map((event) => event.organization_id)));
  const [{ data: organizationRows, error: organizationError }, { data: resultBatches, error: resultError }, { data: posterRows, error: posterError }, categoryRows] = await Promise.all([
    organizationIds.length ? admin.from('organizations').select('id,name,slug,logo_url,description,website,social_links').in('id', organizationIds) : Promise.resolve({ data: [], error: null }),
    eventIds.length ? admin.from('result_batches').select('event_id').in('event_id', eventIds).eq('publication_status', 'published') : Promise.resolve({ data: [], error: null }),
    missingBannerIds.length ? (admin as unknown as SupabaseClient).from('event_content_images').select('event_id,image_url,display_order').in('event_id', missingBannerIds).order('display_order').order('created_at') : Promise.resolve({ data: [], error: null }),
    loadCardCategories(admin as unknown as SupabaseClient, eventIds),
  ]);
  // Event cards must remain browsable even if supporting metadata is temporarily
  // unavailable. Categories and organizer profiles are optional card details;
  // the published event row remains the source of truth for each card.
  if (organizationError) console.error('Public event organizer profiles could not be loaded', { code: organizationError.code, message: organizationError.message });
  if (resultError) console.error('Public event result status could not be loaded', { code: resultError.code, message: resultError.message });
  if (posterError) console.error('Public event poster images could not be loaded', { code: posterError.code, message: posterError.message });
  const categoriesByEvent = new Map<string, CategoryRow[]>();
  for (const category of categoryRows) categoriesByEvent.set(category.event_id, [...(categoriesByEvent.get(category.event_id) ?? []), category]);
  const organizationsById = new Map((organizationRows ?? []).map((organization) => [organization.id, organization]));
  const resultEventIds = new Set((resultBatches ?? []).map((batch) => batch.event_id));
  const postersByEvent = new Map<string, string>();
  for (const poster of posterRows ?? []) if (!postersByEvent.has(poster.event_id)) postersByEvent.set(poster.event_id, poster.image_url);
  const cards = rows.map((event) => {
    const poster = !event.banner_url ? postersByEvent.get(event.id) ?? null : null;
    return { ...card({ ...event, banner_url: event.banner_url ?? poster, social_links: event.social_links ?? null }, categoriesByEvent.get(event.id) ?? [], organizationsById.get(event.organization_id) ?? null), poster_fallback: Boolean(poster), results_available: resultEventIds.has(event.id) };
  });
  return { events: cards, featured: cards.find((_item, index) => rows[index].is_featured) ?? cards[0] ?? null, page, pageSize: PAGE_SIZE, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / PAGE_SIZE) };
}
export async function getPublicEventDetails(identifier: string): Promise<PublicEventDetails | null> {
  noStore();
  const event = await getVisibleEvent(identifier); if (!event) return null; const admin = createAdminClient(); const db = admin as unknown as SupabaseClient;
  const [categories, organizer, schedules, routes, partners, kits, announcements, resultBatches, contentImages, contentPages] = await Promise.all([
    categoriesForEvent(event.id), organizerForEvent(event.organization_id),
    admin.from('event_schedules').select('id,label,scheduled_at,notes').eq('event_id', event.id).order('scheduled_at'),
    admin.from('event_routes').select('id,category_label,route_map_url,starting_point,finish_point,description').eq('event_id', event.id).order('id'),
    admin.from('event_partners').select('id,name,logo_url,partner_type').eq('event_id', event.id).order('display_order').order('name'),
    admin.from('race_kit_configs').select('id,category_id,name,description,race_kit_items(id,item_name,quantity,details)').eq('event_id', event.id).eq('status', 'active').order('name'),
    admin.from('announcements').select('id,title,message,published_at').eq('event_id', event.id).in('status', ['published', 'sent']).order('published_at', { ascending: false }),
    admin.from('result_batches').select('id').eq('event_id', event.id).eq('publication_status', 'published').limit(1),
    db.from('event_content_images').select('id,image_url,display_order').eq('event_id', event.id).order('display_order').order('created_at'),
    db.from('event_content_pages').select('page_key,title,page_type,content,is_visible,display_order').eq('event_id', event.id).eq('is_visible', true).order('display_order').order('created_at'),
  ]);
  let eventPartners = partners.data ?? [];
  let partnersLoadError = Boolean(partners.error);
  if (partners.error) {
    // Older deployed schemas may not yet have display_order. Retry without
    // ordering by that optional presentation column so saved sponsors still show.
    console.error('[Loading public event partners]', partners.error);
    const fallbackPartners = await admin.from('event_partners')
      .select('id,name,logo_url,partner_type')
      .eq('event_id', event.id)
      .order('name');
    if (fallbackPartners.error) console.error('[Loading public event partners fallback]', fallbackPartners.error);
    else {
      eventPartners = fallbackPartners.data ?? [];
      partnersLoadError = false;
    }
  }
  const availability = effectiveAvailability(event);
  const detailPoster = event.banner_url ? null : contentImages.data?.[0]?.image_url ?? null;
  const displayEvent = { ...event, banner_url: event.banner_url ?? detailPoster };
  const categoryViews = categories.map((category) => ({ ...category, registration_availability: ['sold_out', 'closed'].includes(category.registration_availability) ? category.registration_availability : availability, registration_fee: getCategoryPricing(category).amount, regular_registration_fee: Number(category.registration_fee), early_bird_fee: category.early_bird_fee === null ? null : Number(category.early_bird_fee), early_bird_deadline: category.early_bird_deadline, available_slots: category.max_slots === null ? null : Math.max(0, category.max_slots - category.confirmed_count) }));
  return { ...card(displayEvent, categories, organizer), poster_fallback: Boolean(detailPoster), description: event.description, tagline: extractTagline(event.description), logo_url: event.logo_url, start_time: event.start_time, registration_opens_at: event.registration_opens_at, assembly_time: event.assembly_time, gun_start_time: event.gun_start_time, cutoff_time: event.cutoff_time, overall_capacity: event.overall_capacity, categories: categoryViews, schedules: schedules.data ?? [], routes: routes.data ?? [], content_images: contentImages.data ?? [], content_pages: (contentPages.data ?? []).map((page) => ({ id: page.page_key, title: page.title, type: page.page_type as 'system' | 'custom', content: page.content, visible: page.is_visible, display_order: page.display_order })), kits: (kits.data ?? []).map((kit) => ({ id: kit.id, category_id: kit.category_id, name: kit.name, description: kit.description, items: kit.race_kit_items ?? [] })), partners: eventPartners, partners_load_error: partnersLoadError, organizer_details: organizer, announcements: announcements.data ?? [], results_available: (resultBatches.data?.length ?? 0) > 0 };
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
