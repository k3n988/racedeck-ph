import { NextResponse } from 'next/server';
import { requireOrganizerPermission, errorResponse } from '@/lib/auth/organizer-access';
import type { Database } from '@/types/database.types';

const FIELDS = 'id,organization_id,slug,name,banner_url,logo_url,description,event_date,start_time,venue,address,registration_opens_at,registration_closes_at,assembly_time,gun_start_time,cutoff_time,overall_capacity,lifecycle_status,review_status,review_feedback,registration_availability,is_featured,created_at,updated_at';

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('view_events', params.eventId);
  if ('response' in auth) return auth.response;
  const { data, error } = await auth.admin.from('events').select(FIELDS).eq('id', params.eventId).eq('organization_id', auth.membership.organization_id).maybeSingle();
  if (error) return errorResponse(error, 'Loading organizer event');
  if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const [{ data: registrations }, { data: payments }] = await Promise.all([
    auth.admin.from('registrations').select('id,status,created_at').eq('event_id', params.eventId).order('created_at', { ascending: false }).limit(1000),
    auth.admin.from('payments').select('amount_paid,status,created_at').eq('event_id', params.eventId).order('created_at', { ascending: false }).limit(1000),
  ]);
  const successful = (payments ?? []).filter((row) => ['succeeded', 'partially_refunded', 'refunded'].includes(row.status));
  return NextResponse.json({ event: data, overview: { total_registrations: registrations?.length ?? 0, confirmed_registrations: (registrations ?? []).filter((row) => row.status === 'confirmed').length, gross_sales: successful.reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0), recent_registrations: (registrations ?? []).slice(0, 5), recent_payments: (payments ?? []).slice(0, 5) } });
}

export async function PATCH(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('edit_events', params.eventId);
  if ('response' in auth) return auth.response;

  try {
    const body = await request.json();
    const allowed = ['name', 'slug', 'description', 'banner_url', 'logo_url', 'event_date', 'start_time', 'venue', 'address', 'registration_opens_at', 'registration_closes_at', 'assembly_time', 'gun_start_time', 'cutoff_time', 'overall_capacity', 'registration_availability', 'is_featured'];
    const update = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)).map(([key, value]) => {
      if (typeof value === 'string' && value.trim() === '') return [key, null];
      if (key === 'overall_capacity' && typeof value === 'string') return [key, Number(value) || null];
      return [key, value];
    })) as Database['public']['Tables']['events']['Update'];
    const { data, error } = await auth.admin.from('events').update(update).eq('id', params.eventId).eq('organization_id', auth.membership.organization_id).select(FIELDS).single();
    if (error) {
      console.error('[Updating organizer event]', error);
      return NextResponse.json({ error: error.code === '23505' ? 'Event slug already exists' : process.env.NODE_ENV === 'development' ? `Event update failed: ${error.message}` : 'Event could not be updated' }, { status: error.code === '23505' ? 409 : 500 });
    }
    return NextResponse.json({ event: data });
  } catch (error) {
    return errorResponse(error, 'Updating organizer event');
  }
}

export async function DELETE(_request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('edit_events', params.eventId);
  if ('response' in auth) return auth.response;

  try {
    const [{ count: registrationCount, error: registrationError }, { count: paymentCount, error: paymentError }] = await Promise.all([
      auth.admin.from('registrations').select('id', { count: 'exact', head: true }).eq('event_id', params.eventId),
      auth.admin.from('payments').select('id', { count: 'exact', head: true }).eq('event_id', params.eventId),
    ]);

    if (registrationError) return errorResponse(registrationError, 'Checking event registrations');
    if (paymentError) return errorResponse(paymentError, 'Checking event payments');
    if ((registrationCount ?? 0) > 0 || (paymentCount ?? 0) > 0) {
      return NextResponse.json({ error: 'This event has registrations or payments and cannot be deleted. Cancel or archive it instead.' }, { status: 409 });
    }

    const { error } = await auth.admin.from('events').delete().eq('id', params.eventId).eq('organization_id', auth.membership.organization_id);
    if (error) return errorResponse(error, 'Deleting organizer event');
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, 'Deleting organizer event');
  }
}
