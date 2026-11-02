import { NextResponse } from 'next/server';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';

const pageSize = 1000;

async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

export async function GET(request: Request) {
  const auth = await requireOrganizerPermission('view_participants');
  if ('response' in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const requestedEventId = params.get('eventId');
  const requestedStatus = params.get('status');
  const fromTime = params.get('from') ? Date.parse(params.get('from')!) : Number.NaN;
  const toTime = params.get('to') ? Date.parse(params.get('to')!) : Number.NaN;
  const { data: allEvents, error: eventError } = await auth.admin.from('events').select('id,name').eq('organization_id', auth.membership.organization_id);
  if (eventError) {
    console.error('Organizer registrations: events query failed', eventError);
    return NextResponse.json({ error: 'Registrations could not be loaded' }, { status: 500 });
  }
  const events = (allEvents ?? []).filter((event) => !auth.membership.restricted_event_ids || auth.membership.restricted_event_ids.includes(event.id));
  const eventIds = events.filter((event) => !requestedEventId || event.id === requestedEventId).map((event) => event.id);
  if (requestedEventId && !eventIds.length) return NextResponse.json({ error: 'Event is outside your organization scope' }, { status: 403 });
  const validStatuses = ['pending_payment', 'confirmed', 'cancelled', 'expired', 'refunded'];
  if (requestedStatus && !validStatuses.includes(requestedStatus)) return NextResponse.json({ error: 'Invalid registration status' }, { status: 400 });
  const canViewPii = auth.membership.permissions.includes('view_participant_info');
  const { data, error } = eventIds.length ? await fetchAllPages((from, to) => {
    const participantFields = canViewPii ? 'first_name,last_name,email,' : '';
    let query = auth.admin.from('registrations').select(`id,event_id,registration_number,category_id,status,${participantFields}created_at,events(name),race_categories(name)`).in('event_id', eventIds).order('created_at', { ascending: false }).range(from, to);
    if (requestedStatus) query = query.eq('status', requestedStatus as never);
    if (Number.isFinite(fromTime)) query = query.gte('created_at', new Date(fromTime).toISOString());
    if (Number.isFinite(toTime)) query = query.lte('created_at', new Date(toTime).toISOString());
    return query;
  }) : { data: [], error: null };
  if (error) {
    console.error('Organizer registrations: registration query failed', error);
    return NextResponse.json({ error: 'Registrations could not be loaded' }, { status: 500 });
  }
  const registrations = data ?? [];
  const registrationIds = registrations.map((registration) => registration.id);
  const { data: payments, error: paymentError } = registrationIds.length
    ? await auth.admin.from('payments').select('registration_id,status,created_at').in('registration_id', registrationIds).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (paymentError) {
    console.error('Organizer registrations: payment status query failed', paymentError);
    return NextResponse.json({ error: 'Registration payment statuses could not be loaded' }, { status: 500 });
  }
  const latestPaymentByRegistration = new Map<string, { status: string }>();
  for (const payment of payments ?? []) {
    if (!latestPaymentByRegistration.has(payment.registration_id)) latestPaymentByRegistration.set(payment.registration_id, { status: payment.status });
  }
  return NextResponse.json({
    events,
    registrations: registrations.map((registration) => ({ ...registration, payments: latestPaymentByRegistration.has(registration.id) ? [latestPaymentByRegistration.get(registration.id)] : [] })),
    can_view_pii: canViewPii,
    can_manage_registrations: auth.membership.permissions.includes('manage_registrations'),
  });
}
