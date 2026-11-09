import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveAvailability } from '@/lib/public/events';
import { getCategoryPricing } from '@/lib/events/category-pricing';
import { getRaceCategoryRows } from '@/lib/events/race-category-query';
import { categoryRegistrationAvailabilityReason, effectiveCategoryAvailability } from '@/lib/events/registration-availability';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const jsonNoStore = (body: unknown, init?: ResponseInit) => NextResponse.json(body, {
  ...init,
  headers: { 'Cache-Control': 'no-store, max-age=0', ...init?.headers },
});

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data: event, error: eventError } = await admin.from('events').select('id,organization_id,name,banner_url,event_date,assembly_time,venue,address,registration_opens_at,registration_closes_at,registration_availability,overall_capacity').eq('id', params.eventId).eq('lifecycle_status', 'published').eq('review_status', 'approved').maybeSingle();
  if (eventError) {
    console.error('Unable to load public event for registration', eventError);
    return jsonNoStore({ error: 'Event registration details could not be loaded. Please try again.' }, { status: 500 });
  }
  if (!event) return jsonNoStore({ error: 'Event not found' }, { status: 404 });
  const { data: organization, error: organizationError } = await admin.from('organizations').select('name').eq('id', event.organization_id).maybeSingle();
  if (organizationError) return jsonNoStore({ error: 'Event organizer details could not be loaded. Please try again.' }, { status: 500 });
  const readRegistrationFields = async () => {
    const fields = await admin.from('event_registration_fields')
      .select('id,label,field_type,section_key,is_required,display_order,event_registration_field_options(id,label,value,display_order)')
      .eq('event_id', params.eventId)
      .eq('is_active', true)
      .order('display_order');

    // Older deployed schemas predate question sections. Keep their existing
    // questions usable (as Additional Information) while the migration rolls
    // out; newer schemas preserve the organizer's Health/Additional choice.
    if (fields.error?.code === '42703' && fields.error.message.includes('section_key')) {
      const legacyFields = await admin.from('event_registration_fields')
        .select('id,label,field_type,is_required,display_order,event_registration_field_options(id,label,value,display_order)')
        .eq('event_id', params.eventId)
        .eq('is_active', true)
        .order('display_order');
      return {
        ...legacyFields,
        data: legacyFields.data?.map((field) => ({ ...field, section_key: 'additional' as const })) ?? null,
      };
    }

    return fields;
  };

  const [{ data: categories, error: categoriesError }, { data: fields, error: fieldsError }, { data: waiver, error: waiverError }, { data: kitConfigs, error: kitConfigsError }, { data: merchandise, error: merchandiseError }] = await Promise.all([
    getRaceCategoryRows(admin, params.eventId),
    readRegistrationFields(),
    admin.from('event_waivers').select('id,title,version,content,content_storage_reference,effective_at').eq('event_id', params.eventId).eq('status', 'published').maybeSingle(),
    // Read kit configs and items separately. This avoids depending on a cached
    // PostgREST embedded relationship and preserves the category_id linkage.
    admin.from('race_kit_configs').select('id,event_id,category_id,name,status').eq('event_id', params.eventId).eq('status', 'active').order('created_at'),
    admin.from('event_merchandise').select('id,name,description,unit_price,variants,image_urls,display_order').eq('event_id', params.eventId).eq('is_active', true).order('display_order'),
  ]);
  const kitConfigIds = (kitConfigs ?? []).map((config) => config.id);
  const { data: kitItems, error: kitItemsError } = kitConfigIds.length
    ? await admin.from('race_kit_items').select('id,config_id,item_name,details,is_required,is_active,display_order').in('config_id', kitConfigIds).eq('is_active', true).order('display_order')
    : { data: [], error: null };
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
  type RegistrationKitItem = { id: string; config_id: string; item_name: string; details: unknown; is_required: boolean; is_active: boolean; display_order: number };
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
  return jsonNoStore({ event: { ...event, organizer_name: organization?.name ?? 'the event organizer', registration_availability: overallCapacityReached ? 'sold_out' : availability }, categories: publicCategories, fields: fields ?? [], kits: kits ?? [], merchandise: merchandise ?? [], waiver: waiver ?? null });
}
