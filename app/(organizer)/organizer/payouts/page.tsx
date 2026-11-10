'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, FileSearch, Search, WalletCards, X } from 'lucide-react';
import { useRegistrationsHeader } from '@/components/organizer/registrations-header-context';

type Reconciliation = {
  reference: string; status: string; discrepancy_status: string; organizer_payable_amount: number;
  payouts_sent_amount: number; remaining_payable_amount: number; discrepancy_amount: number; reconciled_at: string | null;
};
type Payout = {
  id: string; payout_reference: string; status: string; currency: string; gross_registration_sales: number;
  refunds_deducted: number; platform_fees_deducted: number; processing_fees_deducted: number;
  other_adjustments: number; net_payout_amount: number; payout_period_start: string | null;
  payout_period_end: string | null; masked_payout_account_reference: string | null;
  external_reference: string | null; failure_reason: string | null; initiated_at: string; paid_at: string | null;
  reconciliation: Reconciliation | null;
};
type CurrencySummary = Record<string, { total_paid_out: number; pending_processing: number; records: number }>;
type Payload = {
  payouts: Payout[]; summary: CurrencySummary;
  pagination: { page: number; page_size: number; total: number; page_count: number };
  can_manage_payout_accounts: boolean;
};

const PAGE_SIZE = 20;
const statuses = [['pending', 'Pending'], ['processing', 'Processing'], ['paid', 'Paid'], ['failed', 'Failed'], ['cancelled', 'Cancelled']];
const statusLabel = (value: string) => statuses.find(([key]) => key === value)?.[1] ?? value;
const statusClass = (value: string) => value === 'paid'
  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
  : value === 'failed' ? 'border-red-200 bg-red-50 text-red-800'
    : value === 'cancelled' ? 'border-slate-200 bg-slate-100 text-slate-700'
      : value === 'processing' ? 'border-blue-200 bg-blue-50 text-blue-800'
        : 'border-amber-200 bg-amber-50 text-amber-800';
const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(amount) || 0); }
  catch { return `${currency} ${(Number(amount) || 0).toFixed(2)}`; }
};
const date = (value: string | null) => value
  ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
  : '—';

