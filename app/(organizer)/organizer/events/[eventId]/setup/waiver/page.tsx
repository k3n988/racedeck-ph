'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Waiver = {
  id: string;
  title: string;
  version: number;
  content: string | null;
  status: 'draft' | 'published' | 'retired';
  effective_at: string;
  created_at: string;
  updated_at: string;
  acceptance_count: number;
};

const controlClass = 'mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export default function OrganizerWaiverPage({ params }: { params: { eventId: string } }) {
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [selected, setSelected] = useState<Waiver | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async (preferredId?: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/waiver`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Waiver could not be loaded.');
      const next = Array.isArray(data.waivers) ? data.waivers as Waiver[] : [];
      const current = next.find((waiver) => waiver.id === preferredId) ?? next.find((waiver) => waiver.status === 'published') ?? next[0] ?? null;
      setWaivers(next);
      setSelected(current);
      setTitle(current?.title ?? '');
      setContent(current?.content ?? '');
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Waiver could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  function newVersion() {
    setSelected(null);
    setTitle('');
    setContent('');
    setMessage('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/waiver`, {
        method: selected ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected ? { id: selected.id, title, content } : { title, content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Waiver could not be saved.');
      await load(data.id);
      setMessage('Waiver saved as a draft.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Waiver could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!selected || selected.status !== 'draft' || !window.confirm('Activate this waiver version for future registrations?')) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/waiver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, action: 'publish' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Waiver could not be activated.');
      await load(selected.id);
      setMessage('Waiver activated for future registrations.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Waiver could not be activated.');
    } finally {
      setBusy(false);
    }
  }

  const selectedIsEditable = !selected || selected.status === 'draft';
  const isError = /could not|failed|error/i.test(message);

  return <main className="mx-auto max-w-6xl space-y-6 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    <header className="border-b border-slate-200 pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event setup</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Event Waiver</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Manage the waiver participants review and accept during registration. Published versions stay on record for existing acceptances.</p>
    </header>

    {message && !loading && <ToastFeedback message={String(message)} tone="auto">{isError ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div> : undefined}</ToastFeedback>}

    {loading ? <div role="status" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><span className="sr-only">Loading waiver settings…</span><div className="h-5 w-48 animate-pulse rounded bg-slate-200" /><div className="h-32 animate-pulse rounded-xl bg-slate-100" /></div> : !isError && <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current version</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-[#071b41]">{selected ? `Version ${selected.version}` : 'No waiver configured'}</h2>
              {selected && <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${selected.status === 'published' ? 'bg-emerald-50 text-emerald-700' : selected.status === 'draft' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{selected.status}</span>}
            </div>
            <p className="mt-1 text-sm text-slate-600">{selected ? `${selected.acceptance_count.toLocaleString()} participant acceptance${selected.acceptance_count === 1 ? '' : 's'}` : 'Create a waiver draft to add terms for participants.'}</p>
          </div>
          <button type="button" disabled={busy} onClick={newVersion} className="min-h-10 shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-[#0b2b5b] transition hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50">{waivers.length ? 'Create new version' : 'Create waiver'}</button>
        </div>
        {selected?.acceptance_count ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">This version has participant acceptances, so its legal content is preserved. Create a new version to change the terms.</p> : null}
      </section>

      <form onSubmit={(event) => void save(event)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-[#071b41]">{selected ? 'Waiver content' : 'New waiver draft'}</h2>
          <p className="mt-1 text-sm text-slate-600">Save a draft first, then activate it when it is ready for registration.</p>
        </div>
        {!selectedIsEditable && <p role="status" className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">This version is {selected?.status}. Its content is read-only; create a new version to make changes.</p>}
        <label className="block text-sm font-semibold text-slate-700">Waiver title
          <input required maxLength={240} value={title} disabled={busy || !selectedIsEditable} onChange={(event) => setTitle(event.target.value)} className={controlClass} placeholder="e.g. Participant waiver and release" />
          <span className="mt-1 block text-xs font-normal text-slate-500">{title.length}/240 characters</span>
        </label>
        <label className="block text-sm font-semibold text-slate-700">Waiver terms
          <textarea required value={content} disabled={busy || !selectedIsEditable} onChange={(event) => setContent(event.target.value)} rows={12} className={`${controlClass} min-h-64 resize-y leading-6`} placeholder="Enter the terms participants must read and accept." />
        </label>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          {selected?.status === 'draft' && <button type="button" disabled={busy} onClick={() => void activate()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Activate current version</button>}
          <button disabled={busy || !selectedIsEditable} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Save draft'}</button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-lg font-bold text-[#071b41]">Version history</h2><p className="mt-1 text-sm text-slate-600">Select a version to review its status and content.</p></div>
          <span className="text-xs font-semibold text-slate-500">{waivers.length} version{waivers.length === 1 ? '' : 's'}</span>
        </div>
        {waivers.length ? <ul className="mt-4 divide-y divide-slate-100">
          {waivers.map((waiver) => <li key={waiver.id}>
            <button type="button" aria-current={selected?.id === waiver.id ? 'true' : undefined} onClick={() => { setSelected(waiver); setTitle(waiver.title); setContent(waiver.content ?? ''); setMessage(''); }} className={`flex min-h-16 w-full flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition ${selected?.id === waiver.id ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-slate-50'}`}>
              <span><span className="block font-semibold text-[#071b41]">Version {waiver.version}</span><span className="mt-1 block text-xs text-slate-500">{waiver.acceptance_count.toLocaleString()} acceptance{waiver.acceptance_count === 1 ? '' : 's'}</span></span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${waiver.status === 'published' ? 'bg-emerald-50 text-emerald-700' : waiver.status === 'draft' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{waiver.status}</span>
            </button>
          </li>)}
        </ul> : <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">No waiver versions yet.</p>}
      </section>
    </>}
  </main>;
}
