'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, CalendarDays, Check, CircleDollarSign, ClipboardList, CreditCard, Mail, Search, UsersRound, Wallet, X } from 'lucide-react';
import { useRegistrationsHeader } from '@/components/organizer/registrations-header-context';

type EventOption = { id: string; name: string };
type Refund = { id: string; status: string; amount: number; currency: string; gateway_refund_id?: string | null; processed_at?: string | null; created_at: string };
type Payment = {
  id: string; event_id: string; registration_id: string; registration_number: string | null; category_name: string | null;
  event_name: string | null; status: string; amount_due: number; amount_paid: number; amount_refunded: number;
  currency: string; gateway: string; gateway_payment_id?: string | null; gateway_transaction_reference?: string | null;
  paid_at: string | null; created_at: string; payment_method: string | null;
  participant: { name: string | null; email: string | null } | null;
  pricing: { registration_amount: number | string | null; processing_fee: number | string | null; platform_fee: number | string | null; discount_amount: number | string | null; total_paid: number | string | null; organizer_allocation: number };
  refunds: Refund[];
};
type Summary = { total_collected: number; organizer_revenue: number; successful_payments: number; pending_payments: number; refunded_amount: number };
type PaymentsPayload = {
  events: EventOption[]; payments: Payment[]; summary: Summary;
  pagination: { page: number; page_size: number; total: number; page_count: number };
  can_view_participant_info: boolean;
};

const PAGE_SIZE = 20;
const statusOptions = [
  ['succeeded', 'Paid'], ['pending', 'Pending'], ['processing', 'Processing'], ['failed', 'Failed'],
  ['expired', 'Expired'], ['refunded', 'Refunded'], ['partially_refunded', 'Partially refunded'], ['cancelled', 'Cancelled'],
];
const labels: Record<string, string> = { succeeded: 'Paid', pending: 'Pending', processing: 'Processing', failed: 'Failed', expired: 'Expired', refunded: 'Refunded', partially_refunded: 'Partially refunded', cancelled: 'Cancelled' };
const statusStyle = (status: string) => {
  if (status === 'succeeded') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'pending' || status === 'processing' || status === 'partially_refunded') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-100 text-slate-700';
};
const statusLabel = (status: string) => labels[status] ?? status.replaceAll('_', ' ');
const money = (amount: number | string | null | undefined, currency = 'PHP') => {
  try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(amount) || 0); }
  catch { return `₱${(Number(amount) || 0).toFixed(2)}`; }
};
const date = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
  : 'Not recorded';
const methodLabel = (value: string | null | undefined) => {
  if (!value) return 'Not recorded';
  const method = value.toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
  if (method.includes('gcash')) return 'GCash';
  if (method.includes('qr')) return 'QR Ph';
  if (method.includes('maya') || method.includes('paymaya')) return 'Maya';
  if (method.includes('card')) return 'Card';
  if (method === 'paymongo') return 'Not recorded';
  return value;
};

