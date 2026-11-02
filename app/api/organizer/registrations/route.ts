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
    let query = auth.admin.from('registrations').select(`id,event_id,registration_number,category_id,checkout_group_id,status,${participantFields}created_at,events(name),race_categories(name)`).in('event_id', eventIds).order('created_at', { ascending: false }).range(from, to);
    if (requestedStatus) query = query.eq('status', requestedStatus as never);
    if (Number.isFinite(fromTime)) query = query.gte('created_at', new Date(fromTime).toISOString());
    if (Number.isFinite(toTime)) query = query.lte('created_at', new Date(toTime).toISOString());
    return query;
  }) : { data: [], error: null };
  if (error) {
    console.error('Organizer registrations: registration query failed', error);
    return NextResponse.json({ error: 'Registrations could not be loaded' }, { status: 500 });
  }
  // The conditional participant field list is valid at runtime, but Supabase's
  // generated select parser cannot infer a single row type for both variants.
  const registrations = (data ?? []) as unknown as Array<{ id: string; [key: string]: unknown }>;
  const registrationIds = registrations.map((registration) => registration.id);
  const groupIds = Array.from(new Set(registrations.map((registration) => registration.checkout_group_id).filter((id): id is string => typeof id === 'string')));
  const { data: groupedRegistrations } = groupIds.length
    ? await auth.admin.from('registrations').select('id,checkout_group_id').in('checkout_group_id', groupIds).in('event_id', eventIds)
    : { data: [] };
  const paymentRegistrationIds = Array.from(new Set([...registrationIds, ...(groupedRegistrations ?? []).map((row) => row.id)]));
  const { data: payments, error: paymentError } = paymentRegistrationIds.length
    ? await auth.admin.from('payments').select('registration_id,status,created_at').in('registration_id', paymentRegistrationIds).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (paymentError) {
    console.error('Organizer registrations: payment status query failed', paymentError);
    return NextResponse.json({ error: 'Registration payment statuses could not be loaded' }, { status: 500 });
  }
  const latestPaymentByRegistration = new Map<string, { status: string }>();
  const groupByRegistration = new Map((groupedRegistrations ?? []).map((row) => [row.id, row.checkout_group_id]));
  const latestPaymentByGroup = new Map<string, { status: string }>();
  for (const payment of payments ?? []) {
    if (!latestPaymentByRegistration.has(payment.registration_id)) latestPaymentByRegistration.set(payment.registration_id, { status: payment.status });
    const groupId = groupByRegistration.get(payment.registration_id);
    if (groupId && !latestPaymentByGroup.has(groupId)) latestPaymentByGroup.set(groupId, { status: payment.status });
  }
  return NextResponse.json({
    events,
    registrations: registrations.map((registration) => {
      const payment = latestPaymentByRegistration.get(registration.id) ?? (typeof registration.checkout_group_id === 'string' ? latestPaymentByGroup.get(registration.checkout_group_id) : undefined);
      return { ...registration, payments: payment ? [payment] : [] };
    }),
    can_view_pii: canViewPii,
    can_manage_registrations: auth.membership.permissions.includes('manage_registrations'),
  });
}
