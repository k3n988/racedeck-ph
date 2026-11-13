import { NextResponse } from 'next/server';
import { requireOrganizerPermission, errorResponse } from '@/lib/auth/organizer-access';
import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveRegistrationAvailability, registrationAvailabilityReason } from '@/lib/events/registration-availability';
import { parseEventSocialLinks } from '@/lib/events/event-social-links';
import { MAX_RICH_CONTENT_LENGTH, richContentLength } from '@/lib/rich-text-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FIELDS = 'id,organization_id,slug,name,banner_url,banner_position_x,banner_position_y,banner_zoom,logo_url,description,event_date,start_time,venue,address,social_links,registration_opens_at,registration_closes_at,assembly_time,gun_start_time,cutoff_time,overall_capacity,lifecycle_status,review_status,review_feedback,registration_availability,registration_personal_fields,is_featured,created_at,updated_at';
const LEGACY_FIELDS = 'id,organization_id,slug,name,banner_url,logo_url,description,event_date,start_time,venue,address,social_links,registration_opens_at,registration_closes_at,assembly_time,gun_start_time,cutoff_time,overall_capacity,lifecycle_status,review_status,review_feedback,registration_availability,registration_personal_fields,is_featured,created_at,updated_at';
const BANNER_FRAME_COLUMNS = ['banner_position_x', 'banner_position_y', 'banner_zoom'] as const;
type OrganizerEvent = Database['public']['Tables']['events']['Row'] & {
  banner_position_x?: number | null;
  banner_position_y?: number | null;
  banner_zoom?: number | null;
};
const jsonNoStore = (body: unknown, init?: ResponseInit) => NextResponse.json(body, {
  ...init,
  headers: { 'Cache-Control': 'no-store, max-age=0', ...init?.headers },
});
function isMissingBannerFrameColumns(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? '';
  return (error.code === '42703' || error.code === 'PGRST204')
    && BANNER_FRAME_COLUMNS.some((column) => message.includes(column));
}
function withDefaultBannerFrame(event: OrganizerEvent) {
  return {
    ...event,
    banner_position_x: event.banner_position_x ?? 50,
    banner_position_y: event.banner_position_y ?? 50,
    banner_zoom: event.banner_zoom ?? 1,
  };
}
const sameInstant = (left: unknown, right: unknown) => {
  if (left == null || left === '') return right == null || right === '';
  if (right == null || right === '') return false;
  const leftTime = Date.parse(String(left));
  const rightTime = Date.parse(String(right));
  return Number.isFinite(leftTime) && leftTime === rightTime;
};

function isMissingContentPagesTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (
    error.code === 'PGRST205' || error.code === '42P01' ||
    /event_content_pages.*(schema cache|does not exist|could not find)/i.test(error.message ?? '')
  ));
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('view_events', params.eventId);
  if ('response' in auth) return auth.response;
  const admin = auth.admin as unknown as SupabaseClient<Database>;
  const loadEvent = async (fields: string) => await admin.from('events').select(fields).eq('id', params.eventId).eq('organization_id', auth.membership.organization_id).maybeSingle() as unknown as { data: OrganizerEvent | null; error: { code?: string; message?: string } | null };
  let { data, error } = await loadEvent(FIELDS);
  if (isMissingBannerFrameColumns(error)) {
    console.warn('Organizer event banner framing columns are unavailable; using centered framing until the migration is applied.');
    ({ data, error } = await loadEvent(LEGACY_FIELDS));
  }
  if (error) return errorResponse(error, 'Loading organizer event');
  if (!data) return jsonNoStore({ error: 'Event not found' }, { status: 404 });
  data = withDefaultBannerFrame(data);
  const [{ data: registrations }, { data: payments }, { data: categories, error: categoriesError }] = await Promise.all([
    auth.admin.from('registrations').select('id,status,created_at').eq('event_id', params.eventId).order('created_at', { ascending: false }).limit(1000),
    auth.admin.from('payments').select('amount_paid,status,created_at').eq('event_id', params.eventId).order('created_at', { ascending: false }).limit(1000),
    auth.admin.from('race_categories').select('id,registration_availability,max_slots,confirmed_count').eq('event_id', params.eventId),
  ]);
  if (categoriesError) return errorResponse(categoriesError, 'Loading organizer event categories');
  const db = auth.admin as unknown as SupabaseClient;
  const [{ data: contentImages, error: imagesError }, { data: contentPages, error: pagesError }] = await Promise.all([
    db.from('event_content_images').select('id,image_url,display_order').eq('event_id', params.eventId).order('display_order').order('created_at'),
    db.from('event_content_pages').select('page_key,title,page_type,content,is_visible,display_order').eq('event_id', params.eventId).order('display_order').order('created_at'),
  ]);
  if (imagesError) return errorResponse(imagesError, 'Loading organizer event images');
  if (pagesError && !isMissingContentPagesTable(pagesError)) return errorResponse(pagesError, 'Loading organizer event content pages');
  if (pagesError) console.warn('Event content pages are unavailable until the Supabase migration is applied.');
  const successful = (payments ?? []).filter((row) => ['succeeded', 'partially_refunded', 'refunded'].includes(row.status));
  const registrationAvailability = effectiveRegistrationAvailability(data);
  const confirmedCategorySlots = (categories ?? []).reduce((sum, category) => sum + (category.confirmed_count ?? 0), 0);
  const overallCapacityReached = data.overall_capacity != null && confirmedCategorySlots >= data.overall_capacity;
  const availableCategoryCount = data.lifecycle_status === 'published'
    && data.review_status === 'approved'
    && registrationAvailability === 'open'
    && !overallCapacityReached
    ? (categories ?? []).filter((category) => (
      !['closed', 'sold_out'].includes(category.registration_availability)
      && (category.max_slots == null || category.confirmed_count < category.max_slots)
    )).length
    : 0;
  const registrationSummary = {
    availability: data.lifecycle_status !== 'published' || data.review_status !== 'approved'
      ? 'unavailable'
      : overallCapacityReached || (categories?.length && availableCategoryCount === 0)
        ? 'sold_out'
        : registrationAvailability,
    reason: data.lifecycle_status !== 'published'
      ? 'This event is not published yet.'
      : data.review_status !== 'approved'
        ? 'RaceDeck has not approved this event yet.'
        : overallCapacityReached
          ? 'The event-wide participant capacity has been reached.'
          : registrationAvailability === 'open' && categories?.length && availableCategoryCount === 0
            ? 'The schedule is open, but all categories are closed or full.'
            : registrationAvailabilityReason(data),
    available_categories: availableCategoryCount,
    total_categories: categories?.length ?? 0,
    confirmed_category_slots: confirmedCategorySlots,
    overall_capacity_reached: overallCapacityReached,
  };
  return jsonNoStore({ event: data, registration_summary: registrationSummary, content_images: contentImages ?? [], content_pages: (contentPages ?? []).map((page) => ({ id: page.page_key, title: page.title, type: page.page_type, content: page.content, visible: page.is_visible, display_order: page.display_order })), content_pages_available: !pagesError, overview: { total_registrations: registrations?.length ?? 0, confirmed_registrations: (registrations ?? []).filter((row) => row.status === 'confirmed').length, gross_sales: successful.reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0), recent_registrations: (registrations ?? []).slice(0, 5), recent_payments: (payments ?? []).slice(0, 5) } });
}

