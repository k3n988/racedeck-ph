'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Assignment = {
  id: string;
  registration_number: string;
  status: string;
  first_name?: string;
  last_name?: string;
  category_id: string;
  race_categories: { id: string; name: string } | { id: string; name: string }[] | null;
  payments: { status: string } | { status: string }[] | null;
  bibs: { id: string; bib_number: number; bib_code: string; status: string } | { id: string; bib_number: number; bib_code: string; status: string }[] | null;
};
type Category = { id: string; name: string };

const controlClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const one = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value;
const statusLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function BibManagementPage({ params }: { params: { eventId: string } }) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [assignment, setAssignment] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [bibNumber, setBibNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ search: search.trim(), assignment, page_size: '100' });
      if (categoryId) query.set('category_id', categoryId);
      const [response, categoryResponse] = await Promise.all([
        fetch(`/api/organizer/events/${params.eventId}/bib-management?${query}`, { cache: 'no-store' }),
        fetch(`/api/organizer/events/${params.eventId}/categories`, { cache: 'no-store' }),
      ]);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Bib assignments could not be loaded.');
      const categoryData = categoryResponse.ok ? await categoryResponse.json().catch(() => []) : [];
      setItems(Array.isArray(body.assignments) ? body.assignments : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setSelected([]);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bib assignments could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [assignment, categoryId, params.eventId, search]);

  // Search is applied only on submit so the list does not reload on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [params.eventId, assignment, categoryId]);

  async function submit(action: 'manual' | 'bulk' | 'reassign' | 'unassign', extra: Record<string, unknown>) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/bib-management`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Bib operation failed.');
      setBibNumber('');
      await load();
      setMessage('Bib assignment updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bib operation failed.');
    } finally {
      setBusy(false);
    }
  }

  function assignSelected() {
    const number = Number(bibNumber);
    if (!Number.isInteger(number) || number <= 0) {
      setMessage('Enter a valid starting bib number.');
      return;
    }
    if (selected.length === 1) void submit('manual', { registration_id: selected[0], bib_number: number });
    else if (selected.length > 1) void submit('bulk', { registration_ids: selected, start_number: number });
    else setMessage('Select at least one confirmed, unassigned registration.');
  }

  async function exportCsv() {
    setExporting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/bib-management?export=csv`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? 'Bib export could not be prepared.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${params.eventId}-bib-assignments.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bib export could not be prepared.');
    } finally {
      setExporting(false);
    }
  }

  const loadFailed = /bib assignments could not be loaded/i.test(message);

  return <main className="mx-auto max-w-7xl space-y-6 bg-[#f4f6fa] p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event operations</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Bib Management</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Assign and manage participant bib numbers. Bibs are separate from registration QR credentials.</p></div>
      <button type="button" onClick={() => void exportCsv()} disabled={exporting || loading || items.length === 0} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#0b2b5b] transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">{exporting ? 'Preparing export…' : 'Export CSV'}</button>
    </header>

    {message && <ToastFeedback message={String(message)} tone="auto">{loadFailed ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Refresh bib assignments</button></div> : undefined}</ToastFeedback>}

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4"><h2 className="font-bold text-[#071b41]">Find registrations</h2><p className="mt-1 text-sm text-slate-600">Search by participant or registration number, then narrow the list by category or assignment status.</p></div>
      <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void load(); }} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1.5fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto] xl:items-end">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or registration number" className={`${controlClass} mt-1.5 text-sm font-normal normal-case tracking-normal`} /></label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Race category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={`${controlClass} mt-1.5 text-sm font-normal normal-case tracking-normal`}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Bib assignment<select value={assignment} onChange={(event) => setAssignment(event.target.value)} className={`${controlClass} mt-1.5 text-sm font-normal normal-case tracking-normal`}><option value="">All registrations</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select></label>
        <button type="submit" disabled={loading} className="min-h-11 rounded-xl bg-[#0b2b5b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#123b78] disabled:opacity-50">{loading ? 'Loading…' : 'Search'}</button>
      </form>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="font-bold text-[#071b41]">Assign bibs</h2><p className="mt-1 text-sm text-slate-600">Select confirmed registrations below and enter a starting number for bulk assignment.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block text-xs font-semibold text-slate-600">Starting bib number<input type="number" min="1" step="1" inputMode="numeric" value={bibNumber} onChange={(event) => setBibNumber(event.target.value)} placeholder="e.g. 101" className={`${controlClass} mt-1 min-w-40`} /></label>
          <button type="button" disabled={busy || loading || selected.length === 0 || !bibNumber} onClick={assignSelected} className="min-h-11 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Assigning…' : selected.length > 1 ? `Assign ${selected.length} bibs` : 'Assign bib'}</button>
        </div>
      </div>

      {loading ? <div role="status" className="mt-4 space-y-3 border-t border-slate-100 pt-4"><span className="sr-only">Loading bib assignments…</span><div className="h-12 animate-pulse rounded-lg bg-slate-100" /><div className="h-12 animate-pulse rounded-lg bg-slate-100" /></div> : loadFailed ? <p className="mt-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">Bib assignments could not be displayed.</p> : items.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">No registrations match these filters.</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-12 px-3 py-3"><span className="sr-only">Select</span></th><th className="px-3 py-3">Bib</th><th className="px-3 py-3">Participant</th><th className="px-3 py-3">Registration #</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Registration</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{items.map((item) => {
            const bib = one(item.bibs);
            const category = one(item.race_categories);
            const payment = one(item.payments);
            const assigned = Boolean(bib && bib.status === 'active');
            const canSelect = !assigned && item.status === 'confirmed';
            return <tr key={item.id} className="text-slate-700 hover:bg-slate-50/70">
              <td className="px-3 py-3"><input type="checkbox" aria-label={`Select registration ${item.registration_number}`} disabled={!canSelect || busy} checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} className="h-4 w-4 accent-orange-600" /></td>
              <td className="px-3 py-3 font-mono font-bold text-[#0b2b5b]">{assigned ? bib?.bib_code : <span className="font-sans font-normal text-slate-500">Unassigned</span>}</td>
              <td className="px-3 py-3 font-medium">{item.first_name ? `${item.first_name} ${item.last_name ?? ''}`.trim() : 'Participant details restricted'}</td>
              <td className="px-3 py-3">{item.registration_number}</td><td className="px-3 py-3">{category?.name ?? '—'}</td>
              <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{statusLabel(item.status)}</span></td>
              <td className="px-3 py-3">{payment ? statusLabel(payment.status) : '—'}</td>
              <td className="px-3 py-3">{assigned && <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => { const next = window.prompt('New bib number', String(bib?.bib_number ?? '')); const number = Number(next); if (next && Number.isInteger(number) && number > 0) void submit('reassign', { bib_id: bib?.id, bib_number: number }); else if (next) setMessage('Enter a positive whole bib number.'); }} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">Reassign</button><button type="button" disabled={busy} onClick={() => { if (window.confirm('Release this bib? This is blocked if results or kit claims use it.')) void submit('unassign', { bib_id: bib?.id }); }} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">Unassign</button></div>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </section>
  </main>;
}
