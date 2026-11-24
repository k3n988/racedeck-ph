import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const admin = createAdminClient();
  const visibleEvents = () => admin.from('events').select('id,organization_id')
    .in('lifecycle_status', ['published', 'ongoing', 'completed'])
    .eq('review_status', 'approved');
  let { data: event, error } = await visibleEvents().eq('id', params.eventId).maybeSingle();
  if (!event && (!error || error.code === '22P02')) {
    ({ data: event, error } = await visibleEvents().eq('slug', params.eventId).maybeSingle());
  }
  if (!event) return NextResponse.json({ google_analytics_id: '', meta_pixel_id: '' }, { headers: { 'Cache-Control': 'no-store' } });
  const { data } = await admin.from('organization_integrations').select('google_analytics_id,meta_pixel_id').eq('organization_id', event.organization_id).maybeSingle();
  return NextResponse.json({ google_analytics_id: data?.google_analytics_id ?? '', meta_pixel_id: data?.meta_pixel_id ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
}
