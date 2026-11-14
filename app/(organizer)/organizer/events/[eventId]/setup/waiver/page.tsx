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

const controlClass = 'mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const updateExistingDraft = selected?.status === 'draft';
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/waiver`, {
        method: updateExistingDraft ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateExistingDraft ? { id: selected.id, title, content } : { title, content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Waiver could not be saved.');
      await load(data.id);
      setMessage(updateExistingDraft ? 'Waiver draft updated.' : 'Changes saved as a new waiver draft. Activate it when it is ready for registration.');
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

  async function removeFromFutureRegistrations() {
    if (!selected || selected.status !== 'published' || !window.confirm('Remove this waiver from future registrations? Existing participant acceptances and version history will be preserved.')) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/waiver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, action: 'retire' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'The waiver could not be removed from future registrations.');
      await load(data.id);
      setMessage('Waiver removed from future registrations. Existing acceptances and history are preserved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The waiver could not be removed from future registrations.');
    } finally {
      setBusy(false);
    }
  }

  const isError = /could not|failed|error/i.test(message);

  return <main className="mx-auto max-w-6xl space-y-6 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    {message && !loading && <ToastFeedback message={String(message)} tone="auto">{isError ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div> : undefined}</ToastFeedback>}

    {loading ? <div role="status" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><span className="sr-only">Loading waiver settings…</span><div className="h-5 w-48 animate-pulse rounded bg-slate-200" /><div className="h-32 animate-pulse rounded-xl bg-slate-100" /></div> : !isError && <>
      <form onSubmit={(event) => void save(event)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold text-[#071b41]">{selected ? `Waiver version ${selected.version}` : 'New waiver draft'}</h2><p className="mt-1 text-sm text-slate-600">{selected?.status === 'published' ? 'Edit the fields below. Saving creates a draft; activate it to use the changes for future registrations.' : selected?.status === 'retired' ? 'Edit this version or create a new draft. Saving creates a draft without changing this archived version.' : !selected && waivers.length ? 'Edit the copied terms and save a draft. Activate it when it is ready for registration.' : 'Save a draft first, then activate it when it is ready for registration.'}</p></div>
          <div className="flex flex-wrap gap-2">
            {selected?.status === 'published' && <button type="button" disabled={busy} onClick={() => void removeFromFutureRegistrations()} className="min-h-10 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50">Remove waiver</button>}
          </div>
        </div>
        {selected?.status === 'published' && <p role="status" className="rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">Published terms and existing participant acceptances remain unchanged. Saving your edits creates a new draft version.</p>}
        <label className="block text-sm font-semibold text-slate-700">Waiver title
          <input required maxLength={240} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} className={controlClass} placeholder="e.g. Participant waiver and release" />
          <span className="mt-1 block text-xs font-normal text-slate-500">{title.length}/240 characters</span>
        </label>
        <label className="block text-sm font-semibold text-slate-700">Waiver terms
          <textarea required maxLength={10000} value={content} disabled={busy} onChange={(event) => setContent(event.target.value)} rows={12} className={`${controlClass} min-h-64 resize-y leading-6`} placeholder="Enter the terms participants must read and accept." />
          <span className="mt-1 block text-xs font-normal text-slate-500">{content.length}/10,000 characters.</span>
        </label>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          {selected?.status === 'draft' && <button type="button" disabled={busy} onClick={() => void activate()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Activate current version</button>}
          <button disabled={busy} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : selected?.status === 'published' || selected?.status === 'retired' ? 'Save as new draft' : 'Save draft'}</button>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-lg font-bold text-[#071b41]">Version history</h2><p className="mt-1 text-sm text-slate-600">Select a version to review its status and content.</p></div>
          <span className="text-xs font-semibold text-slate-500">{waivers.length} version{waivers.length === 1 ? '' : 's'}</span>
        </div>
        {waivers.length ? <ul className="mt-4 divide-y divide-slate-100">
          {waivers.map((waiver) => <li key={waiver.id}>
            <button type="button" aria-current={selected?.id === waiver.id ? 'true' : undefined} onClick={() => { setSelected(waiver); setTitle(waiver.title); setContent(waiver.content ?? ''); setMessage(''); }} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${selected?.id === waiver.id ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"><span className="font-semibold text-[#071b41]">Version {waiver.version}</span><span className="text-xs text-slate-500">{waiver.acceptance_count.toLocaleString()} acceptance{waiver.acceptance_count === 1 ? '' : 's'}</span></span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${waiver.status === 'published' ? 'bg-emerald-50 text-emerald-700' : waiver.status === 'draft' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{waiver.status}</span>
            </button>
          </li>)}
        </ul> : <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">No waiver versions yet.</p>}
      </section>
    </>}
  </main>;
}
