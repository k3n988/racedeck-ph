'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CheckCircle2, CircleDollarSign, ClipboardList, Search, UsersRound } from 'lucide-react';
import { useRegistrationsHeader } from './registrations-header-context';

type EventOption = { id: string; name: string };
type Payment = { status: string };
type Registration = {
  id: string;
  event_id: string;
  registration_number: string;
  category_id: string;
  status: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  email?: string;
  created_at: string;
  events: { name: string } | null;
  race_categories: { name: string } | null;
  payments: Payment[];
};
type Payload = { events: EventOption[]; registrations: Registration[]; can_view_pii: boolean; can_manage_registrations: boolean };

const PAGE_SIZE = 20;
const registrationStatusLabel: Record<string, string> = {
  pending_payment: 'Awaiting payment', confirmed: 'Confirmed', cancelled: 'Cancelled', transferred: 'Transferred', expired: 'Expired', refunded: 'Refunded',
};
const paymentStatusLabel: Record<string, string> = {
  succeeded: 'Paid', pending: 'Pending', processing: 'Processing', failed: 'Failed', expired: 'Expired', partially_refunded: 'Partially refunded', refunded: 'Refunded',
};
const label = (value: string) => registrationStatusLabel[value] ?? value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const paymentLabel = (value: string) => paymentStatusLabel[value] ?? label(value);
const date = (value: string) => new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const latestPaymentStatus = (row: Registration) => row.payments?.[0]?.status ?? 'unpaid';
const chipClass = (status: string) => {
  if (['confirmed', 'succeeded'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (['pending_payment', 'pending', 'processing'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (['cancelled', 'expired', 'failed', 'refunded', 'partially_refunded'].includes(status)) return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-slate-200 bg-white text-slate-600';
};

export default function RegistrationsWorkspace() {
  const { fromDate, toDate, setFromDate, setToDate, setActions } = useRegistrationsHeader();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventId, setEventId] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/organizer/registrations', { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Registrations could not be loaded.');
      setPayload({ events: body.events ?? [], registrations: body.registrations ?? [], can_view_pii: Boolean(body.can_view_pii), can_manage_registrations: Boolean(body.can_manage_registrations) });
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === 'TimeoutError'
        ? 'The registrations request timed out. Check the Supabase connection and try again.'
        : cause instanceof Error ? cause.message : 'Registrations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [fromDate, toDate]);

  const scopedRows = useMemo(() => (payload?.registrations ?? []).filter((row) => !eventId || row.event_id === eventId), [payload, eventId]);
  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return scopedRows.filter((row) => {
      if (registrationStatus && row.status !== registrationStatus) return false;
      if (paymentStatus && latestPaymentStatus(row) !== paymentStatus) return false;
      const created = new Date(row.created_at);
      if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate) {
        const endExclusive = new Date(`${toDate}T00:00:00`);
        endExclusive.setDate(endExclusive.getDate() + 1);
        if (created >= endExclusive) return false;
      }
      if (!term) return true;
      const haystack = [row.registration_number, row.first_name, row.middle_name, row.last_name, row.email, row.events?.name, row.race_categories?.name].filter(Boolean).join(' ').toLocaleLowerCase();
      return haystack.includes(term);
    });
  }, [scopedRows, registrationStatus, paymentStatus, search, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const pageRows = visibleRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pendingCount = scopedRows.filter((row) => row.status === 'pending_payment').length;
  const confirmedCount = scopedRows.filter((row) => row.status === 'confirmed').length;
  const paidCount = scopedRows.filter((row) => latestPaymentStatus(row) === 'succeeded').length;
  const filtersActive = Boolean(eventId || registrationStatus || paymentStatus || search || fromDate || toDate);

  function clearFilters() {
    setEventId(''); setRegistrationStatus(''); setPaymentStatus(''); setSearch(''); setFromDate(''); setToDate(''); setPage(1);
  }

  const exportCsv = useCallback(() => {
    const columns = payload?.can_view_pii
      ? ['Registration number', 'Participant', 'Email', 'Event', 'Category', 'Payment status', 'Registration status', 'Registered on']
      : ['Registration number', 'Participant', 'Event', 'Category', 'Payment status', 'Registration status', 'Registered on'];
    const rows = visibleRows.map((row) => {
      const participant = payload?.can_view_pii ? [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ') : 'Restricted';
      const values = [row.registration_number, participant, ...(payload?.can_view_pii ? [row.email ?? ''] : []), row.events?.name ?? '', row.race_categories?.name ?? '', paymentLabel(latestPaymentStatus(row)), label(row.status), date(row.created_at)];
      return values.map((value) => {
        const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
        return `"${safe.replaceAll('"', '""')}"`;
      }).join(',');
    });
    const blob = new Blob([[columns.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'racedeck-registrations.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [payload?.can_view_pii, visibleRows]);

  useEffect(() => {
    setActions({ onExport: exportCsv, onRefresh: () => void load(), exportDisabled: loading || visibleRows.length === 0, refreshing: loading });
    return () => setActions(null);
  }, [exportCsv, load, loading, setActions, visibleRows.length]);

  const metrics = [
    { name: 'Total registrations', value: scopedRows.length, icon: UsersRound, note: 'For selected events' },
    { name: 'Confirmed', value: confirmedCount, icon: CheckCircle2, note: 'Ready to participate' },
    { name: 'Awaiting payment', value: pendingCount, icon: CircleDollarSign, note: 'Not confirmed yet' },
    { name: 'Paid', value: paidCount, icon: BadgeCheck, note: 'Latest payment successful' },
  ];

  return (
    <main className="min-h-full w-full min-w-0 space-y-4 bg-[#f4f6fa] p-4 pt-3 sm:p-6 sm:pt-4 xl:p-7 xl:pt-4">
      {error && <ToastFeedback message={String(error)} tone="error"><div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => void load()} className="rounded-lg border border-red-300 bg-white px-3 py-2 font-bold">Try again</button></div></ToastFeedback>}

      {!error && <>
        <section aria-label="Registration summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ name, value, icon: Icon, note }) => <article key={name} className="flex min-h-[132px] min-w-0 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase leading-5 tracking-[0.08em] text-slate-500">{name}</p><p className="mt-3 text-2xl font-black tracking-tight text-[#071b41] sm:text-3xl">{loading ? '—' : value.toLocaleString()}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{note}</p></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600"><Icon aria-hidden="true" size={18} /></span></div>
          </article>)}
        </section>

        <section aria-label="Participant registrations" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-200 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-[#0b2348]">Participant registrations</h2><p aria-live="polite" className="text-sm text-slate-500">{loading ? 'Loading registrations…' : `${visibleRows.length.toLocaleString()} ${visibleRows.length === 1 ? 'record' : 'records'}`}</p></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Event
                <select value={eventId} onChange={(event) => { setEventId(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
                  <option value="">All events</option>{(payload?.events ?? []).map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Registration status
                <select value={registrationStatus} onChange={(event) => { setRegistrationStatus(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
                  <option value="">All statuses</option><option value="pending_payment">Awaiting payment</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="transferred">Transferred</option><option value="expired">Expired</option><option value="refunded">Refunded</option>
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment status
                <select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }} className="mt-1.5 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
                  <option value="">All payments</option><option value="succeeded">Paid</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="failed">Failed</option><option value="expired">Expired</option><option value="partially_refunded">Partially refunded</option><option value="refunded">Refunded</option><option value="unpaid">No payment record</option>
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Search
                <span className="relative mt-1.5 block"><Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={payload?.can_view_pii ? 'Name, email, or registration no.' : 'Registration, event, or category'} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></span>
              </label>
            </div>
            {filtersActive && <div className="flex justify-end"><button type="button" onClick={clearFilters} className="text-sm font-semibold text-orange-700 underline underline-offset-2">Clear filters</button></div>}
          </div>
          {loading ? <div className="space-y-3 p-5" aria-label="Loading registrations">{[0, 1, 2, 3].map((row) => <div key={row} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div> : <>
          {visibleRows.length === 0 ? <div className="px-4 py-12 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><ClipboardList aria-hidden="true" size={23} /></span><p className="mt-3 text-sm font-semibold text-slate-700">{filtersActive ? 'No matching registrations' : payload?.events.length ? 'No registrations yet' : 'No events to show'}</p><p className="mt-1 text-sm text-slate-500">{filtersActive ? 'Try changing your filters or use Clear filters above to see all registrations.' : payload?.events.length ? 'Participant sign-ups will appear here when someone registers for your events.' : 'Create an event first, then participant registrations will appear here.'}</p>{!filtersActive && !payload?.events.length && <Link href="/organizer/events" className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700">Manage events</Link>}</div></div> : <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Registration / Participant</th><th className="px-4 py-2.5">Event</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5 text-center">Payment</th><th className="px-4 py-2.5 text-center">Registration</th><th className="px-4 py-2.5">Registered</th><th className="px-4 py-2.5 text-right"><span className="sr-only">Action</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">{pageRows.map((row) => <tr key={row.id} className="transition hover:bg-slate-50/70">
                <td className="px-4 py-2.5"><p className="font-semibold leading-5 text-[#0b2348]">{payload?.can_view_pii ? [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ') || 'Participant name unavailable' : 'Participant details restricted'}</p>{payload?.can_view_pii && row.email && <p className="text-xs leading-4 text-slate-500">{row.email}</p>}<p className="text-[11px] leading-4 text-slate-400">{row.registration_number}</p></td>
                <td className="max-w-56 px-4 py-2.5 text-slate-700">{row.events?.name ?? 'Event unavailable'}</td><td className="px-4 py-2.5 text-slate-700">{row.race_categories?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-center"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${chipClass(latestPaymentStatus(row))}`}>{paymentLabel(latestPaymentStatus(row))}</span></td>
                <td className="px-4 py-2.5 text-center"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${chipClass(row.status)}`}>{label(row.status)}</span></td><td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{date(row.created_at)}</td>
                <td className="px-4 py-2.5 text-right">{payload?.can_manage_registrations || payload?.can_view_pii ? <Link href={`/organizer/events/${row.event_id}/registrations/${row.id}`} className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#0b2b5b] hover:border-orange-400 hover:text-orange-700">View participant</Link> : <span className="text-xs text-slate-400">Details restricted</span>}</td>
              </tr>)}</tbody>
            </table></div>
            <div className="divide-y divide-slate-100 md:hidden">{pageRows.map((row) => <article key={row.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-[#0b2348]">{payload?.can_view_pii ? [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ') || 'Participant name unavailable' : 'Participant details restricted'}</p>{payload?.can_view_pii && row.email && <p className="break-all text-sm text-slate-500">{row.email}</p>}<p className="mt-1 text-xs text-slate-400">{row.registration_number}</p></div>{payload?.can_manage_registrations || payload?.can_view_pii ? <Link href={`/organizer/events/${row.event_id}/registrations/${row.id}`} className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#0b2b5b]">View participant</Link> : null}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><div className="col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Event</dt><dd className="mt-0.5 text-slate-700">{row.events?.name ?? 'Event unavailable'}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category</dt><dd className="mt-0.5 text-slate-700">{row.race_categories?.name ?? '—'}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Registered</dt><dd className="mt-0.5 text-slate-700">{date(row.created_at)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</dt><dd className="mt-1"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${chipClass(latestPaymentStatus(row))}`}>{paymentLabel(latestPaymentStatus(row))}</span></dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Registration</dt><dd className="mt-1"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${chipClass(row.status)}`}>{label(row.status)}</span></dd></div></dl>
            </article>)}</div>
          </>}
          {visibleRows.length > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visibleRows.length)} of {visibleRows.length.toLocaleString()}</p><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><span aria-live="polite" className="px-2 text-sm text-slate-600">Page {page} of {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div></footer>}
          </>}
        </section>
      </>}
    </main>
  );
}
