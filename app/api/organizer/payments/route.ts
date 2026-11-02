import { NextResponse } from 'next/server';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';
import { organizerAllocation, summarizeOrganizerPayments } from '@/lib/payments/organizer-payment-calculations';

const PAGE_SIZE_MAX = 100;
const PAGE_SIZE_FETCH = 1000;
const VALID_STATUSES = new Set(['pending', 'processing', 'succeeded', 'partially_refunded', 'refunded', 'failed', 'expired', 'cancelled']);

async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE_FETCH) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE_FETCH - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE_FETCH) return { data: rows, error: null };
  }
}

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

function validDate(value: string | null) {
  if (!value) return null;
  // Date controls are calendar dates in the Philippines, not UTC dates.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const normalized = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (normalized.getUTCFullYear() !== Number(year) || normalized.getUTCMonth() + 1 !== Number(month) || normalized.getUTCDate() !== Number(day)) return undefined;
  }
  const date = dateOnly ? new Date(`${value}T00:00:00+08:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request) {
  const auth = await requireOrganizerPermission('view_financials');
  if ('response' in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const eventFilter = params.get('eventId')?.trim() ?? '';
  const statusFilter = params.get('status')?.trim() ?? '';
  const search = (params.get('search') ?? '').trim().slice(0, 120).toLocaleLowerCase();
  const fromDate = validDate(params.get('from'));
  const toDate = validDate(params.get('to'));
  if (fromDate === undefined || toDate === undefined) return NextResponse.json({ error: 'Enter a valid date range.' }, { status: 400 });
  if (fromDate && toDate && fromDate > toDate) return NextResponse.json({ error: 'The start date must be on or before the end date.' }, { status: 400 });
  if (statusFilter && !VALID_STATUSES.has(statusFilter)) return NextResponse.json({ error: 'Choose a valid payment status.' }, { status: 400 });

  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(params.get('pageSize') ?? '20', 10) || 20));
  const exportCsv = params.get('export') === 'csv';
  const canViewParticipantInfo = auth.membership.permissions.includes('view_participant_info');

  const { data: allEvents, error: eventError } = await auth.admin
    .from('events').select('id,name').eq('organization_id', auth.membership.organization_id).order('name');
  if (eventError) return NextResponse.json({ error: 'Events could not be loaded.' }, { status: 500 });

  const events = (allEvents ?? []).filter((event) => !auth.membership.restricted_event_ids || auth.membership.restricted_event_ids.includes(event.id));
  const eventIds = events.filter((event) => !eventFilter || event.id === eventFilter).map((event) => event.id);
  if (eventFilter && eventIds.length === 0) return NextResponse.json({ error: 'Event is outside your organization scope.' }, { status: 403 });

  const registrationFields = canViewParticipantInfo
    ? 'registration_number,first_name,last_name,email,race_categories(name)'
    : 'registration_number,race_categories(name)';
  const paymentFields = `id,event_id,registration_id,status,amount_due,amount_paid,amount_refunded,currency,gateway,gateway_payment_id,paid_at,created_at,metadata,registrations(${registrationFields}),events(name)`;
  const paymentResult = eventIds.length ? await fetchAllPages((from, to) => {
    let query = auth.admin.from('payments').select(paymentFields).in('event_id', eventIds).order('created_at', { ascending: false }).range(from, to);
    if (fromDate) query = query.gte('created_at', fromDate.toISOString());
    if (toDate) query = query.lt('created_at', new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString());
    return query;
  }) : { data: [], error: null };

  const { data: paymentData, error } = paymentResult;
  if (error) {
    console.error('[Organizer payments] Loading payment transactions failed', error);
    return NextResponse.json({ error: 'Payment transactions could not be loaded.' }, { status: 500 });
  }

  const eventNames = new Map(events.map((event) => [event.id, event.name]));
  const payments = (paymentData ?? []) as unknown as Array<Record<string, unknown>>;
  const summary = summarizeOrganizerPayments(payments as unknown as Parameters<typeof summarizeOrganizerPayments>[0]);

  const filtered = payments.filter((payment) => {
    if (statusFilter && payment.status !== statusFilter) return false;
    if (!search) return true;
    const registration = asRecord(payment.registrations);
    const categoryValue = registration.race_categories;
    const category = Array.isArray(categoryValue) ? asRecord(categoryValue[0]) : asRecord(categoryValue);
    const haystack = [
      canViewParticipantInfo ? registration.first_name : '',
      canViewParticipantInfo ? registration.last_name : '',
      canViewParticipantInfo ? registration.email : '',
      registration.registration_number,
      payment.id,
      payment.gateway_payment_id,
      eventNames.get(String(payment.event_id)),
      category.name,
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(search);
  });

  if (exportCsv) {
    const headers = ['Participant', 'Email', 'Registration reference', 'Event', 'Category', 'Amount paid', 'Organizer allocation', 'Method', 'Status', 'Checkout reference', 'Date'];
    const rows = filtered.map((payment) => {
      const registration = asRecord(payment.registrations);
      const categoryValue = registration.race_categories;
      const category = Array.isArray(categoryValue) ? asRecord(categoryValue[0]) : asRecord(categoryValue);
      const metadata = asRecord(payment.metadata);
      const participant = canViewParticipantInfo ? `${registration.first_name ?? ''} ${registration.last_name ?? ''}`.trim() : 'Restricted';
      return [participant, canViewParticipantInfo ? registration.email : '', registration.registration_number, eventNames.get(String(payment.event_id)), category.name, payment.amount_paid, organizerAllocation(payment as Parameters<typeof organizerAllocation>[0]), metadata.payment_method ?? '', payment.status, payment.gateway_payment_id, payment.paid_at ?? payment.created_at];
    });
    const body = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    return new NextResponse(`\uFEFF${body}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="racedeck-payments.csv"', 'Cache-Control': 'private, no-store' } });
  }

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const paymentIds = pageRows.map((payment) => String(payment.id));
  const refundsResult = paymentIds.length
    ? await auth.admin.from('refunds').select('id,payment_id,status,amount,currency,gateway_refund_id,processed_at,created_at').in('payment_id', paymentIds).order('created_at', { ascending: false })
    : { data: [], error: null };
  const receiptsResult = paymentIds.length
    ? await auth.admin.from('payment_receipts').select('payment_id,registration_amount,processing_fee,platform_fee,discount_amount,total_paid,payment_method,gateway_transaction_reference,payment_date').in('payment_id', paymentIds)
    : { data: [], error: null };
  const transactionsResult = paymentIds.length
    ? await auth.admin.from('payment_transactions').select('payment_id,gateway_transaction_id,transaction_type,created_at').in('payment_id', paymentIds).eq('transaction_type', 'payment').order('created_at', { ascending: false })
    : { data: [], error: null };
  if (refundsResult.error || receiptsResult.error || transactionsResult.error) {
    console.error('[Organizer payments] Loading payment details failed', refundsResult.error ?? receiptsResult.error ?? transactionsResult.error);
    return NextResponse.json({ error: 'Payment details could not be loaded.' }, { status: 500 });
  }

  const receiptByPayment = new Map((receiptsResult.data ?? []).map((receipt) => [receipt.payment_id, receipt]));
  const transactionReferenceByPayment = new Map<string, string>();
  for (const transaction of transactionsResult.data ?? []) {
    if (transaction.gateway_transaction_id && !transactionReferenceByPayment.has(transaction.payment_id)) transactionReferenceByPayment.set(transaction.payment_id, transaction.gateway_transaction_id);
  }
  const paymentRows = pageRows.map((payment) => {
    const receipt = receiptByPayment.get(String(payment.id));
    const registration = asRecord(payment.registrations);
    const categoryValue = registration.race_categories;
    const category = Array.isArray(categoryValue) ? asRecord(categoryValue[0]) : asRecord(categoryValue);
    const metadata = asRecord(payment.metadata);
    const participant = canViewParticipantInfo
      ? { name: `${registration.first_name ?? ''} ${registration.last_name ?? ''}`.trim() || null, email: registration.email ?? null }
      : null;
    return {
      ...payment,
      participant,
      registration_number: registration.registration_number ?? null,
      category_name: category.name ?? null,
      event_name: eventNames.get(String(payment.event_id)) ?? null,
      payment_method: metadata.payment_method ?? receipt?.payment_method ?? null,
      pricing: {
        registration_amount: receipt?.registration_amount ?? metadata.registration_amount ?? payment.amount_due,
        processing_fee: receipt?.processing_fee ?? metadata.processing_fee ?? null,
        platform_fee: receipt?.platform_fee ?? metadata.platform_fee ?? null,
        discount_amount: receipt?.discount_amount ?? metadata.discount_amount ?? null,
        total_paid: receipt?.total_paid ?? payment.amount_paid,
        organizer_allocation: organizerAllocation(payment as Parameters<typeof organizerAllocation>[0]),
      },
      gateway_transaction_reference: transactionReferenceByPayment.get(String(payment.id)) ?? receipt?.gateway_transaction_reference ?? payment.gateway_payment_id ?? null,
      refunds: (refundsResult.data ?? []).filter((refund) => refund.payment_id === payment.id),
    };
  });

  return NextResponse.json({
    events,
    payments: paymentRows,
    summary,
    pagination: { page, page_size: pageSize, total, page_count: Math.max(1, Math.ceil(total / pageSize)) },
    can_view_participant_info: canViewParticipantInfo,
    date_range: { from: fromDate?.toISOString() ?? null, to: toDate?.toISOString() ?? null },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
