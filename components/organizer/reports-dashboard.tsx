'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, CalendarDays, ChartNoAxesCombined, CircleDollarSign, ClipboardList, Coins, CreditCard, RotateCcw, Wallet } from 'lucide-react';
import { useRegistrationsHeader } from './registrations-header-context';

type CurrencyAmount = { currency: string; amount: number };
type EventReport = {
  id: string;
  name: string;
  capacity: number | null;
  registrations: number;
  confirmed: number;
  payments?: number;
  pending_payments?: number;
  refund_count?: number;
  fee_count?: number;
  financials?: { gross_sales: CurrencyAmount[]; refunds: CurrencyAmount[]; fees: CurrencyAmount[]; net_revenue: CurrencyAmount[] };
};
type ReportPayload = {
  events: Array<{ id: string; name: string }>;
  event_reports: EventReport[];
  summary: {
    registrations: number;
    confirmed: number;
    payments?: number;
    pending_payments?: number;
    refund_count?: number;
    fee_count?: number;
    gross_sales?: CurrencyAmount[];
    refunds?: CurrencyAmount[];
    fees?: CurrencyAmount[];
    net_revenue?: CurrencyAmount[];
  };
  financial_access: boolean;
  generated_at: string;
};

const currencyList = (items: CurrencyAmount[] | undefined, showZero = false) => {
  if (!items?.length) return showZero ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(0) : '—';
  return items.map(({ currency, amount }) => {
    try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  }).join(' · ');
};

type ReportsDashboardProps = { initialEventId: string; initialFrom: string; initialTo: string; initialPeriod: '12m' | 'custom' };
type SortKey = 'name' | 'registrations' | 'confirmed' | 'payments' | 'pending_payments';

