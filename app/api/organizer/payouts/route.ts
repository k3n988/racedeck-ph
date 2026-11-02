import { NextResponse } from 'next/server';
import { requireOrganizerPermission } from '@/lib/auth/organizer-access';

const FETCH_PAGE_SIZE = 1000;
const PAGE_SIZE = 20;
const PAYOUT_STATUSES = new Set(['pending', 'processing', 'paid', 'failed', 'cancelled']);
type PayoutRow = {
  id: string; payout_reference: string; status: string; currency: string; gross_registration_sales: number;
  refunds_deducted: number; platform_fees_deducted: number; processing_fees_deducted: number;
  other_adjustments: number; net_payout_amount: number; payout_period_start: string | null;
  payout_period_end: string | null; payout_account_reference: string; reconciliation_id: string | null;
  external_reference: string | null; failure_reason: string | null; initiated_at: string; paid_at: string | null;
};

async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + FETCH_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < FETCH_PAGE_SIZE) return { data: rows, error: null };
  }
}

function parseDate(value: string | null) {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const normalized = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (normalized.getUTCFullYear() !== Number(year) || normalized.getUTCMonth() + 1 !== Number(month) || normalized.getUTCDate() !== Number(day)) return undefined;
    return new Date(`${value}T00:00:00+08:00`);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const toCents = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};
const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
const maskedAccountReference = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `${'•'.repeat(Math.min(8, Math.max(4, trimmed.length - 4)))}${trimmed.slice(-4)}`;
};

export async function GET(request: Request) {
  const auth = await requireOrganizerPermission('view_financials');
  if ('response' in auth) return auth.response;
  if (auth.membership.restricted_event_ids) {
    return NextResponse.json({ error: 'Payout access requires an unrestricted organization finance scope.' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const status = (params.get('status') ?? '').trim();
  const from = parseDate(params.get('from'));
  const to = parseDate(params.get('to'));
  const search = (params.get('search') ?? '').trim().slice(0, 120).toLocaleLowerCase();
  if (from === undefined || to === undefined) return NextResponse.json({ error: 'Enter a valid date range.' }, { status: 400 });
  if (from && to && from > to) return NextResponse.json({ error: 'The start date must be on or before the end date.' }, { status: 400 });
  if (status && !PAYOUT_STATUSES.has(status)) return NextResponse.json({ error: 'Choose a valid payout status.' }, { status: 400 });

  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get('pageSize') ?? String(PAGE_SIZE), 10) || PAGE_SIZE));
  const exportCsv = params.get('export') === 'csv';
  const result = await fetchAllPages((offset, end) => {
    let query = auth.admin.from('payouts')
      .select('id,payout_reference,status,currency,gross_registration_sales,refunds_deducted,platform_fees_deducted,processing_fees_deducted,other_adjustments,net_payout_amount,payout_period_start,payout_period_end,payout_account_reference,reconciliation_id,external_reference,failure_reason,initiated_at,paid_at')
      .eq('organization_id', auth.membership.organization_id)
      .order('initiated_at', { ascending: false })
      .range(offset, end);
    if (from) query = query.gte('initiated_at', from.toISOString());
    if (to) query = query.lt('initiated_at', new Date(to.getTime() + 24 * 60 * 60 * 1000).toISOString());
    return query;
  });
  if (result.error) {
    console.error('[Organizer payouts] Loading payout records failed', result.error);
    return NextResponse.json({ error: 'Payouts could not be loaded.' }, { status: 500 });
  }

  const allRows = (result.data ?? []) as unknown as PayoutRow[];
  const filtered = allRows.filter((payout) => {
    if (status && payout.status !== status) return false;
    if (!search) return true;
    return [payout.payout_reference, payout.external_reference].filter(Boolean).join(' ').toLocaleLowerCase().includes(search);
  });

  const currencyTotals = filtered.reduce<Record<string, { paid_out_cents: number; pending_cents: number; records: number }>>((totals, payout) => {
    const item = totals[payout.currency] ??= { paid_out_cents: 0, pending_cents: 0, records: 0 };
    item.records += 1;
    if (payout.status === 'paid') item.paid_out_cents += toCents(payout.net_payout_amount);
    if (payout.status === 'pending' || payout.status === 'processing') item.pending_cents += toCents(payout.net_payout_amount);
    return totals;
  }, {});
  const summary = Object.fromEntries(Object.entries(currencyTotals).map(([currency, values]) => [currency, {
    total_paid_out: values.paid_out_cents / 100,
    pending_processing: values.pending_cents / 100,
    records: values.records,
  }]));

  if (exportCsv) {
    const headers = ['Payout reference', 'External reference', 'Status', 'Currency', 'Period start', 'Period end', 'Gross sales', 'Refunds deducted', 'Platform fees deducted', 'Processing fees deducted', 'Other adjustments', 'Net payout', 'Initiated at', 'Paid at'];
    const rows = filtered.map((payout) => [payout.payout_reference, payout.external_reference, payout.status, payout.currency, payout.payout_period_start, payout.payout_period_end, payout.gross_registration_sales, payout.refunds_deducted, payout.platform_fees_deducted, payout.processing_fees_deducted, payout.other_adjustments, payout.net_payout_amount, payout.initiated_at, payout.paid_at]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    return new NextResponse(`\uFEFF${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="racedeck-payouts.csv"', 'Cache-Control': 'private, no-store' } });
  }

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const reconciliationIds = Array.from(new Set(pageRows.map((payout) => payout.reconciliation_id).filter((id): id is string => Boolean(id))));
  const reconciliationResult = reconciliationIds.length
    ? await auth.admin.from('finance_reconciliation_records')
      .select('id,reconciliation_reference,status,discrepancy_status,organizer_payable_amount,payouts_sent_amount,remaining_payable_amount,discrepancy_amount,reconciled_at')
      .eq('organization_id', auth.membership.organization_id)
      .in('id', reconciliationIds)
    : { data: [], error: null };
  if (reconciliationResult.error) {
    console.error('[Organizer payouts] Loading reconciliation details failed', reconciliationResult.error);
    return NextResponse.json({ error: 'Payout reconciliation details could not be loaded.' }, { status: 500 });
  }
  const reconciliationById = new Map((reconciliationResult.data ?? []).map((row) => [row.id, row]));
  const canManagePayoutAccounts = auth.membership.role === 'owner' || auth.membership.permissions.includes('manage_payout_accounts');
  return NextResponse.json({
    payouts: pageRows.map((payout) => {
      const reconciliation = payout.reconciliation_id ? reconciliationById.get(payout.reconciliation_id) : null;
      return {
        ...payout,
        payout_account_reference: undefined,
        masked_payout_account_reference: maskedAccountReference(payout.payout_account_reference),
        reconciliation: reconciliation ? {
          reference: reconciliation.reconciliation_reference,
          status: reconciliation.status,
          discrepancy_status: reconciliation.discrepancy_status,
          organizer_payable_amount: reconciliation.organizer_payable_amount,
          payouts_sent_amount: reconciliation.payouts_sent_amount,
          remaining_payable_amount: reconciliation.remaining_payable_amount,
          discrepancy_amount: reconciliation.discrepancy_amount,
          reconciled_at: reconciliation.reconciled_at,
        } : null,
      };
    }),
    summary,
    pagination: { page, page_size: pageSize, total, page_count: Math.max(1, Math.ceil(total / pageSize)) },
    can_manage_payout_accounts: canManagePayoutAccounts,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
