import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveAvailability } from '@/lib/public/events';
import { getCategoryPricing } from '@/lib/events/category-pricing';
import { getRaceCategoryRows } from '@/lib/events/race-category-query';
import { categoryRegistrationAvailabilityReason, effectiveCategoryAvailability } from '@/lib/events/registration-availability';
import { parseVariantOptions } from '@/lib/events/variant-options';
import { loadVariantUsage, variantUsageKey } from '@/lib/events/variant-inventory';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const jsonNoStore = (body: unknown, init?: ResponseInit) => NextResponse.json(body, {
  ...init,
  headers: { 'Cache-Control': 'no-store, max-age=0', ...init?.headers },
});

const bannerFrameColumns = ['banner_position_x', 'banner_position_y', 'banner_zoom'] as const;
type RegistrationEvent = {
  id: string;
  organization_id: string;
  name: string;
  banner_url: string | null;
  banner_position_x?: number | null;
  banner_position_y?: number | null;
  banner_zoom?: number | null;
  event_date: string;
  assembly_time: string | null;
  venue: string | null;
  address: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  registration_availability: string;
  overall_capacity: number | null;
};

function isMissingBannerFrameColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? '';
  return (error.code === '42703' || error.code === 'PGRST204') &&
    bannerFrameColumns.some((column) => message.includes(column));
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const admin = createAdminClient() as unknown as SupabaseClient;
  const eventColumns = 'id,organization_id,name,banner_url,banner_position_x,banner_position_y,banner_zoom,event_date,assembly_time,venue,address,registration_opens_at,registration_closes_at,registration_availability,overall_capacity';
  const legacyEventColumns = 'id,organization_id,name,banner_url,event_date,assembly_time,venue,address,registration_opens_at,registration_closes_at,registration_availability,overall_capacity';
  const isEventId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.eventId);
  const loadEvent = (projection: string) => {
    const eventLookup = admin.from('events').select(projection);
    return (isEventId ? eventLookup.eq('id', params.eventId) : eventLookup.eq('slug', params.eventId))
      .eq('lifecycle_status', 'published').eq('review_status', 'approved').maybeSingle();
  };
  let eventResult = await loadEvent(eventColumns);
  if (isMissingBannerFrameColumn(eventResult.error)) {
    console.warn('Registration banner framing columns are not available yet; using centered banner framing.');
    eventResult = await loadEvent(legacyEventColumns);
  }
  const eventError = eventResult.error;
  const eventData = eventResult.data as unknown as RegistrationEvent | null;
  const event = eventData ? {
    ...eventData,
    banner_position_x: Number(eventData.banner_position_x ?? 50),
    banner_position_y: Number(eventData.banner_position_y ?? 50),
    banner_zoom: Number(eventData.banner_zoom ?? 1),
  } : null;
  if (eventError) {
    console.error('Unable to load public event for registration', eventError);
    return jsonNoStore({ error: 'Event registration details could not be loaded. Please try again.' }, { status: 500 });
  }
  if (!event) return jsonNoStore({ error: 'Event not found' }, { status: 404 });
  const eventId = event.id;
  const readRegistrationFields = async () => {
    const fields = await admin.from('event_registration_fields')
      .select('id,label,field_type,section_key,is_required,display_order,event_registration_field_options(id,label,value,display_order)')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('display_order');

    // Older deployed schemas predate question sections. Keep their existing
    // questions usable (as Additional Information) while the migration rolls
    // out; newer schemas preserve the organizer's Health/Additional choice.
    if (fields.error?.code === '42703' && fields.error.message.includes('section_key')) {
      const legacyFields = await admin.from('event_registration_fields')
        .select('id,label,field_type,is_required,display_order,event_registration_field_options(id,label,value,display_order)')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .order('display_order');
      return {
        ...legacyFields,
        data: legacyFields.data?.map((field) => ({ ...field, section_key: 'additional' as const })) ?? null,
      };
    }

    return fields;
  };
  const readKits = async () => {
    const configs = await admin.from('race_kit_configs').select('id,event_id,category_id,name,status').eq('event_id', eventId).eq('status', 'active').order('created_at');
    if (configs.error || !configs.data?.length) return { data: configs.data, error: configs.error, items: [], itemsError: null };
    const items = await admin.from('race_kit_items').select('id,config_id,item_name,quantity,details,is_required,is_active,display_order').in('config_id', configs.data.map((config) => config.id)).eq('is_active', true).order('display_order');
    return { data: configs.data, error: configs.error, items: items.data, itemsError: items.error };
  };

  const [{ data: organization, error: organizationError }, { data: categories, error: categoriesError }, { data: fields, error: fieldsError }, { data: waiver, error: waiverError }, kitsResult, { data: merchandise, error: merchandiseError }] = await Promise.all([
    admin.from('organizations').select('name').eq('id', event.organization_id).maybeSingle(),
    getRaceCategoryRows(admin, eventId),
    readRegistrationFields(),
    admin.from('event_waivers').select('id,title,version,content,content_storage_reference,effective_at').eq('event_id', eventId).eq('status', 'published').maybeSingle(),
    // Read kit configs and items together as one promise so item loading overlaps
    // with the other event registration queries.
    readKits(),
    admin.from('event_merchandise').select('id,name,description,unit_price,variants,image_urls,display_order').eq('event_id', eventId).eq('is_active', true).order('display_order'),
  ]);
  if (organizationError) return jsonNoStore({ error: 'Event organizer details could not be loaded. Please try again.' }, { status: 500 });
  const kitConfigs = kitsResult.data;
  const kitConfigsError = kitsResult.error;
  const kitItems = kitsResult.items;
  const kitItemsError = kitsResult.itemsError;
  if (categoriesError || fieldsError || waiverError || kitConfigsError || kitItemsError || merchandiseError) {
    console.error('Unable to load registration options', { categoriesError, fieldsError, waiverError, kitConfigsError, kitItemsError, merchandiseError });
    const diagnostics = process.env.NODE_ENV === 'development' ? {
      categories: categoriesError ? { code: categoriesError.code, message: categoriesError.message } : null,
      fields: fieldsError ? { code: fieldsError.code, message: fieldsError.message } : null,
      waiver: waiverError ? { code: waiverError.code, message: waiverError.message } : null,
      kitConfigs: kitConfigsError ? { code: kitConfigsError.code, message: kitConfigsError.message } : null,
      kitItems: kitItemsError ? { code: kitItemsError.code, message: kitItemsError.message } : null,
      merchandise: merchandiseError ? { code: merchandiseError.code, message: merchandiseError.message } : null,
    } : undefined;
    return jsonNoStore({ error: 'Registration options could not be loaded. Please try again.', ...(diagnostics ? { diagnostics } : {}) }, { status: 500 });
  }
  type RegistrationKitItem = { id: string; config_id: string; item_name: string; quantity: number; details: unknown; is_required: boolean; is_active: boolean; display_order: number };
  const itemsByConfig = new Map<string, RegistrationKitItem[]>();
  for (const item of (kitItems ?? []) as RegistrationKitItem[]) {
    const items = itemsByConfig.get(item.config_id) ?? [];
    items.push(item);
    itemsByConfig.set(item.config_id, items);
  }
  const kits = (kitConfigs ?? []).map((config) => ({ ...config, race_kit_items: itemsByConfig.get(config.id) ?? [] }));
  const availability = effectiveAvailability(event);
  const confirmedCategorySlots = (categories ?? []).reduce((sum, category) => sum + (category.confirmed_count ?? 0), 0);
  const overallCapacityReached = event.overall_capacity !== null && confirmedCategorySlots >= event.overall_capacity;
  const publicCategories = (categories ?? []).map((category) => {
    const pricing = getCategoryPricing(category);
    const categoryAvailability = overallCapacityReached ? 'sold_out' : effectiveCategoryAvailability(category, event);
    return {
      id: category.id,
      name: category.name,
      category_group_name: category.category_group_name,
      distance_km: category.distance_km,
      registration_fee: pricing.amount,
      regular_registration_fee: pricing.regularFee,
      early_bird_fee: pricing.earlyBirdFee,
      early_bird_deadline: pricing.earlyBirdDeadline,
      registration_opens_at: category.registration_opens_at,
      registration_closes_at: category.registration_closes_at,
      registration_availability: categoryAvailability,
      availability_reason: overallCapacityReached ? 'Event capacity has been reached.' : categoryRegistrationAvailabilityReason(category, event),
      max_slots: category.max_slots,
      confirmed_count: category.confirmed_count,
    };
  });
  let bannerUrl = event.banner_url;
  if (!bannerUrl) {
    const { data: poster } = await admin.from('event_content_images')
      .select('image_url')
      .eq('event_id', eventId)
      .order('display_order')
      .order('created_at')
      .limit(1)
      .maybeSingle();
    bannerUrl = poster?.image_url ?? null;
  }
  let variantUsage;
  try {
    variantUsage = await loadVariantUsage(admin, eventId);
  } catch (inventoryError) {
    console.error('Unable to load size availability', inventoryError);
    return jsonNoStore({ error: 'Registration availability could not be checked. Please try again.' }, { status: 500 });
  }
  const publicMerchandise = (merchandise ?? []).map((item) => {
    const variants = parseVariantOptions(item.variants);
    return {
      ...item,
      variants: variants.map((option) => option.name),
      unavailable_variants: variants.filter((option) => option.slots !== null && (variantUsage.merchandise.get(variantUsageKey(item.id, option.name)) ?? 0) >= option.slots).map((option) => option.name),
    };
  });
  const publicKits = kits.map((kit) => ({ ...kit, race_kit_items: kit.race_kit_items.map((item) => {
    const details = item.details && typeof item.details === 'object' && !Array.isArray(item.details) ? item.details as Record<string, unknown> : {};
    const options = parseVariantOptions(details.variants);
    const quantity = Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    return {
      id: item.id,
      config_id: item.config_id,
      item_name: item.item_name,
      is_required: item.is_required,
      is_active: item.is_active,
      display_order: item.display_order,
      unavailable_variants: options.filter((option) => option.slots !== null && (variantUsage.kit.get(variantUsageKey(item.id, option.name)) ?? 0) * quantity >= option.slots).map((option) => option.name),
      details: { ...details, variants: options.map((option) => option.name) },
    };
  }) }));
  return jsonNoStore({ event: { ...event, banner_url: bannerUrl, poster_fallback: !event.banner_url && Boolean(bannerUrl), organizer_name: organization?.name ?? 'the event organizer', registration_availability: overallCapacityReached ? 'sold_out' : availability }, categories: publicCategories, fields: fields ?? [], kits: publicKits, merchandise: publicMerchandise, waiver: waiver ?? null });
}
