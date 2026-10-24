import { NextResponse } from 'next/server';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';

const successfulStatuses = ['succeeded', 'partially_refunded', 'refunded'];
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

const isInDateRange = (date: string, fromTime: number, toTime: number) => {
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) && (!Number.isFinite(fromTime) || timestamp >= fromTime) && (!Number.isFinite(toTime) || timestamp <= toTime);
};

export async function GET(request: Request) {
  const auth = await requireOrganizerPermission('view_reports');
  if ('response' in auth) return auth.response;
  const params = new URL(request.url).searchParams;
  const requestedEventId = params.get('eventId');
  const fromTime = params.get('from') ? Date.parse(params.get('from')!) : Number.NaN;
  const toTime = params.get('to') ? Date.parse(params.get('to')!) : Number.NaN;
  const { data: allEvents, error: eventsError } = await auth.admin.from('events').select('id,name,overall_capacity').eq('organization_id', auth.membership.organization_id);
  if (eventsError) return NextResponse.json({ error: 'Reports could not be loaded' }, { status: 500 });
  const events = (allEvents ?? []).filter((event) => (!auth.membership.restricted_event_ids || auth.membership.restricted_event_ids.includes(event.id)) && (!requestedEventId || event.id === requestedEventId));
  if (requestedEventId && events.length === 0) return NextResponse.json({ error: 'Event is outside your organization scope' }, { status: 403 });
  const eventIds = events.map((event) => event.id);
  const financialAccess = auth.membership.permissions.includes('view_financials');
  const [{ data: allRegistrations, error: registrationsError }, { data: allPayments, error: paymentsError }, { data: allRefunds, error: refundsError }, { data: allFees, error: feesError }] = await Promise.all([
    eventIds.length ? fetchAllPages((from, to) => auth.admin.from('registrations').select('id,event_id,status,created_at').in('event_id', eventIds).order('created_at', { ascending: true }).range(from, to)) : Promise.resolve({ data: [], error: null }),
    financialAccess && eventIds.length ? fetchAllPages((from, to) => auth.admin.from('payments').select('id,event_id,status,amount_paid,created_at').in('event_id', eventIds).order('created_at', { ascending: true }).range(from, to)) : Promise.resolve({ data: [], error: null }),
    financialAccess && eventIds.length ? fetchAllPages((from, to) => auth.admin.from('refunds').select('id,event_id,status,amount,created_at').in('event_id', eventIds).order('created_at', { ascending: true }).range(from, to)) : Promise.resolve({ data: [], error: null }),
    financialAccess && eventIds.length ? fetchAllPages((from, to) => auth.admin.from('platform_fees').select('id,event_id,status,amount,created_at').in('event_id', eventIds).order('created_at', { ascending: true }).range(from, to)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (registrationsError || paymentsError || refundsError || feesError) return NextResponse.json({ error: 'Reports could not be loaded' }, { status: 500 });
  const registrations = (allRegistrations ?? []).filter((row) => isInDateRange(row.created_at, fromTime, toTime));
  const payments = Array.from(new Map((allPayments ?? []).filter((row) => successfulStatuses.includes(row.status) && isInDateRange(row.created_at, fromTime, toTime)).map((row) => [row.id, row] as const)).values());
  const refunds = Array.from(new Map((allRefunds ?? []).filter((row) => row.status === 'succeeded' && isInDateRange(row.created_at, fromTime, toTime)).map((row) => [row.id, row] as const)).values());
  const fees = Array.from(new Map((allFees ?? []).filter((row) => ['accrued', 'collected'].includes(row.status) && isInDateRange(row.created_at, fromTime, toTime)).map((row) => [row.id, row] as const)).values());
  const grossSales = payments.reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0);
  const refundTotal = refunds.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const feeTotal = fees.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const summary = {
    registrations: registrations.length,
    confirmed: registrations.filter((row) => row.status === 'confirmed').length,
    ...(financialAccess ? { gross_sales: grossSales, refunds: refundTotal, fees: feeTotal, net_revenue: grossSales - refundTotal - feeTotal } : {}),
  };
  return NextResponse.json({ events, summary, financial_access: financialAccess });
}