export default function PaymentsPage() {
  const { setActions } = useRegistrationsHeader();
  const [payload, setPayload] = useState<PaymentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerOpenerRef = useRef<HTMLButtonElement | null>(null);

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
    if (eventId) params.set('eventId', eventId);
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (debouncedSearch) params.set('search', debouncedSearch);
    setLoading(true);
    setError('');
    void fetch(`/api/organizer/payments?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? 'Payment records could not be loaded.');
        return body as PaymentsPayload;
      })
      .then((body) => { if (active) setPayload(body); })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof DOMException && cause.name === 'AbortError'
          ? 'The payment request timed out. Check your connection and try again.'
          : cause instanceof Error ? cause.message : 'Payment records could not be loaded.');
      })
      .finally(() => { window.clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [eventId, status, from, to, debouncedSearch, page, reloadToken]);

  useEffect(() => {
    if (!selected) { drawerOpenerRef.current?.focus(); return; }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [selected]);

  useEffect(() => { if (payload && page > payload.pagination.page_count) setPage(payload.pagination.page_count); }, [payload, page]);

  const filtered = Boolean(eventId || status || from || to || search.trim());
  const clearFilters = () => { setEventId(''); setStatus(''); setFrom(''); setTo(''); setSearch(''); setPage(1); };
  const summary = payload?.summary;
  const firstRow = payload?.pagination.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(page * PAGE_SIZE, payload?.pagination.total ?? 0);

  const cards = useMemo(() => [
    { title: 'Total collected', value: money(summary?.total_collected ?? 0), note: 'Successful checkout totals', Icon: CircleDollarSign },
    { title: 'Organizer revenue', value: money(summary?.organizer_revenue ?? 0), note: 'Before refunds and payout deductions', Icon: Wallet },
    { title: 'Successful payments', value: (summary?.successful_payments ?? 0).toLocaleString(), note: 'Verified successful transactions', Icon: BadgeCheck },
    { title: 'Pending payments', value: (summary?.pending_payments ?? 0).toLocaleString(), note: 'Awaiting gateway confirmation', Icon: CreditCard },
  ], [summary]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    const params = new URLSearchParams({ export: 'csv' });
    if (eventId) params.set('eventId', eventId);
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search.trim()) params.set('search', search.trim());
    try {
      const response = await fetch(`/api/organizer/payments?${params}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'CSV export failed.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'racedeck-payments.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Payment CSV exported.');
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'CSV export failed.'); }
    finally { setExporting(false); }
  }, [eventId, status, from, to, search, notify]);

  const refreshPayments = useCallback(() => {
    setReloadToken((value) => value + 1);
    notify('Refreshing payment records…');
  }, [notify]);

  useEffect(() => {
    setActions({
      onExport: () => void exportCsv(),
      onRefresh: refreshPayments,
      exportDisabled: loading || exporting || !payload?.pagination.total,
      refreshing: loading,
    });
    return () => setActions(null);
  }, [setActions, exportCsv, refreshPayments, loading, exporting, payload?.pagination.total]);

  const copyReference = async () => {
    if (!selected) return;
    const reference = selected.gateway_transaction_reference || selected.gateway_payment_id || selected.id;
    try { await navigator.clipboard.writeText(reference); notify('Payment reference copied.'); }
    catch { notify('Could not copy the reference.'); }
  };

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => setReloadToken((value) => value + 1)} className="min-h-10 rounded-lg border border-red-300 bg-white px-3.5 font-bold text-red-800 hover:bg-red-50">Try again</button></div>}

      <section aria-label="Payment summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, note, Icon }) => <article key={title} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-sm font-semibold text-slate-600">{title}</h2><p className="mt-2 truncate text-2xl font-extrabold text-[#0b2348]" title={loading || error ? undefined : value}>{loading ? <span className="inline-block h-8 w-28 animate-pulse rounded bg-slate-100" /> : error ? '—' : value}</p></div><span className="shrink-0 rounded-lg bg-orange-50 p-2.5 text-orange-600"><Icon aria-hidden="true" size={19} /></span></div>
          <p className="mt-2 text-xs text-slate-500">{note}</p>
        </article>)}
      </section>

      <section aria-label="Payment transactions" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div><h2 className="font-bold text-[#0b2348]">Payment transactions</h2><p className="mt-0.5 text-xs text-slate-500">Totals follow event and date filters. Status and search filters narrow the table.</p></div>
          <span aria-live="polite" className="text-sm text-slate-500">{loading ? 'Loading…' : `${(payload?.pagination.total ?? 0).toLocaleString()} ${payload?.pagination.total === 1 ? 'transaction' : 'transactions'}`}</span>
        </div>
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.9fr_0.9fr_1.4fr_auto] sm:px-5">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Event<select value={eventId} onChange={(event) => { setEventId(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All events</option>{(payload?.events ?? []).map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All statuses</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">From<input aria-label="From date" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">To<input aria-label="To date" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Search<span className="relative mt-1.5 block"><Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={payload?.can_view_participant_info ? 'Participant or registration reference' : 'Registration reference'} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></span></label>
          {filtered && <div className="flex items-end"><button type="button" onClick={clearFilters} className="min-h-11 px-2 text-sm font-semibold text-orange-700 underline underline-offset-2">Clear filters</button></div>}
        </div>

        {error ? <div className="p-10 text-center text-sm text-slate-600">Payment records are unavailable until the connection is restored.</div> : loading ? <div aria-label="Loading payment records" className="space-y-3 p-5">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div> : <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-4 py-3.5">Participant</th><th scope="col" className="px-4 py-3.5">Event</th><th scope="col" className="px-4 py-3.5">Amount</th><th scope="col" className="px-4 py-3.5">Method</th><th scope="col" className="px-4 py-3.5">Status</th><th scope="col" className="px-4 py-3.5">Date</th><th scope="col" className="px-4 py-3.5 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {!payload?.payments.length ? <tr><td colSpan={7} className="px-4 py-14 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><ClipboardList aria-hidden="true" size={22} /></span><p className="mt-3 text-sm font-semibold text-slate-700">{filtered ? 'No payments match your filters' : 'No payments yet'}</p><p className="mt-1 text-sm text-slate-500">{filtered ? 'Try changing the event, status, date range, or search term.' : 'Transactions will appear here after participants complete checkout.'}</p>{filtered && <button type="button" onClick={clearFilters} className="mt-4 rounded-lg bg-[#0b2b5b] px-4 py-2 text-sm font-bold text-white hover:bg-[#123b78]">Clear filters</button>}</div></td></tr> : payload.payments.map((payment) => {
                  const amount = ['succeeded', 'partially_refunded', 'refunded'].includes(payment.status) ? payment.amount_paid : payment.amount_due;
                  return <tr key={payment.id} className="transition hover:bg-slate-50/70">
                    <td className="px-4 py-3.5"><p className="font-semibold text-[#0b2348]">{payment.participant?.name || 'Participant details restricted'}</p><p className="mt-1 text-xs text-slate-500">{payment.registration_number ? `Reg. ${payment.registration_number}` : `Registration ${payment.registration_id.slice(0, 8)}`}</p></td>
                    <td className="max-w-56 px-4 py-3.5"><p className="truncate font-medium text-slate-700" title={payment.event_name ?? ''}>{payment.event_name || 'Event unavailable'}</p>{payment.category_name && <p className="mt-1 text-xs text-slate-500">{payment.category_name}</p>}</td>
                    <td className="whitespace-nowrap px-4 py-3.5"><p className="font-bold text-slate-800">{money(amount, payment.currency)}</p>{Number(payment.amount_refunded) > 0 && <p className="mt-1 text-xs text-rose-700">Refunded {money(payment.amount_refunded, payment.currency)}</p>}</td>
                    <td className="px-4 py-3.5 text-slate-700">{methodLabel(payment.payment_method)}</td>
                    <td className="px-4 py-3.5"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle(payment.status)}`}>{statusLabel(payment.status)}</span></td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{date(payment.created_at)}</td>
                    <td className="px-4 py-3.5 text-right"><button type="button" onClick={(event) => { drawerOpenerRef.current = event.currentTarget; setSelected(payment); }} className="min-h-9 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#0b2b5b] hover:border-orange-300 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-200">View details</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {!!payload?.pagination.total && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3.5 sm:px-5"><p className="text-xs text-slate-500">Showing {firstRow}–{lastRow} of {payload.pagination.total.toLocaleString()}</p><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="min-h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-40">Previous</button><span aria-live="polite" className="px-2 text-sm text-slate-600">Page {page} of {payload.pagination.page_count}</span><button type="button" onClick={() => setPage((current) => Math.min(payload.pagination.page_count, current + 1))} disabled={page >= payload.pagination.page_count} className="min-h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold disabled:opacity-40">Next</button></div></footer>}
        </>}
      </section>

      {selected && <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <aside role="dialog" aria-modal="true" aria-labelledby="payment-detail-title" className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">Payment details</p><h2 id="payment-detail-title" className="mt-1 text-xl font-extrabold text-[#0b2348]">{selected.event_name || 'Payment transaction'}</h2><p className="mt-1 text-sm text-slate-500">Registration {selected.registration_number || selected.registration_id.slice(0, 12)}</p></div><button ref={drawerCloseRef} type="button" aria-label="Close payment details" onClick={() => setSelected(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><X size={19} /></button></header>
          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction status</p><span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${statusStyle(selected.status)}`}>{statusLabel(selected.status)}</span></div><div className="text-right"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{['succeeded', 'partially_refunded', 'refunded'].includes(selected.status) ? 'Total paid' : 'Amount due'}</p><p className="mt-1 text-xl font-extrabold text-[#0b2348]">{money(['succeeded', 'partially_refunded', 'refunded'].includes(selected.status) ? selected.amount_paid : selected.amount_due, selected.currency)}</p></div></div>

            <section><h3 className="text-sm font-bold text-[#0b2348]">Participant information</h3><dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4"><DetailRow label="Participant" value={selected.participant?.name || 'Participant details restricted'} Icon={UsersRound} /><DetailRow label="Email" value={selected.participant?.email || (payload?.can_view_participant_info ? 'Not recorded' : 'Restricted')} Icon={Mail} /><DetailRow label="Registration reference" value={selected.registration_number || selected.registration_id} Icon={ClipboardList} /><DetailRow label="Event and category" value={[selected.event_name, selected.category_name].filter(Boolean).join(' · ') || 'Not recorded'} Icon={CalendarDays} /></dl></section>

            <section><h3 className="text-sm font-bold text-[#0b2348]">Payment information</h3><dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
              <DetailRow label="RaceDeck transaction reference" value={selected.id} />
              <DetailRow label="PayMongo reference" value={selected.gateway_transaction_reference || selected.gateway_payment_id || 'Not recorded'} />
              <DetailRow label="Payment method" value={methodLabel(selected.payment_method)} />
              <DetailRow label="Registration amount" value={money(selected.pricing.registration_amount, selected.currency)} />
              <DetailRow label="RaceDeck service fee" value={selected.pricing.platform_fee == null ? 'Not recorded' : money(selected.pricing.platform_fee, selected.currency)} />
              <DetailRow label="Processing fee" value={selected.pricing.processing_fee == null ? 'Not recorded' : money(selected.pricing.processing_fee, selected.currency)} />
              <DetailRow label="Discount" value={selected.pricing.discount_amount == null ? 'Not recorded' : money(selected.pricing.discount_amount, selected.currency)} />
              <DetailRow label="Organizer allocation" value={money(selected.pricing.organizer_allocation, selected.currency)} />
              <DetailRow label="Payment date" value={date(selected.paid_at || selected.created_at)} />
            </dl><button type="button" onClick={copyReference} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Check size={15} aria-hidden="true" />Copy Reference</button></section>

            <section><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-[#0b2348]">Refund history</h3><span className="text-xs text-slate-500">{selected.refunds.length} {selected.refunds.length === 1 ? 'record' : 'records'}</span></div>{selected.refunds.length ? <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">{selected.refunds.map((refund) => <li key={refund.id} className="flex items-center justify-between gap-3 py-3"><div><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${refund.status === 'succeeded' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>{statusLabel(refund.status)}</span><p className="mt-1 text-xs text-slate-500">{refund.gateway_refund_id || date(refund.processed_at || refund.created_at)}</p></div><strong className="whitespace-nowrap text-sm text-slate-800">{money(refund.amount, refund.currency)}</strong></li>)}</ul> : <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">No refund is recorded for this transaction.</p>}</section>

            <section><h3 className="text-sm font-bold text-[#0b2348]">Payout status</h3><p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">Payouts are tracked at the organization level. No verified payment-to-payout link is available for this transaction.</p></section>
          </div>
        </aside>
      </div>}
      <div aria-live="polite" aria-atomic="true" className="fixed bottom-5 right-5 z-[120]">{toast && <p role="status" className="rounded-lg bg-[#0b2348] px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</p>}</div>
    </main>
  );
}

function DetailRow({ label, value, Icon }: { label: string; value: string; Icon?: typeof CalendarDays }) {
  return <div className="flex items-start justify-between gap-4 py-3"><dt className="flex min-w-0 items-center gap-2 text-sm text-slate-500">{Icon && <Icon size={15} aria-hidden="true" className="shrink-0 text-slate-400" />}{label}</dt><dd className="max-w-[62%] break-words text-right text-sm font-semibold text-slate-800">{value}</dd></div>;
}
