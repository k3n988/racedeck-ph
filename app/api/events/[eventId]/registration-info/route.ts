import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveAvailability } from '@/lib/public/events';

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,name,banner_url,event_date,venue,address,registration_opens_at,registration_closes_at,registration_availability').eq('id', params.eventId).eq('lifecycle_status', 'published').eq('review_status', 'approved').maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const admin = createAdminClient() as unknown as SupabaseClient;
  const [{ data: categories, error: categoriesError }, { data: fields, error: fieldsError }, { data: waiver, error: waiverError }, { data: kits, error: kitsError }, { data: merchandise, error: merchandiseError }] = await Promise.all([
    supabase.from('race_categories').select('id,name,registration_fee,registration_availability').eq('event_id', params.eventId).eq('registration_availability', 'open').order('name'),
    supabase.from('event_registration_fields').select('id,label,field_type,is_required,display_order,event_registration_field_options(id,label,value,display_order)').eq('event_id', params.eventId).eq('is_active', true).order('display_order'),
    supabase.from('event_waivers').select('id,title,version,content,content_storage_reference,effective_at').eq('event_id', params.eventId).eq('status', 'published').maybeSingle(),
    admin.from('race_kit_configs').select('id,category_id,name,race_kit_items(id,item_name,details,is_required,is_active,display_order)').eq('event_id', params.eventId).eq('status', 'active').order('display_order', { referencedTable: 'race_kit_items' }),
    admin.from('event_merchandise').select('id,name,description,unit_price,variants,image_urls,display_order').eq('event_id', params.eventId).eq('is_active', true).order('display_order'),
  ]);
  if (categoriesError || fieldsError || waiverError || kitsError || merchandiseError) {
    console.error('Unable to load registration options', { categoriesError, fieldsError, waiverError, kitsError, merchandiseError });
    return NextResponse.json({ error: 'Registration options could not be loaded. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ event: { ...event, registration_availability: effectiveAvailability(event) }, categories: categories ?? [], fields: fields ?? [], kits: kits ?? [], merchandise: merchandise ?? [], waiver: waiver ?? null });
}
