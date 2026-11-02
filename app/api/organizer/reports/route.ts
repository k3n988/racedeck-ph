import { NextResponse } from 'next/server';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';

const successfulStatuses = new Set(['succeeded', 'partially_refunded', 'refunded']);
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
  }
}

function dateBoundary(value: string | null, endOfDay = false) {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const normalized = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (normalized.getUTCFullYear() !== Number(year) || normalized.getUTCMonth() + 1 !== Number(month) || normalized.getUTCDate() !== Number(day)) return undefined;
    const result = new Date(`${value}T00:00:00+08:00`);
    if (endOfDay) result.setTime(result.getTime() + 24 * 60 * 60 * 1000);
    return result;
  }
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? undefined : result;
}

function addCurrencyAmount(target: Map<string, number>, currency: unknown, amount: unknown) {
  const code = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'PHP';
  const cents = Math.round((Number(amount) || 0) * 100);
  target.set(code, (target.get(code) ?? 0) + cents);
}

function currencyBreakdown(amounts: Map<string, number>) {
  return Array.from(amounts, ([currency, cents]) => ({ currency, amount: cents / 100 })).sort((a, b) => a.currency.localeCompare(b.currency));
}

function currencyCodes(...amounts: Array<Map<string, number>>) {
  const codes: string[] = [];
  const seen = new Set<string>();
  amounts.forEach((map) => map.forEach((_amount, currency) => {
    if (!seen.has(currency)) {
      seen.add(currency);
      codes.push(currency);
    }
  }));
  return codes;
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export async function GET(request: Request) {
  const auth = await requireOrganizerPermission('view_reports');
  if ('response' in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const requestedEventId = params.get('eventId')?.trim() ?? '';
  const from = dateBoundary(params.get('from'));
  const to = dateBoundary(params.get('to'), true);
  if (from === undefined || to === undefined) return NextResponse.json({ error: 'Enter valid report dates.' }, { status: 400 });
  if (from && to && from >= to) return NextResponse.json({ error: 'The start date must be on or before the end date.' }, { status: 400 });

  const { data: allEvents, error: eventsError } = await auth.admin
    .from('events')
    .select('id,name,overall_capacity')
    .eq('organization_id', auth.membership.organization_id)
    .order('name');
  if (eventsError) {
    console.error('[Organizer reports] Loading events failed', eventsError);
    return NextResponse.json({ error: 'Reports could not be loaded.' }, { status: 500 });
  }

  const events = (allEvents ?? []).filter((event) =>
    (!auth.membership.restricted_event_ids || auth.membership.restricted_event_ids.includes(event.id)) &&
    (!requestedEventId || requestedEventId === event.id),
  );
  if (requestedEventId && events.length === 0) return NextResponse.json({ error: 'Event is outside your organization scope.' }, { status: 403 });

  const eventIds = events.map((event) => event.id);
  const financialAccess = auth.membership.permissions.includes('view_financials');
  const filterDates = <T extends { gte: (column: string, value: string) => T; lt: (column: string, value: string) => T }>(query: T) => {
    let filtered = query;
    if (from) filtered = filtered.gte('created_at', from.toISOString());
    if (to) filtered = filtered.lt('created_at', to.toISOString());
    return filtered;
  };

  const [registrationResult, paymentResult, refundResult, feeResult] = await Promise.all([
    eventIds.length ? fetchAllPages((start, end) => filterDates(
      auth.admin.from('registrations').select('id,event_id,status,created_at').in('event_id', eventIds).order('created_at', { ascending: true }).range(start, end),
    )) : Promise.resolve({ data: [], error: null }),
    financialAccess && eventIds.length ? fetchAllPages((start, end) => filterDates(
      auth.admin.from('payments').select('id,event_id,status,amount_paid,currency,created_at').in('event_id', eventIds).order('created_at', { ascending: true }).range(start, end),
    )) : Promise.resolve({ data: [], error: null }),
    financialAccess && eventIds.length ? fetchAllPages((start, end) => filterDates(
      auth.admin.from('refunds').select('id,event_id,status,amount,currency,created_at').in('event_id', eventIds).order('created_at', { ascending: true }).range(start, end),
    )) : Promise.resolve({ data: [], error: null }),
    financialAccess && eventIds.length ? fetchAllPages((start, end) => filterDates(
      auth.admin.from('platform_fees').select('id,event_id,status,amount,currency,created_at').in('event_id', eventIds).order('created_at', { ascending: true }).range(start, end),
    )) : Promise.resolve({ data: [], error: null }),
  ]);

  if (registrationResult.error || paymentResult.error || refundResult.error || feeResult.error) {
    console.error('[Organizer reports] Loading report data failed', registrationResult.error ?? paymentResult.error ?? refundResult.error ?? feeResult.error);
    return NextResponse.json({ error: 'Report data could not be loaded.' }, { status: 500 });
  }

  const registrations = registrationResult.data ?? [];
  const allPayments = paymentResult.data ?? [];
  const payments = allPayments.filter((row) => successfulStatuses.has(row.status));
  const refunds = (refundResult.data ?? []).filter((row) => row.status === 'succeeded');
  const fees = (feeResult.data ?? []).filter((row) => ['accrued', 'collected'].includes(row.status));
  const byEvent = new Map(events.map((event) => [event.id, {
    id: event.id,
    name: event.name,
    capacity: event.overall_capacity,
    registrations: 0,
    confirmed: 0,
    payments: 0,
    pending_payments: 0,
    refund_count: 0,
    fee_count: 0,
    grossByCurrency: new Map<string, number>(),
    refundsByCurrency: new Map<string, number>(),
    feesByCurrency: new Map<string, number>(),
  }]));

  for (const registration of registrations) {
    const report = byEvent.get(registration.event_id);
    if (!report) continue;
    report.registrations += 1;
    if (registration.status === 'confirmed') report.confirmed += 1;
  }
  for (const payment of allPayments) {
    const report = byEvent.get(payment.event_id);
    if (!report) continue;
    report.payments += 1;
    if (payment.status === 'pending' || payment.status === 'processing') report.pending_payments += 1;
    if (successfulStatuses.has(payment.status)) addCurrencyAmount(report.grossByCurrency, payment.currency, payment.amount_paid);
  }
  for (const refund of refunds) {
    const report = byEvent.get(refund.event_id);
    if (report) {
      report.refund_count += 1;
      addCurrencyAmount(report.refundsByCurrency, refund.currency, refund.amount);
    }
  }
  for (const fee of fees) {
    const report = byEvent.get(fee.event_id);
    if (report) {
      report.fee_count += 1;
      addCurrencyAmount(report.feesByCurrency, fee.currency, fee.amount);
    }
  }

  const eventReports = Array.from(byEvent.values()).map((report) => {
    const gross = new Map(report.grossByCurrency);
    const refundsByCurrency = new Map(report.refundsByCurrency);
    const feesByCurrency = new Map(report.feesByCurrency);
    const net = new Map<string, number>();
    currencyCodes(gross, refundsByCurrency, feesByCurrency).forEach((currency) => {
      net.set(currency, (gross.get(currency) ?? 0) - (refundsByCurrency.get(currency) ?? 0) - (feesByCurrency.get(currency) ?? 0));
    });
    return {
      id: report.id,
      name: report.name,
      capacity: report.capacity,
      registrations: report.registrations,
      confirmed: report.confirmed,
      ...(financialAccess ? {
        payments: report.payments,
        pending_payments: report.pending_payments,
        refund_count: report.refund_count,
        fee_count: report.fee_count,
        financials: {
          gross_sales: currencyBreakdown(gross),
          refunds: currencyBreakdown(refundsByCurrency),
          fees: currencyBreakdown(feesByCurrency),
          net_revenue: currencyBreakdown(net),
        },
      } : {}),
    };
  });

  const summaryGross = new Map<string, number>();
  const summaryRefunds = new Map<string, number>();
  const summaryFees = new Map<string, number>();
  for (const payment of payments) addCurrencyAmount(summaryGross, payment.currency, payment.amount_paid);
  for (const refund of refunds) addCurrencyAmount(summaryRefunds, refund.currency, refund.amount);
  for (const fee of fees) addCurrencyAmount(summaryFees, fee.currency, fee.amount);
  const summaryNet = new Map<string, number>();
  currencyCodes(summaryGross, summaryRefunds, summaryFees).forEach((currency) => {
    summaryNet.set(currency, (summaryGross.get(currency) ?? 0) - (summaryRefunds.get(currency) ?? 0) - (summaryFees.get(currency) ?? 0));
  });

  const summary = {
    registrations: registrations.length,
    confirmed: registrations.filter((row) => row.status === 'confirmed').length,
    ...(financialAccess ? {
      payments: allPayments.length,
      pending_payments: allPayments.filter((row) => row.status === 'pending' || row.status === 'processing').length,
      refund_count: refunds.length,
      fee_count: fees.length,
      gross_sales: currencyBreakdown(summaryGross),
      refunds: currencyBreakdown(summaryRefunds),
      fees: currencyBreakdown(summaryFees),
      net_revenue: currencyBreakdown(summaryNet),
    } : {}),
  };

  if (params.get('export') === 'csv') {
    const headers = ['Event', 'Registrations', 'Confirmed', 'Capacity'];
    if (financialAccess) headers.push('Payments', 'Pending payments', 'Refund records', 'Fee records', 'Gross sales', 'Refunds', 'Fees', 'Net revenue');
    const formatBreakdown = (items: Array<{ currency: string; amount: number }> | undefined) => (items ?? []).map((item) => `${item.currency} ${item.amount.toFixed(2)}`).join(' | ');
    const rows = eventReports.map((event) => {
      const row: Array<string | number> = [event.name, event.registrations, event.confirmed, event.capacity ?? 'Unlimited'];
      if (financialAccess && event.financials) row.push(event.payments ?? 0, event.pending_payments ?? 0, event.refund_count ?? 0, event.fee_count ?? 0, formatBreakdown(event.financials.gross_sales), formatBreakdown(event.financials.refunds), formatBreakdown(event.financials.fees), formatBreakdown(event.financials.net_revenue));
      return row;
    });
    const dateRange = `Period: ${params.get('from') || 'All time'} to ${params.get('to') || 'Present'} (Asia/Manila)`;
    const csv = [[dateRange], headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    return new NextResponse(`\uFEFF${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="racedeck-organization-report.csv"', 'Cache-Control': 'private, no-store' } });
  }

  return NextResponse.json({
    events,
    event_reports: eventReports,
    summary,
    financial_access: financialAccess,
    date_range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    generated_at: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