export async function PATCH(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('edit_events', params.eventId);
  if ('response' in auth) return auth.response;

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid event details' }, { status: 400 });
    const { data: current, error: currentError } = await auth.admin.from('events').select('lifecycle_status,review_status,event_date,registration_opens_at,registration_closes_at').eq('id', params.eventId).eq('organization_id', auth.membership.organization_id).maybeSingle();
    if (currentError) return errorResponse(currentError, 'Loading event before update');
    if (!current) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (current.review_status === 'pending_review') {
      return NextResponse.json({ error: 'Event details cannot be changed while RaceDeck is reviewing the event.' }, { status: 409 });
    }
    const allowed = ['name', 'slug', 'description', 'banner_url', 'banner_position_x', 'banner_position_y', 'banner_zoom', 'logo_url', 'event_date', 'start_time', 'venue', 'address', 'social_links', 'registration_opens_at', 'registration_closes_at', 'assembly_time', 'gun_start_time', 'cutoff_time', 'overall_capacity', 'registration_availability', 'registration_personal_fields'];
    const keys = Object.keys(body).filter((key) => allowed.includes(key));
    if (!keys.length) return NextResponse.json({ error: 'No event changes provided' }, { status: 400 });
    if ('description' in body && body.description !== null && typeof body.description !== 'string') {
      return NextResponse.json({ error: 'Event description must be text.' }, { status: 400 });
    }
    if (typeof body.description === 'string' && richContentLength(body.description) > MAX_RICH_CONTENT_LENGTH) {
      return NextResponse.json({ error: 'Event description must be 50,000 characters or fewer.' }, { status: 400 });
    }
    for (const key of ['registration_opens_at', 'registration_closes_at']) {
      if (key in body && body[key] != null && typeof body[key] !== 'string') {
        return NextResponse.json({ error: 'Registration dates must be valid date and time values.' }, { status: 400 });
      }
      if (typeof body[key] === 'string' && body[key].trim() !== '') {
        const timestamp = Date.parse(body[key]);
        if (!Number.isFinite(timestamp)) return NextResponse.json({ error: `Enter a valid ${key === 'registration_opens_at' ? 'opening' : 'closing'} date and time.` }, { status: 400 });
      }
    }
    if (keys.includes('registration_availability') && !['not_yet_open', 'open', 'closed', 'sold_out'].includes(body.registration_availability)) {
      return NextResponse.json({ error: 'Invalid registration availability' }, { status: 400 });
    }
    const personalFieldKeys = ['first_name', 'middle_name', 'last_name', 'birthdate', 'gender', 'email', 'contact_number', 'address', 'emergency_contact', 'emergency_contact_phone', 'emergency_contact_relationship'];
    if ('registration_personal_fields' in body && (!Array.isArray(body.registration_personal_fields) || body.registration_personal_fields.some((field: unknown) => typeof field !== 'string' || !personalFieldKeys.includes(field)))) {
      return NextResponse.json({ error: 'Choose valid personal information fields to collect.' }, { status: 400 });
    }
    for (const key of ['banner_position_x', 'banner_position_y'] as const) {
      if (key in body && (!Number.isInteger(body[key]) || body[key] < 0 || body[key] > 100)) {
        return NextResponse.json({ error: 'Banner framing position must be between 0 and 100.' }, { status: 400 });
      }
    }
    if ('banner_zoom' in body && (typeof body.banner_zoom !== 'number' || !Number.isFinite(body.banner_zoom) || body.banner_zoom < 1 || body.banner_zoom > 2)) {
      return NextResponse.json({ error: 'Banner zoom must be between 100% and 200%.' }, { status: 400 });
    }
    const update = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)).map(([key, value]) => {
      if (key === 'description' && typeof value === 'string') return [key, value.trim() ? value : ''];
      if (typeof value === 'string' && value.trim() === '') return [key, null];
      if (['registration_opens_at', 'registration_closes_at'].includes(key) && typeof value === 'string') return [key, new Date(value).toISOString()];
      if (key === 'overall_capacity' && typeof value === 'string') return [key, Number(value) || null];
      return [key, value];
    })) as Database['public']['Tables']['events']['Update'];
    if ('social_links' in update) {
      const { links, error: socialLinksError } = parseEventSocialLinks(body.social_links);
      if (socialLinksError) return NextResponse.json({ error: socialLinksError }, { status: 400 });
      update.social_links = links;
    }
    if ('name' in update && !update.name) return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
    if ('slug' in update && (!update.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(update.slug))) return NextResponse.json({ error: 'Use lowercase letters, numbers, and hyphens for the event slug' }, { status: 400 });
    if ('overall_capacity' in update && update.overall_capacity != null && (!Number.isInteger(update.overall_capacity) || update.overall_capacity <= 0)) return NextResponse.json({ error: 'Overall capacity must be a positive whole number' }, { status: 400 });
    const opening = 'registration_opens_at' in update ? update.registration_opens_at : current.registration_opens_at;
    const closing = 'registration_closes_at' in update ? update.registration_closes_at : current.registration_closes_at;
    const scheduleChanged = ('registration_opens_at' in update && !sameInstant(update.registration_opens_at, current.registration_opens_at))
      || ('registration_closes_at' in update && !sameInstant(update.registration_closes_at, current.registration_closes_at));
    // Availability-only edits must not be blocked by legacy schedule values.
    // Validate the complete date range whenever either schedule field changes.
    if (scheduleChanged && (opening || closing)) {
      const opensAt = opening ? Date.parse(opening) : NaN;
      const closesAt = closing ? Date.parse(closing) : NaN;
      const eventDate = typeof update.event_date === 'string' ? update.event_date : current.event_date;
    const endOfEventDay = Date.parse(`${eventDate}T00:00:00+08:00`) + 24 * 60 * 60 * 1000;
      if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt) || opensAt >= closesAt || closesAt > endOfEventDay) {
        return NextResponse.json({ error: 'Set valid registration dates in order, closing no later than the event day.' }, { status: 400 });
      }
    }
    const admin = auth.admin as unknown as SupabaseClient<Database>;
    const performUpdate = async (payload: Database['public']['Tables']['events']['Update'], fields: string) => await admin.from('events').update(payload).eq('id', params.eventId).eq('organization_id', auth.membership.organization_id).select(fields).single() as unknown as { data: OrganizerEvent | null; error: { code?: string; message?: string } | null };
    let { data, error } = await performUpdate(update, FIELDS);
    let bannerFrameSaved = true;
    if (isMissingBannerFrameColumns(error)) {
      const compatibleUpdate = { ...update } as Database['public']['Tables']['events']['Update'];
      for (const column of BANNER_FRAME_COLUMNS) delete compatibleUpdate[column];
      bannerFrameSaved = !BANNER_FRAME_COLUMNS.some((column) => column in update);
      console.warn('Saving event details without banner framing because the database migration is not available yet.');
      ({ data, error } = await performUpdate(compatibleUpdate, LEGACY_FIELDS));
      if (!error && data) data = withDefaultBannerFrame(data);
    }
    if (error) {
      console.error('[Updating organizer event]', error);
      return NextResponse.json({ error: error.code === '23505' ? 'Event slug already exists' : process.env.NODE_ENV === 'development' ? `Event update failed: ${error.message}` : 'Event could not be updated' }, { status: error.code === '23505' ? 409 : 500 });
    }
    if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    const expectedOpening = 'registration_opens_at' in update ? update.registration_opens_at : current.registration_opens_at;
    const expectedClosing = 'registration_closes_at' in update ? update.registration_closes_at : current.registration_closes_at;
    if (!sameInstant(data.registration_opens_at, expectedOpening)
      || !sameInstant(data.registration_closes_at, expectedClosing)
      || ('registration_availability' in update && data.registration_availability !== update.registration_availability)
      || ('overall_capacity' in update && data.overall_capacity !== update.overall_capacity)
      || ('registration_personal_fields' in update && JSON.stringify(data.registration_personal_fields) !== JSON.stringify(update.registration_personal_fields))) {
      console.error('[Updating organizer event] Database returned values different from the submitted settings', { eventId: params.eventId });
      return NextResponse.json({ error: 'The database did not save the requested registration settings. Please retry or contact RaceDeck support.' }, { status: 500 });
    }
    return jsonNoStore({ event: data, banner_frame_saved: bannerFrameSaved });
  } catch (error) {
    return errorResponse(error, 'Updating organizer event');
  }
}