export default function PayoutsPage() {
  const { setActions } = useRegistrationsHeader();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Payout | null>(null);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (debouncedSearch) params.set('search', debouncedSearch);
    setLoading(true);
    setError('');
    void fetch(`/api/organizer/payouts?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? 'Payouts could not be loaded.');
        return body as Payload;
      })
      .then((body) => { if (active) setPayload(body); })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof DOMException && cause.name === 'AbortError'
          ? 'The payout request timed out. Check your connection and try again.'
          : cause instanceof Error ? cause.message : 'Payouts could not be loaded.');
      })
      .finally(() => { window.clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [status, from, to, debouncedSearch, page, reload]);

  useEffect(() => {
    if (!selected) { openerRef.current?.focus(); return; }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [selected]);

  useEffect(() => {
    if (payload && page > payload.pagination.page_count) setPage(payload.pagination.page_count);
  }, [payload, page]);

  const filtersActive = Boolean(status || from || to || search.trim());
  const summaryEntries = Object.entries(payload?.summary ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const clearFilters = () => { setStatus(''); setFrom(''); setTo(''); setSearch(''); setPage(1); };
  const firstRow = payload?.pagination.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(page * PAGE_SIZE, payload?.pagination.total ?? 0);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    const params = new URLSearchParams({ export: 'csv' });
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search.trim()) params.set('search', search.trim());
    try {
      const response = await fetch(`/api/organizer/payouts?${params}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Payout export failed.');
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'racedeck-payouts.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Payout CSV exported.');
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Payout export failed.'); }
    finally { setExporting(false); }
  }, [status, from, to, search, notify]);

  const refreshPayouts = useCallback(() => {
    setReload((value) => value + 1);
    notify('Refreshing payout history…');
  }, [notify]);

  useEffect(() => {
    setActions({
      onExport: () => void exportCsv(),
      onRefresh: refreshPayouts,
      exportDisabled: loading || exporting || !payload?.pagination.total,
      refreshing: loading,
    });
    return () => setActions(null);
  }, [setActions, exportCsv, refreshPayouts, loading, exporting, payload?.pagination.total]);

  const summaryCards = [
    { title: 'Total paid out', icon: CircleDollarSign, key: 'total_paid_out' as const },
    { title: 'Pending / processing', icon: Clock3, key: 'pending_processing' as const },
  ];

  return <main className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => setReload((value) => value + 1)} className="min-h-10 rounded-lg border border-red-300 bg-white px-3.5 font-bold text-red-800 hover:bg-red-50">Try again</button></div>}

    <section aria-label="Payout summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {summaryCards.map(({ title, icon: Icon, key }) => <article key={title} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-sm font-semibold text-slate-600">{title}</h2>{loading ? <span className="mt-3 inline-block h-8 w-28 animate-pulse rounded bg-slate-100" /> : error ? <p className="mt-2 text-2xl font-extrabold text-[#0b2348]">—</p> : summaryEntries.length ? <div className="mt-2 space-y-1">{summaryEntries.map(([currency, values]) => <p key={currency} className="truncate text-xl font-extrabold text-[#0b2348]">{money(values[key], currency)}</p>)}</div> : <p className="mt-2 text-2xl font-extrabold text-[#0b2348]">{money(0, 'PHP')}</p>}</div><span className="shrink-0 rounded-lg bg-orange-50 p-2.5 text-orange-600"><Icon size={19} aria-hidden="true" /></span></div>
        <p className="mt-2 text-xs text-slate-500">{filtersActive ? 'For the selected filters' : 'For your organization'}</p>
      </article>)}
      <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-600">Payout records</h2><p className="mt-2 text-2xl font-extrabold text-[#0b2348]">{loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-slate-100" /> : error ? '—' : (payload?.pagination.total ?? 0).toLocaleString()}</p></div><span className="rounded-lg bg-orange-50 p-2.5 text-orange-600"><WalletCards size={19} aria-hidden="true" /></span></div><p className="mt-2 text-xs text-slate-500">Matching payout records</p></article>
    </section>

    <section aria-label="Payout history" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5"><div><h2 className="font-bold text-[#0b2348]">Payout history</h2><p className="mt-0.5 text-xs text-slate-500">Summary cards and rows follow the selected filters.</p></div><span aria-live="polite" className="text-sm text-slate-500">{loading ? 'Loading…' : `${(payload?.pagination.total ?? 0).toLocaleString()} records`}</span></div>
      <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.5fr_auto] sm:px-5">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All statuses</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">From<input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">To<input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Search payout reference<span className="relative mt-1.5 block"><Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Payout or external reference" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></span></label>
        {filtersActive && <div className="flex items-end"><button type="button" onClick={clearFilters} className="min-h-11 px-2 text-sm font-semibold text-orange-700 underline underline-offset-2">Clear filters</button></div>}
      </div>

      {error ? <div className="p-10 text-center text-sm text-slate-600">Payout history is unavailable until the connection is restored.</div> : loading ? <div aria-label="Loading payout records" className="space-y-3 p-5">{[0, 1, 2, 3, 4].map((index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div> : <>
        <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-4 py-3">Payout</th><th scope="col" className="px-4 py-3">Period</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3 text-right">Gross sales</th><th scope="col" className="px-4 py-3">Deductions</th><th scope="col" className="px-4 py-3 text-right">Net payout</th><th scope="col" className="px-4 py-3">Paid</th><th scope="col" className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
          {payload?.payouts.length ? payload.payouts.map((payout) => <tr key={payout.id} className="align-top transition hover:bg-slate-50/70"><td className="px-4 py-3.5"><p className="font-semibold text-[#0b2348]">{payout.payout_reference}</p>{payout.external_reference && <p className="mt-1 max-w-48 truncate text-xs text-slate-500" title={payout.external_reference}>Ref. {payout.external_reference}</p>}</td><td className="px-4 py-3.5 text-slate-700"><p>{date(payout.payout_period_start)}</p><p className="mt-1">to {date(payout.payout_period_end)}</p></td><td className="px-4 py-3.5"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(payout.status)}`}>{statusLabel(payout.status)}</span></td><td className="whitespace-nowrap px-4 py-3.5 text-right font-medium">{money(payout.gross_registration_sales, payout.currency)}</td><td className="px-4 py-3.5 text-slate-600"><p>Refunds {money(payout.refunds_deducted, payout.currency)}</p><p className="mt-1">Fees {money(Number(payout.platform_fees_deducted) + Number(payout.processing_fees_deducted), payout.currency)}</p>{Number(payout.other_adjustments) !== 0 && <p className="mt-1">Other {money(payout.other_adjustments, payout.currency)}</p>}</td><td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-[#0b2348]">{money(payout.net_payout_amount, payout.currency)}</td><td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{payout.paid_at ? date(payout.paid_at) : '—'}</td><td className="px-4 py-3.5 text-right"><button type="button" onClick={(event) => { openerRef.current = event.currentTarget; setSelected(payout); }} className="min-h-9 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#0b2b5b] hover:border-orange-300 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-200">View details</button></td></tr>) : <tr><td colSpan={8} className="px-4 py-14"><div className="mx-auto flex max-w-sm flex-col items-center text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><FileSearch size={22} aria-hidden="true" /></span><p className="mt-3 font-semibold text-slate-700">{filtersActive ? 'No payouts match these filters' : 'No payout records yet'}</p><p className="mt-1 text-sm text-slate-500">{filtersActive ? 'Try a different status, date range, or reference.' : 'Payout records will appear here after they are recorded for your organization.'}</p>{filtersActive ? <button type="button" onClick={clearFilters} className="mt-4 rounded-lg bg-[#0b2b5b] px-4 py-2 text-sm font-bold text-white">Clear filters</button> : payload?.can_manage_payout_accounts && <Link href="/organizer/payment-profiles" className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700">Manage payout account</Link>}</div></td></tr>}
        </tbody></table></div>
        {!!payload?.pagination.total && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3.5 sm:px-5"><p className="text-xs text-slate-500">Showing {firstRow}–{lastRow} of {payload.pagination.total.toLocaleString()}</p><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-40"><ChevronLeft size={15} aria-hidden="true" />Previous</button><span aria-live="polite" className="px-2 text-sm text-slate-600">Page {page} of {payload.pagination.page_count}</span><button type="button" onClick={() => setPage((current) => Math.min(payload.pagination.page_count, current + 1))} disabled={page >= payload.pagination.page_count} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-40">Next<ChevronRight size={15} aria-hidden="true" /></button></div></footer>}
      </>}
    </section>

    {selected && <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside role="dialog" aria-modal="true" aria-labelledby="payout-detail-title" className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">Payout details</p><h2 id="payout-detail-title" className="mt-1 text-xl font-extrabold text-[#0b2348]">{selected.payout_reference}</h2><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span></div><button ref={closeButtonRef} type="button" aria-label="Close payout details" onClick={() => setSelected(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><X size={19} /></button></header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        <section><h3 className="text-sm font-bold text-[#0b2348]">Payout summary</h3><dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4"><DetailRow label="Payout period" value={`${date(selected.payout_period_start)} – ${date(selected.payout_period_end)}`} Icon={CalendarDays} /><DetailRow label="Gross sales" value={money(selected.gross_registration_sales, selected.currency)} /><DetailRow label="Refunds deducted" value={money(selected.refunds_deducted, selected.currency)} /><DetailRow label="RaceDeck fees" value={money(Number(selected.platform_fees_deducted) + Number(selected.processing_fees_deducted), selected.currency)} /><DetailRow label="Other adjustments" value={money(selected.other_adjustments, selected.currency)} /><DetailRow label="Net payout" value={money(selected.net_payout_amount, selected.currency)} /><DetailRow label="Initiated" value={date(selected.initiated_at)} /><DetailRow label="Paid" value={date(selected.paid_at)} /></dl></section>
        <section><h3 className="text-sm font-bold text-[#0b2348]">References</h3><dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4"><DetailRow label="External reference" value={selected.external_reference || 'Not recorded'} /><DetailRow label="Payout destination" value={selected.masked_payout_account_reference || 'Not recorded'} /></dl></section>
        {selected.failure_reason && <section><h3 className="flex items-center gap-2 text-sm font-bold text-red-800"><AlertCircle size={16} aria-hidden="true" />Failure reason</h3><p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{selected.failure_reason}</p></section>}
        <section><h3 className="text-sm font-bold text-[#0b2348]">Reconciliation</h3>{selected.reconciliation ? <div className="mt-3 rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-800">{selected.reconciliation.reference}</p><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${selected.reconciliation.status === 'reviewed' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{selected.reconciliation.status === 'reviewed' && <CheckCircle2 size={13} aria-hidden="true" />}{selected.reconciliation.status}</span></div>{selected.reconciliation.status === 'reviewed' ? <dl className="mt-2 divide-y divide-slate-100"> <DetailRow label="Organizer payable" value={money(selected.reconciliation.organizer_payable_amount, selected.currency)} /><DetailRow label="Payouts sent" value={money(selected.reconciliation.payouts_sent_amount, selected.currency)} /><DetailRow label="Remaining payable" value={money(selected.reconciliation.remaining_payable_amount, selected.currency)} /><DetailRow label="Discrepancy" value={`${money(selected.reconciliation.discrepancy_amount, selected.currency)} · ${selected.reconciliation.discrepancy_status}`} /><DetailRow label="Reconciled" value={date(selected.reconciliation.reconciled_at)} /></dl> : <p className="mt-2 text-sm leading-6 text-slate-600">Reconciliation figures are hidden until finance review is complete.</p>}</div> : <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">No reconciliation record is linked to this payout.</p>}</section>
      </div>
    </aside></div>}
    <div aria-live="polite" aria-atomic="true" className="fixed bottom-5 right-5 z-[120]">{toast && <p role="status" className="rounded-lg bg-[#0b2348] px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</p>}</div>
  </main>;
}

function DetailRow({ label, value, Icon }: { label: string; value: string; Icon?: typeof CalendarDays }) {
  return <div className="flex items-start justify-between gap-4 py-3"><dt className="flex min-w-0 items-center gap-2 text-sm text-slate-500">{Icon && <Icon size={15} aria-hidden="true" className="shrink-0 text-slate-400" />}{label}</dt><dd className="max-w-[62%] break-words text-right text-sm font-semibold text-slate-800">{value}</dd></div>;
}
