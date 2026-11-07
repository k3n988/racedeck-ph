import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveAvailability } from '@/lib/public/events';
import { getCategoryPricing } from '@/lib/events/category-pricing';
import { getRaceCategoryRows } from '@/lib/events/race-category-query';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const jsonNoStore = (body: unknown, init?: ResponseInit) => NextResponse.json(body, {
  ...init,
  headers: { 'Cache-Control': 'no-store, max-age=0', ...init?.headers },
});

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data: event, error: eventError } = await admin.from('events').select('id,name,banner_url,event_date,venue,address,registration_opens_at,registration_closes_at,registration_availability,overall_capacity').eq('id', params.eventId).eq('lifecycle_status', 'published').eq('review_status', 'approved').maybeSingle();
  if (eventError) {
    console.error('Unable to load public event for registration', eventError);
    return jsonNoStore({ error: 'Event registration details could not be loaded. Please try again.' }, { status: 500 });
  }
  if (!event) return jsonNoStore({ error: 'Event not found' }, { status: 404 });
  const [{ data: categories, error: categoriesError }, { data: fields, error: fieldsError }, { data: waiver, error: waiverError }, { data: kitConfigs, error: kitConfigsError }, { data: merchandise, error: merchandiseError }] = await Promise.all([
    getRaceCategoryRows(admin, params.eventId),
    admin.from('event_registration_fields').select('id,label,field_type,is_required,display_order,event_registration_field_options(id,label,value,display_order)').eq('event_id', params.eventId).eq('is_active', true).order('display_order'),
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
    return jsonNoStore({ error: 'Registration options could not be loaded. Please try again.' }, { status: 500 });
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
  const availableCategories = (categories ?? []).filter((category) => {
    if (category.registration_availability === 'closed' || category.registration_availability === 'sold_out') return false;
    if (overallCapacityReached || (availability !== 'open' && availability !== 'closing_soon')) return false;
    return category.max_slots === null || category.confirmed_count < category.max_slots;
  }).map((category) => {
    const pricing = getCategoryPricing(category);
    return { id: category.id, name: category.name, distance_km: category.distance_km, registration_fee: pricing.amount, regular_registration_fee: pricing.regularFee, early_bird_fee: pricing.earlyBirdFee, early_bird_deadline: pricing.earlyBirdDeadline, registration_availability: 'open' };
  });
  return jsonNoStore({ event: { ...event, registration_availability: overallCapacityReached ? 'sold_out' : availability }, categories: availableCategories, fields: fields ?? [], kits: kits ?? [], merchandise: merchandise ?? [], waiver: waiver ?? null });
}
