import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const admin = createAdminClient() as any;
  const eventFields = 'id,organization_id';
  const visible = (query: any) => query.in('lifecycle_status', ['published', 'ongoing', 'completed']).eq('review_status', 'approved').maybeSingle();
  let { data: event, error } = await visible(admin.from('events').select(eventFields).eq('id', params.eventId));
  if (!event && (!error || error.code === '22P02')) {
    ({ data: event, error } = await visible(admin.from('events').select(eventFields).eq('slug', params.eventId)));
  }
  if (!event) return NextResponse.json({ google_analytics_id: '', meta_pixel_id: '' }, { headers: { 'Cache-Control': 'no-store' } });
  const { data } = await admin.from('organization_integrations').select('google_analytics_id,meta_pixel_id').eq('organization_id', event.organization_id).maybeSingle();
  return NextResponse.json({ google_analytics_id: data?.google_analytics_id ?? '', meta_pixel_id: data?.meta_pixel_id ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
}