export async function DELETE(_request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('edit_events', params.eventId);
  if ('response' in auth) return auth.response;

  try {
    const { data: event, error: eventError } = await auth.admin.from('events')
      .select('lifecycle_status,review_status')
      .eq('id', params.eventId)
      .eq('organization_id', auth.membership.organization_id)
      .maybeSingle();
    if (eventError) return errorResponse(eventError, 'Checking event before deletion');
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (event.lifecycle_status !== 'draft' || !['not_submitted', 'needs_changes', 'rejected'].includes(event.review_status)) {
      return NextResponse.json({ error: 'Only an unpublished draft outside review can be deleted.' }, { status: 409 });
    }
    const [{ count: registrationCount, error: registrationError }, { count: paymentCount, error: paymentError }] = await Promise.all([
      auth.admin.from('registrations').select('id', { count: 'exact', head: true }).eq('event_id', params.eventId),
      auth.admin.from('payments').select('id', { count: 'exact', head: true }).eq('event_id', params.eventId),
    ]);

    if (registrationError) return errorResponse(registrationError, 'Checking event registrations');
    if (paymentError) return errorResponse(paymentError, 'Checking event payments');
    if ((registrationCount ?? 0) > 0 || (paymentCount ?? 0) > 0) {
      return NextResponse.json({ error: 'This event has registrations or payments and cannot be deleted. Cancel or archive it instead.' }, { status: 409 });
    }

    const db = auth.admin as unknown as SupabaseClient<Database>;
    const deleteDraftEvent = db.rpc as unknown as (name: string, args: {
      p_event_id: string;
      p_organization_id: string;
    }) => Promise<{ error: { code?: string; message?: string } | null }>;
    const { error } = await deleteDraftEvent.call(db, 'delete_organizer_draft_event', {
      p_event_id: params.eventId,
      p_organization_id: auth.membership.organization_id,
    });
    if (error) {
      console.error('[Deleting organizer event]', error);
      return NextResponse.json({ error: error.code === 'P0001' ? error.message : error.code === 'PGRST202' ? 'Draft deletion is unavailable until the pending Supabase migration is applied.' : 'Draft event could not be deleted. Check for linked registrations or other protected records.' }, { status: error.code === 'P0001' ? 409 : 500 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, 'Deleting organizer event');
  }
}
