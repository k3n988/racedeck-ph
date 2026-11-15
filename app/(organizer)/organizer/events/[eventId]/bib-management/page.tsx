'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ToastFeedback } from '@/components/toast-feedback';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

type Bib = { id: string; bib_number: number; bib_code: string; assignment_source: 'sequential' | 'bulk' | 'manual' | 'reassignment'; assignment_type: 'automatic' | 'manual'; assigned_at: string };
type Participant = { id: string; registration_number: string; participant_name: string; first_name: string; middle_name?: string | null; last_name: string; registration_status: string; category_id: string; category_name: string; distance_km: number | null; registration_type: 'account' | 'guest'; payment_status: string | null; kit_claimed: boolean; bib: Bib | null };
type Category = { id: string; name: string; distance_km: number | null };
type PageData = { event: { id: string; name: string }; categories: Category[]; rows: Participant[]; total: number; eligible_missing_count: number; page: number; page_size: number; total_pages: number; can_view_participant_info: boolean };
type Filters = { category_id: string; assignment_status: string };
type ModalState = { mode: 'assign' | 'edit'; participant: Participant } | { mode: 'bulk' } | null;

const control = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const statusText = (value?: string | null) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'Unpaid';
const formatDate = (value?: string) => value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const isEligible = (participant: Participant) => participant.registration_status === 'confirmed' && participant.payment_status === 'succeeded';

