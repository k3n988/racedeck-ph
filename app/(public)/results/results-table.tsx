'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Result = {
  event_id: string;
  bib: string | number | null;
  participant_name: string | null;
  category: string | null;
  gun_time: string | null;
  overall_rank: number | null;
  classification_rank: number | null;
  category_rank: number | null;
  status: string;
};

const inputClass = 'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100';

export default function ResultsTable({ initial, updateUrl = true }: { initial: Record<string, string>; updateUrl?: boolean }) {
  const [filters, setFilters] = useState(initial);
  const [rows, setRows] = useState<Result[]>([]);
  const [message, setMessage] = useState('Loading results…');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  async function load(next = filters, nextPage = page) {
    setBusy(true);
    setMessage('Loading results…');
    try {
      const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value));
      query.set('page', String(nextPage));
      const response = await fetch(`/api/public/results?${query}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Results could not be loaded.');
      setRows(body.results ?? []);
      setPage(body.page ?? nextPage);
      setTotal(body.total ?? 0);
      setTotalPages(body.totalPages ?? 1);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Results could not be loaded.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(initial, 1); }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    query.set('page', '1');
    if (updateUrl) window.history.replaceState(null, '', `/results?${query}`);
    void load(filters, 1);
  }

  const isEventScoped = Boolean(initial.event);

  return <div>
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      {!isEventScoped && <label className="text-xs font-semibold text-slate-600">Event ID<input aria-label="Event ID" value={filters.event ?? ''} onChange={(event) => setFilters({ ...filters, event: event.target.value })} placeholder="Event ID" className={`${inputClass} mt-1`} /></label>}
      <label className="text-xs font-semibold text-slate-600">Participant<input aria-label="Participant name" value={filters.participant ?? ''} onChange={(event) => setFilters({ ...filters, participant: event.target.value })} placeholder="Search participant" className={`${inputClass} mt-1`} /></label>
      <label className="text-xs font-semibold text-slate-600">Bib number<input aria-label="Bib number" value={filters.bib ?? ''} onChange={(event) => setFilters({ ...filters, bib: event.target.value })} placeholder="Search bib" className={`${inputClass} mt-1`} /></label>
      <label className="text-xs font-semibold text-slate-600">Category<input aria-label="Category" value={filters.category ?? ''} onChange={(event) => setFilters({ ...filters, category: event.target.value })} placeholder="Search category" className={`${inputClass} mt-1`} /></label>
      <button disabled={busy} className="min-h-10 self-end rounded-lg bg-[#0b2b5b] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#123b78] disabled:cursor-wait disabled:opacity-60">{busy ? 'Searching…' : 'Search results'}</button>
    </form>

    {message ? <p role={message.startsWith('Loading') ? 'status' : 'alert'} className={`mt-4 rounded-lg p-4 text-sm ${message.startsWith('Loading') ? 'bg-slate-50 text-slate-600' : 'border border-amber-200 bg-amber-50 text-amber-900'}`}>{message}</p> : rows.length ? <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Place</th><th className="px-4 py-3">Bib</th><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Finish time</th><th className="px-4 py-3">Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={`${row.event_id}-${row.bib}-${index}`} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-bold text-slate-700">{row.overall_rank ?? row.category_rank ?? row.classification_rank ?? '—'}</td><td className="px-4 py-3 font-mono font-semibold text-slate-700">{row.bib ?? '—'}</td><td className="px-4 py-3 font-semibold text-[#10213d]">{row.participant_name ?? '—'}</td><td className="px-4 py-3 text-slate-600">{row.category ?? '—'}</td><td className="px-4 py-3 font-mono tabular-nums text-slate-700">{row.gun_time ?? '—'}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold capitalize text-emerald-700">{row.status}</span></td></tr>)}</tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
        <span>Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, total)} of {total.toLocaleString()} results</span>
        <div className="flex items-center gap-2"><button type="button" disabled={busy || page <= 1} onClick={() => void load(filters, page - 1)} className="min-h-9 rounded-lg border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous</button><span className="px-1 font-semibold text-slate-700">Page {page} of {totalPages}</span><button type="button" disabled={busy || page >= totalPages} onClick={() => void load(filters, page + 1)} className="min-h-9 rounded-lg border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Next</button></div>
      </div>
    </div> : <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">No published results match your search.</p>}
  </div>;
}