function manilaDateString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function dateRangeFor(preset: '30d' | '90d' | '12m' | 'all') {
  if (preset === 'all') return { from: '', to: '' };
  const [year, month, day] = manilaDateString(new Date()).split('-').map(Number);
  if (preset === '12m') {
    const startYear = year - 1;
    const lastDay = new Date(Date.UTC(startYear, month, 0)).getUTCDate();
    return { from: `${startYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`, to: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
  }
  const end = new Date(Date.UTC(year, month - 1, day));
  end.setUTCDate(end.getUTCDate() - (preset === '30d' ? 29 : 89));
  const from = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
  return { from, to: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

const reportDate = (value: string | undefined) => {
  if (!value) return 'All time';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Invalid date' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(parsed);
};

export default function ReportsDashboard({ initialEventId, initialFrom, initialTo, initialPeriod }: ReportsDashboardProps) {
  const { setActions } = useRegistrationsHeader();
  const [eventId, setEventId] = useState(initialEventId);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [period, setPeriod] = useState<'30d' | '90d' | '12m' | 'all' | 'custom'>(initialPeriod);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [reloadKey, setReloadKey] = useState(0);
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (eventId) params.set('eventId', eventId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [eventId, from, to]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setLoading(true);
    setError('');
    void fetch(`/api/organizer/reports${query ? `?${query}` : ''}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? 'Report data could not be loaded.');
        return body as ReportPayload;
      })
      .then((body) => { if (active) setPayload(body); })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof DOMException && cause.name === 'AbortError'
          ? 'The report request timed out. Check your connection and try again.'
          : cause instanceof Error ? cause.message : 'Report data could not be loaded.');
      })
      .finally(() => { window.clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [query, reloadKey]);

  const clearEventFilter = () => setEventId('');
  const hasEventFilter = Boolean(eventId);
  const summary = payload?.summary;
  const cards = [
    { label: 'Registrations', value: summary?.registrations.toLocaleString() ?? '0', note: 'Registrations in the selected period', Icon: ClipboardList, financial: false },
    { label: 'Confirmed', value: summary?.confirmed.toLocaleString() ?? '0', note: 'Ready to participate', Icon: BadgeCheck, financial: false },
    { label: 'Payment attempts', value: summary?.payments?.toLocaleString() ?? '0', note: 'Recorded transactions in the selected period', Icon: CreditCard, financial: true },
    { label: 'Pending payments', value: summary?.pending_payments?.toLocaleString() ?? '0', note: 'Awaiting gateway confirmation', Icon: CalendarDays, financial: true },
    { label: 'Gross sales', value: summary ? currencyList(summary.gross_sales, true) : '—', note: 'Successful payments before refunds', Icon: CircleDollarSign, financial: true },
    { label: 'Refunds', value: summary ? currencyList(summary.refunds, true) : '—', note: `${summary?.refund_count?.toLocaleString() ?? 0} successful refund records`, Icon: RotateCcw, financial: true },
    { label: 'Recorded fees', value: summary ? currencyList(summary.fees, true) : '—', note: `${summary?.fee_count?.toLocaleString() ?? 0} platform fee records`, Icon: Coins, financial: true },
    { label: 'Net after refunds & fees', value: summary ? currencyList(summary.net_revenue, true) : '—', note: 'Gross sales less successful refunds and fees', Icon: Wallet, financial: true },
  ];

  const sortedEvents = useMemo(() => {
    const rows = [...(payload?.event_reports ?? [])];
    rows.sort((left, right) => {
      const a = left[sort.key];
      const b = right[sort.key];
      const comparison = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a) - Number(b);
      return sort.direction === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [payload?.event_reports, sort]);

  const toggleSort = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const selectPeriod = (value: string) => {
    const preset = value as '30d' | '90d' | '12m' | 'all';
    const range = dateRangeFor(preset);
    setPeriod(preset);
    setFrom(range.from);
    setTo(range.to);
  };
  const eventFilterName = payload?.events.find((event) => event.id === eventId)?.name;
  const reportPeriodLabel = !from && !to ? 'All time (Philippine time)' : `${reportDate(from || undefined)} – ${to ? reportDate(`${to}T12:00:00+08:00`) : 'Present'} (Philippine time)`;
  const sortHeader = (key: SortKey, label: string) => <th scope="col" aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3.5"><button type="button" onClick={() => toggleSort(key)} className="inline-flex min-h-8 items-center gap-1.5 text-left hover:text-[#0b2348] focus:outline-none focus:ring-2 focus:ring-orange-300">{label}<span aria-hidden="true">{sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>;

  const exportCsv = useCallback(async () => {
    setExporting(true);
    const params = new URLSearchParams(query);
    params.set('export', 'csv');
    try {
      const response = await fetch(`/api/organizer/reports?${params}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Report export failed.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'racedeck-organization-report.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Report exported as CSV.');
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Report export failed.'); }
    finally { setExporting(false); }
  }, [query, notify]);

  const refreshReports = useCallback(() => {
    setReloadKey((value) => value + 1);
    notify('Refreshing reports…');
  }, [notify]);

  useEffect(() => {
    setActions({
      onExport: () => { void exportCsv(); },
      onRefresh: refreshReports,
      exportDisabled: loading || exporting || !payload?.event_reports.length,
      refreshing: loading,
    });
    return () => setActions(null);
  }, [exportCsv, exporting, loading, payload, refreshReports, setActions]);

  return <main className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
    <section aria-label="Report filters" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_minmax(190px,0.9fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)_auto] sm:p-5">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Event<select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All events</option>{(payload?.events ?? []).map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Reporting period<select value={period} onChange={(event) => selectPeriod(event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="12m">Last 12 months</option><option value="all">All time</option><option value="custom" disabled>Custom dates</option></select></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">From<input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPeriod('custom'); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">To<input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPeriod('custom'); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1"><div className="pb-2 text-xs text-slate-500"><span>Asia/Manila dates</span><span className="block">Scope: {eventFilterName || 'All authorized events'} · {reportPeriodLabel}</span></div>{hasEventFilter && <button type="button" onClick={clearEventFilter} className="min-h-11 whitespace-nowrap text-sm font-bold text-orange-700 underline underline-offset-2">Clear event</button>}</div>
    </section>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="min-h-10 rounded-lg border border-red-300 bg-white px-3.5 font-bold text-red-800 hover:bg-red-50">Try again</button></div>}

    <section aria-label="Report summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.filter((card) => !card.financial || payload?.financial_access !== false).map(({ label, value, note, Icon }) => <article key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-sm font-semibold text-slate-600">{label}</h2><p className="mt-2 truncate text-2xl font-extrabold text-[#0b2348]" title={loading || error ? undefined : value}>{loading ? <span className="inline-block h-8 w-28 animate-pulse rounded bg-slate-100" /> : error ? '—' : value}</p></div><span className="shrink-0 rounded-lg bg-orange-50 p-2.5 text-orange-600"><Icon aria-hidden="true" size={19} /></span></div><p className="mt-2 text-xs text-slate-500">{note}</p></article>)}
    </section>

    {!payload?.financial_access && payload && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Financial totals are hidden for your account. Ask an organization owner to grant financial reporting access.</p>}

    <section aria-label="Event performance" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5"><div><h2 className="font-bold text-[#0b2348]">Event performance</h2><p className="mt-0.5 text-xs text-slate-500">Registration activity and financial results for the selected period.</p></div><Link href="/organizer/payments" className="text-sm font-bold text-[#0b2b5b] underline underline-offset-2 hover:text-orange-700">Open payment transactions</Link></div>
      {loading ? <div aria-label="Loading event reports" className="space-y-3 p-5">{[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div> : error ? <div className="p-10 text-center text-sm text-slate-600">Report data is unavailable until the connection is restored.</div> : !payload?.event_reports.length ? <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><ChartNoAxesCombined aria-hidden="true" size={22} /></span><p className="mt-3 text-sm font-semibold text-slate-700">No event report data yet</p><p className="mt-1 max-w-md text-sm text-slate-500">Events and activity will appear here when they are available in your organizer workspace.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1260px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr>{sortHeader('name', 'Event')}{sortHeader('registrations', 'Registrations')}{sortHeader('confirmed', 'Confirmed')}<th scope="col" className="px-4 py-3.5">Capacity</th>{payload.financial_access && <>{sortHeader('payments', 'Payments')}{sortHeader('pending_payments', 'Pending') }<th scope="col" className="px-4 py-3.5">Gross sales</th><th scope="col" className="px-4 py-3.5">Refunds</th><th scope="col" className="px-4 py-3.5">Fees</th><th scope="col" className="px-4 py-3.5">Net revenue</th></>}</tr></thead><tbody className="divide-y divide-slate-100">{sortedEvents.map((event) => <tr key={event.id} className="transition hover:bg-slate-50/70"><td className="max-w-64 px-4 py-3.5 font-semibold text-[#0b2348]">{event.name}</td><td className="px-4 py-3.5 tabular-nums">{event.registrations.toLocaleString()}</td><td className="px-4 py-3.5 tabular-nums">{event.confirmed.toLocaleString()}</td><td className="px-4 py-3.5 tabular-nums">{event.capacity == null ? 'Unlimited' : `${event.confirmed.toLocaleString()} / ${event.capacity.toLocaleString()}`}</td>{payload.financial_access && <><td className="px-4 py-3.5 tabular-nums">{(event.payments ?? 0).toLocaleString()}</td><td className="px-4 py-3.5 tabular-nums">{(event.pending_payments ?? 0).toLocaleString()}</td><td className="whitespace-nowrap px-4 py-3.5 font-semibold text-slate-800">{currencyList(event.financials?.gross_sales, true)}</td><td className="whitespace-nowrap px-4 py-3.5">{currencyList(event.financials?.refunds, true)}<span className="ml-1 text-xs text-slate-500">({event.refund_count ?? 0})</span></td><td className="whitespace-nowrap px-4 py-3.5">{currencyList(event.financials?.fees, true)}<span className="ml-1 text-xs text-slate-500">({event.fee_count ?? 0})</span></td><td className="whitespace-nowrap px-4 py-3.5 font-bold text-[#0b2348]">{currencyList(event.financials?.net_revenue, true)}</td></>}</tr>)}</tbody></table><div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>Amounts remain separated by currency; refunds and fee columns include their record counts.</span>{payload.generated_at && <span>Last updated {new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(payload.generated_at))}</span>}</div></div>}
    </section>

    {payload?.financial_access && <p className="text-xs text-slate-500"><RotateCcw className="mr-1 inline-block align-[-3px]" size={14} aria-hidden="true" />Net revenue is gross sales less successful refunds and recorded platform fees; it is not your payout.</p>}
    <div aria-live="polite" aria-atomic="true" className="fixed bottom-5 right-5 z-[120]">{toast && <p role="status" className="rounded-lg bg-[#0b2348] px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</p>}</div>
  </main>;
}