export default function BibManagementPage({ params }: { params: { eventId: string } }) {
  const [data, setData] = useState<PageData | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>({ category_id: '', assignment_status: 'all' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [bibInput, setBibInput] = useState('');
  const [claimedCorrectionConfirmed, setClaimedCorrectionConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const dialogRef = useRef<HTMLElement>(null);
  const oldFocus = useRef<HTMLElement | null>(null);
  const modalOpen = Boolean(modal);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ action: 'page', search, category_id: filters.category_id, assignment_status: filters.assignment_status, page: String(page), page_size: String(pageSize) });
      const response = await fetch(`/api/organizer/events/${params.eventId}/bib-management?${query}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Bib assignments could not be loaded.');
      const nextData = body as PageData;
      setData(nextData);
      if (nextData.page !== page) setPage(nextData.page);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bib assignments could not be loaded.'); }
    finally { setLoading(false); }
  }, [filters, page, pageSize, params.eventId, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!modalOpen) { oldFocus.current?.focus(); oldFocus.current = null; return; }
    oldFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setModal(null); return; }
      if (event.key === 'Tab') { const items = focusable(); if (!items.length) return; if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); } }
    };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, [modalOpen]);

  function openModal(next: ModalState) {
    setError(''); setNotice(''); setApiErrors({}); setClaimedCorrectionConfirmed(false);
    setBibInput(next?.mode === 'edit' && next.participant.bib ? String(next.participant.bib.bib_number) : '');
    setModal(next);
  }

  function updateFilter(key: keyof Filters, value: string) { setPage(1); setFilters(current => ({ ...current, [key]: value })); }
  function clearFilters() { setSearchInput(''); setSearch(''); setPage(1); setFilters({ category_id: '', assignment_status: 'all' }); }

  async function saveBib(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal || modal.mode === 'bulk') return;
    const parsedNumber = Number(bibInput);
    if (!Number.isInteger(parsedNumber) || parsedNumber <= 0 || parsedNumber > 99999) { setApiErrors({ bib_number: 'Enter a whole number with no more than five digits.' }); return; }
    if (modal.mode === 'edit' && modal.participant.bib && parsedNumber === modal.participant.bib.bib_number) { setModal(null); return; }
    setBusy(true); setError(''); setNotice(''); setApiErrors({});
    try {
      const payload = modal.mode === 'assign'
        ? { action: 'manual', registration_id: modal.participant.id, bib_number: parsedNumber }
        : { action: 'reassign', bib_id: modal.participant.bib?.id, bib_number: parsedNumber, confirm_claimed_correction: claimedCorrectionConfirmed };
      const response = await fetch(`/api/organizer/events/${params.eventId}/bib-management`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Bib assignment could not be saved.');
      setModal(null); setNotice(modal.mode === 'assign' ? 'Bib assigned successfully.' : 'Bib number updated and change recorded.'); await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Bib assignment could not be saved.';
      setApiErrors({ form: message });
      if (/already collected/i.test(message)) {
        await load();
        setModal(current => current?.mode === 'edit' ? { ...current, participant: { ...current.participant, kit_claimed: true } } : current);
      }
    }
    finally { setBusy(false); }
  }

  async function assignMissing() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/bib-management`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bulk' }) });
      const result = await response.json().catch(() => ({})) as { error?: string; assigned?: number; skipped?: number; failed?: number; errors?: Array<{ registration_number: string; error: string }> };
      if (!response.ok) throw new Error(result.error ?? 'Missing bibs could not be assigned.');
      setModal(null);
      const summary = `Assigned ${result.assigned ?? 0}; skipped ${result.skipped ?? 0}; failed ${result.failed ?? 0}.`;
      setNotice(result.failed ? `${summary} You can retry safely; existing assignments remain unchanged.` : summary);
      if (result.errors?.length) setApiErrors(Object.fromEntries(result.errors.slice(0, 5).map((entry, index) => [`${index}`, `${entry.registration_number}: ${entry.error}`])));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Missing bibs could not be assigned.'); }
    finally { setBusy(false); }
  }

  function applySearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); }
  const hasFilters = Boolean(search || filters.category_id || filters.assignment_status !== 'all');
  const first = data?.total ? (data.page - 1) * data.page_size + 1 : 0;
  const last = Math.min((data?.page ?? 1) * pageSize, data?.total ?? 0);

  return <main className="mx-auto max-w-[1440px] space-y-5 bg-[#f4f6fa] p-4 sm:p-6 lg:p-8">
    {(error || notice) && <ToastFeedback message={error || notice} tone={error ? 'error' : 'auto'}>{error ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div> : undefined}</ToastFeedback>}
    {Object.values(apiErrors).filter((value, index) => index < 5).map((message, index) => <ToastFeedback key={`${index}-${message}`} message={message} tone="error" />)}

    <section aria-label="Bib assignments and participant search" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div role="group" aria-label="Participant search and filters" className="border-b border-slate-200 p-4 sm:p-5">
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_repeat(2,minmax(180px,1fr))_auto]">
        <form onSubmit={applySearch} className="min-w-0">
          <label className="block min-w-0"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Search participants</span><span className="relative block"><input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Name, registration ID, or bib" aria-label="Search by name, registration ID, or bib number" className={`${control} pr-11 text-sm`} /><button type="submit" disabled={loading} aria-label="Search registrations" title="Search" className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0b2b5b] disabled:opacity-50"><Search className="h-4 w-4" aria-hidden="true" /></button></span></label>
        </form>
        <label className="min-w-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Race category<select value={filters.category_id} onChange={event => updateFilter('category_id', event.target.value)} className={`${control} mt-1.5 w-full min-w-0 px-3 text-sm font-normal normal-case tracking-normal`}><option value="">All categories</option>{data?.categories.map(category => <option key={category.id} value={category.id}>{category.name}{category.distance_km ? ` · ${category.distance_km} km` : ''}</option>)}</select></label>
        <label className="min-w-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bib assignment<select value={filters.assignment_status} onChange={event => updateFilter('assignment_status', event.target.value)} className={`${control} mt-1.5 w-full min-w-0 px-3 text-sm font-normal normal-case tracking-normal`}><option value="all">All assignments</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option><option value="automatic">Automatic</option><option value="manual">Manual</option></select></label>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-1 xl:flex-nowrap xl:justify-end">
          {hasFilters && <button type="button" onClick={clearFilters} className="min-h-11 whitespace-nowrap rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear</button>}
          <button type="button" onClick={() => openModal({ mode: 'bulk' })} disabled={loading || busy || !data?.eligible_missing_count} className="min-h-11 whitespace-nowrap rounded-xl bg-orange-600 px-3 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">Assign missing{data?.eligible_missing_count ? ` (${data.eligible_missing_count})` : ''}</button>
        </div>
      </div>
      </div>
      {loading && !data ? <div role="status" className="space-y-3 p-4"><span className="sr-only">Loading participant bib assignments</span>{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
        : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><caption className="sr-only">Participant bib assignments</caption><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Race category</th><th className="px-4 py-3">Registration type</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Bib number</th><th className="px-4 py-3">Assignment type</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{!data?.rows.length ? <tr><td colSpan={7} className="px-5 py-12 text-center"><p className="font-semibold text-slate-800">No registrations found</p><p className="mt-1 text-sm text-slate-500">{hasFilters ? 'Try clearing or changing your filters.' : 'Confirmed and pending registrations will appear here.'}</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-orange-700 underline underline-offset-2">Clear filters</button>}</td></tr> : data.rows.map(participant => <tr key={participant.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{data.can_view_participant_info ? participant.participant_name : 'Participant'}</p><p className="mt-0.5 text-xs text-slate-500">{participant.registration_number}</p></td><td className="px-4 py-3 text-slate-700">{participant.category_name}{participant.distance_km ? <span className="block text-xs text-slate-500">{participant.distance_km} km</span> : null}</td><td className="px-4 py-3 text-slate-700">{participant.registration_type === 'account' ? 'Participant account' : 'Guest'}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${participant.payment_status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{participant.payment_status === 'succeeded' ? 'Paid' : statusText(participant.payment_status)}</span></td><td className="px-4 py-3 font-mono font-bold text-[#0b2b5b]">{participant.bib?.bib_code ?? <span className="font-sans font-normal text-slate-500">Unassigned</span>}</td><td className="px-4 py-3">{participant.bib ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${participant.bib.assignment_type === 'automatic' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{participant.bib.assignment_type === 'automatic' ? 'Automatic' : 'Manual'}<span className="block px-1 pt-1 text-[11px] font-normal text-slate-500">{formatDate(participant.bib.assigned_at)}</span></span> : '—'}</td><td className="px-4 py-3"><div className="flex items-center justify-end gap-2">{!participant.bib && <button type="button" disabled={busy || !isEligible(participant)} onClick={() => openModal({ mode: 'assign', participant })} title={!isEligible(participant) ? 'A confirmed registration and successful payment are required.' : 'Assign a bib number'} className="min-h-9 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-45">Assign</button>}{participant.bib && <button type="button" disabled={busy || !isEligible(participant)} onClick={() => openModal({ mode: 'edit', participant })} title={!isEligible(participant) ? 'A confirmed registration and successful payment are required.' : 'Edit bib number'} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-[#0b2b5b] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45">Edit</button>}<Link href={`/organizer/events/${params.eventId}/registrations/${participant.id}`} aria-label={`View registration ${participant.registration_number}`} className="min-h-9 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">View</Link></div></td></tr>)}</tbody></table></div>}
      <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex flex-wrap items-center gap-x-5 gap-y-2"><p className="text-sm text-slate-600">{data?.total ? `Showing ${first}–${last} of ${data.total.toLocaleString()}` : '0 registrations'}</p><label htmlFor="bib-page-size" className="flex items-center gap-2 text-sm text-slate-600">Rows per page<select id="bib-page-size" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-slate-800"><option value={20}>20</option><option value={30}>30</option><option value={50}>50</option></select></label></div><nav aria-label="Bib management pagination" className="flex items-center gap-2"><button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft className="h-4 w-4" />Previous</button><span aria-live="polite" className="min-w-20 text-center text-sm tabular-nums text-slate-600">Page {data?.page ?? page} of {data?.total_pages ?? 1}</span><button type="button" onClick={() => setPage(value => value + 1)} disabled={!data || page >= data.total_pages || loading} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45">Next<ChevronRight className="h-4 w-4" /></button></nav></footer>
    </section>

    {modal && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="bib-modal-title" tabIndex={-1} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      {modal.mode === 'bulk' ? <><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Bulk assignment</p><h2 id="bib-modal-title" className="mt-1 text-xl font-extrabold text-[#071b41]">Assign missing bibs?</h2></div><button type="button" onClick={() => setModal(null)} aria-label="Close bulk assignment confirmation" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200"><X className="h-4 w-4" /></button></header><div className="space-y-4 p-5"><div className="rounded-xl bg-blue-50 p-4"><p className="text-2xl font-extrabold text-[#0b2b5b]">{data?.eligible_missing_count ?? 0}</p><p className="mt-1 text-sm text-slate-700">confirmed, paid participants are eligible and currently have no bib.</p></div><p className="text-sm leading-6 text-slate-600">RaceDeck assigns five-digit bibs by distance and registration order. Examples: 3 km starts at 03001, 5 km at 05001, and 10 km at 10001. Each distance band supports 999 bibs; unsupported or full bands use the reserved five-digit fallback. Existing bib assignments remain unchanged, and retries skip registrations that already have a bib.</p></div><footer className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModal(null)} disabled={busy} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void assignMissing()} disabled={busy || !data?.eligible_missing_count} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? 'Assigning…' : <><Check className="h-4 w-4" />Confirm assignment</>}</button></footer></>
      : <><header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">{modal.mode === 'assign' ? 'Manual bib assignment' : 'Edit bib number'}</p><h2 id="bib-modal-title" className="mt-1 text-xl font-extrabold text-[#071b41]">{modal.mode === 'assign' ? 'Assign bib' : 'Update bib number'}</h2></div><button type="button" onClick={() => setModal(null)} aria-label="Close bib dialog" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200"><X className="h-4 w-4" /></button></header><form onSubmit={saveBib} className="space-y-4 p-5"><dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><ReadOnly label="Participant" value={modal.participant.participant_name} /><ReadOnly label="Registration ID" value={modal.participant.registration_number} /><ReadOnly label="Race category" value={`${modal.participant.category_name}${modal.participant.distance_km ? ` · ${modal.participant.distance_km} km` : ''}`} /><ReadOnly label="Payment status" value={statusText(modal.participant.payment_status)} /></dl>{modal.mode === 'edit' && modal.participant.bib && <ReadOnly label="Current bib number" value={modal.participant.bib.bib_code} />}<label className="block text-sm font-semibold text-slate-700">{modal.mode === 'assign' ? 'Bib number' : 'New bib number'}<input autoFocus type="number" min="1" max="99999" step="1" inputMode="numeric" value={bibInput} onChange={event => setBibInput(event.target.value)} disabled={busy} placeholder="Enter a number up to five digits" className={`${control} mt-1.5`} />{apiErrors.bib_number && <span className="mt-1 block text-sm text-red-700">{apiErrors.bib_number}</span>}</label>{modal.mode === 'edit' && modal.participant.bib && <div className="rounded-xl border border-slate-200 p-3 text-sm"><p className="text-slate-600">Assignment history records the old and new bib numbers, timestamp, and staff member.</p><p className="mt-1 text-xs text-slate-500">Currently assigned {modal.participant.bib.assignment_type === 'automatic' ? 'automatically' : 'manually'} · {formatDate(modal.participant.bib.assigned_at)}</p></div>}{modal.mode === 'edit' && modal.participant.bib && modal.participant.kit_claimed && <><p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This participant already collected their race kit. Changing this bib will be recorded as an audited correction.</p><label className="flex items-start gap-2 text-sm leading-5 text-slate-700"><input type="checkbox" checked={claimedCorrectionConfirmed} onChange={event => { setClaimedCorrectionConfirmed(event.target.checked); setApiErrors(current => ({ ...current, form: '' })); }} className="mt-1 h-4 w-4 accent-orange-600" />I authorize this bib correction and confirm the physical bib will be corrected.</label></>}{apiErrors.form && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{apiErrors.form}</p>}<footer className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModal(null)} disabled={busy} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">Cancel</button><button type="submit" disabled={busy || !bibInput || !isEligible(modal.participant) || (modal.mode === 'edit' && modal.participant.kit_claimed && !claimedCorrectionConfirmed)} className="min-h-11 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : modal.mode === 'assign' ? 'Confirm assignment' : 'Save changes'}</button></footer></form></>}
    </section></div>}
  </main>;
}

function ReadOnly({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-800">{value}</dd></div>; }
