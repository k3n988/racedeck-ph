import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('id,name,event_date,venue,address,registration_opens_at,registration_closes_at,registration_availability').eq('id', params.eventId).eq('lifecycle_status', 'published').eq('review_status', 'approved').maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const [{ data: categories }, { data: fields }, { data: waiver }] = await Promise.all([
    supabase.from('race_categories').select('id,name,registration_fee,registration_availability').eq('event_id', params.eventId).eq('registration_availability', 'open').order('name'),
    supabase.from('event_registration_fields').select('id,label,field_type,is_required,display_order,event_registration_field_options(id,label,value,display_order)').eq('event_id', params.eventId).eq('is_active', true).order('display_order'),
    supabase.from('event_waivers').select('id,title,version,content,content_storage_reference,effective_at').eq('event_id', params.eventId).eq('status', 'published').maybeSingle(),
  ]);
  return NextResponse.json({ event, categories: categories ?? [], fields: fields ?? [], waiver: waiver ?? null });
}
