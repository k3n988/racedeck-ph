'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Category = { id: string; name: string };
type Registration = {
  id: string;
  registration_number: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  status: string;
  created_at: string;
  race_categories: { id: string; name: string } | Array<{ id: string; name: string }> | null;
  payments: Array<{ status: string }> | { status: string } | null;
  bibs: Array<{ bib_number: number | null; prefix: string | null; status: string }> | { bib_number: number | null; prefix: string | null; status: string } | null;
  race_kit_claims: Array<{ claimed_at: string | null }> | null;
};
type PageData = {
  registrations: Registration[];
  categories: Category[];
  page: number;
  pageSize: number;
  total: number;
  canViewPii: boolean;
};

function first<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value));
}

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function EmptyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-orange-500">
      <path d="M7 4.75h10a2 2 0 0 1 2 2v13H5v-13a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 3v3.5M15 3v3.5M8.5 10h7M8.5 13.5h7M8.5 17h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function RegistrationsTable({ eventId }: { eventId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const queryString = params.toString();
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [categoryId, setCategoryId] = useState(params.get('categoryId') ?? '');

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    setSearch(new URLSearchParams(queryString).get('search') ?? '');
    setStatus(new URLSearchParams(queryString).get('status') ?? '');
    setCategoryId(new URLSearchParams(queryString).get('categoryId') ?? '');

    void fetch(`/api/organizer/events/${eventId}/registrations${queryString ? `?${queryString}` : ''}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? 'Registrations could not be loaded.');
        setData(body as PageData);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Registrations could not be loaded.');
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [eventId, queryString, retryToken]);

  const range = useMemo(() => {
    if (!data || data.total === 0) return '0 records';
    const start = (data.page - 1) * data.pageSize + 1;
    return `${start}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total}`;
  }, [data]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateQueryFilters(search.trim(), status, categoryId);
  }

  function updateQueryFilters(nextSearch: string, nextStatus: string, nextCategoryId: string) {
    const next = new URLSearchParams(queryString);
    if (nextSearch) next.set('search', nextSearch);
    else next.delete('search');
    if (nextStatus) next.set('status', nextStatus);
    else next.delete('status');
    if (nextCategoryId) next.set('categoryId', nextCategoryId);
    else next.delete('categoryId');
    next.set('page', '1');
    router.push(`?${next.toString()}`);
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setCategoryId('');
    router.push('?page=1');
  }

  function movePage(nextPage: number) {
    const next = new URLSearchParams(queryString);
    next.set('page', String(nextPage));
    router.push(`?${next.toString()}`);
  }

  async function exportCsv() {
    setIsExporting(true);
    try {
      const next = new URLSearchParams(queryString);
      next.set('export', 'csv');
      const response = await fetch(`/api/organizer/events/${eventId}/registrations?${next.toString()}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'CSV export could not be prepared.');
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `event-registrations-${eventId}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'CSV export could not be prepared.');
    } finally {
      setIsExporting(false);
    }
  }

  const hasFilters = Boolean(params.get('search') || params.get('status') || params.get('categoryId'));

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">Participant registrations</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500" aria-live="polite">{isLoading ? 'Loading…' : range}</span>
          <button type="button" onClick={() => void exportCsv()} disabled={isExporting || isLoading || !data || data.total === 0} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            {isExporting ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <form onSubmit={applyFilters} className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto_auto] xl:items-end">
        <label className="col-span-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-1">
          Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={data?.canViewPii ? 'Registration no., name, or email' : 'Registration number'} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Registration status
          <select value={status} onChange={(event) => { const value = event.target.value; setStatus(value); updateQueryFilters(search.trim(), value, categoryId); }} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending_payment">Pending payment</option>
            <option value="cancelled">Cancelled</option>
            <option value="transferred">Transferred</option>
            <option value="refunded">Refunded</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Race category
          <select value={categoryId} onChange={(event) => { const value = event.target.value; setCategoryId(value); updateQueryFilters(search.trim(), status, value); }} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">
            <option value="">All categories</option>
            {(data?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        {hasFilters && <button type="button" onClick={resetFilters} className="h-11 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-900">Clear</button>}
      </form>

      {error ? (
        <div className="m-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold hover:bg-red-100">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3 p-5" aria-label="Loading registrations">
          {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Registration / participant</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Registration</th>
                  <th scope="col" className="px-4 py-3">Payment</th>
                  <th scope="col" className="px-4 py-3">Bib</th>
                  <th scope="col" className="px-4 py-3">Race kit</th>
                  <th scope="col" className="px-4 py-3">Registered</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.registrations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-3">
                      <div className="flex min-h-36 flex-col items-center justify-center px-4 py-5 text-center sm:min-h-44">
                        <span className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-orange-50"><EmptyIcon /></span>
                        <h3 className="font-semibold text-slate-900">{hasFilters ? 'No matching registrations' : 'No registrations yet'}</h3>
                        <p className="mt-1 max-w-md text-sm text-slate-500">{hasFilters ? 'Try changing or clearing the filters to see more participants.' : 'Participant sign-ups will appear here. After registration closes, filter by Confirmed to review the final roster.'}</p>
                        {hasFilters && <button type="button" onClick={resetFilters} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear filters</button>}
                      </div>
                    </td>
                  </tr>
                ) : data?.registrations.map((row) => {
                  const payment = first(row.payments);
                  const bib = first(row.bibs);
                  const participant = [row.first_name, row.last_name].filter(Boolean).join(' ');
                  return (
                    <tr key={row.id} className="text-slate-700 hover:bg-slate-50/80">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{data.canViewPii ? (participant || 'Participant details unavailable') : 'Participant details restricted'}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{row.registration_number ?? row.id}{data.canViewPii && row.email ? ` · ${row.email}` : ''}</div>
                      </td>
                      <td className="px-4 py-3.5">{first(row.race_categories)?.name ?? '—'}</td>
                      <td className="px-4 py-3.5"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabel(row.status)}</span></td>
                      <td className="px-4 py-3.5">{payment?.status ? statusLabel(payment.status) : 'No payment'}</td>
                      <td className="px-4 py-3.5">{bib?.bib_number != null ? `${bib.prefix ?? ''}${bib.bib_number}` : 'Not assigned'}</td>
                      <td className="px-4 py-3.5">{row.race_kit_claims?.some((claim) => claim.claimed_at) ? 'Claimed' : 'Not claimed'}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3.5 text-right"><Link className="font-semibold text-orange-700 hover:text-orange-800 hover:underline" href={`/organizer/events/${eventId}/registrations/${row.id}`}>View participant<span className="sr-only"> profile for registration {row.registration_number ?? row.id}</span></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data && data.total > data.pageSize && (
            <nav aria-label="Registration pages" className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <span className="text-sm text-slate-500">Page {data.page} of {Math.ceil(data.total / data.pageSize)}</span>
              <div className="flex gap-2">
                <button type="button" disabled={data.page <= 1} onClick={() => movePage(data.page - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <button type="button" disabled={data.page * data.pageSize >= data.total} onClick={() => movePage(data.page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
