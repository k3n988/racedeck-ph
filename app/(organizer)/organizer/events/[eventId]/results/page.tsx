'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, LoaderCircle, Plus, Search, Trash2, Trophy, X } from 'lucide-react';
import { EventResultsShowcase } from '@/components/public/event-results-showcase';
import type { PublicWinnerGroup } from '@/lib/public/events';

type Category = { id: string; name: string; category_group_name: string | null; distance_km: number | null };
type Participant = { id: string; registration_number: string; name: string; gender: string | null; bib: string | number | null };
type Entry = { category_rank: number | null; registration_id: string; participant_display_name: string | null; bib_code: string | null; bib_number: number | null; gun_time: string | null };
type ResultGroup = { id: string; race_category_id: string | null; division: string | null; winner_limit: number | null; publication_status: 'draft' | 'published'; row_count: number; valid_row_count: number; published_at: string | null; updated_at: string; category: Category | null; entries: Entry[] };
type EventInfo = { id: string; name: string; event_date: string; banner_url: string | null };
type State = { categories: Category[]; divisions: string[]; groups: ResultGroup[]; canEdit: boolean; canPublish: boolean; auditLogs: Array<{ id: string; action: string; created_at: string; result_batch_id: string | null }> };
type FormEntry = { registration_id: string; participant: Participant | null; finish_time: string };

const panel = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const input = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#f3540b] px-4 text-sm font-bold text-white transition hover:bg-[#d94708] disabled:cursor-not-allowed disabled:opacity-50';

function categoryTitle(category: Category | null) { return category ? [category.category_group_name, category.name].filter((part, index, all) => part && (index === 0 || part.toLowerCase() !== all[0]?.toLowerCase())).join(' - ') : 'Race category'; }
function formatTime(value: string | null) { if (!value) return ''; const match = value.match(/^(\d{1,3}):([0-5]\d):([0-5]\d)/); return match ? `${match[1].padStart(2, '0')}:${match[2]}:${match[3]}` : value.slice(0, 8); }

export default function OrganizerEventResultsPage({ params }: { params: { eventId: string } }) {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [modal, setModal] = useState<'form' | 'preview' | null>(null);
  const [editing, setEditing] = useState<ResultGroup | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [division, setDivision] = useState('overall');
  const [winnerCount, setWinnerCount] = useState('3');
  const [customWinnerCount, setCustomWinnerCount] = useState('');
  const [entries, setEntries] = useState<FormEntry[]>([]);
  const [queries, setQueries] = useState<string[]>([]);
  const [options, setOptions] = useState<Participant[][]>([]);
  const [searching, setSearching] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [workingGroup, setWorkingGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [eventResponse, response] = await Promise.all([
        fetch(`/api/organizer/events/${params.eventId}`, { cache: 'no-store' }),
        fetch(`/api/organizer/events/${params.eventId}/result-groups`, { cache: 'no-store' }),
      ]);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Results could not be loaded.');
      const eventBody = await eventResponse.json().catch(() => ({}));
      const eventData = eventBody.event ?? eventBody;
      setEvent({ id: params.eventId, name: eventData.name ?? 'Event results', event_date: eventData.event_date ?? '', banner_url: eventData.banner_url ?? null });
      setState(body as State);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Results could not be loaded.'); }
    finally { setLoading(false); }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(null), 3600); return () => window.clearTimeout(timeout); }, [toast]);
  useEffect(() => { setQueries([]); setOptions([]); setSearching(null); }, [categoryId, division]);
  useEffect(() => {
    if (!modal) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modal]);

  const category = state?.categories.find((item) => item.id === categoryId) ?? null;
  const resolvedWinnerCount = winnerCount === 'custom' ? Number(customWinnerCount) : Number(winnerCount);
  const existingIds = useMemo(() => new Set(entries.map((entry) => entry.registration_id).filter(Boolean)), [entries]);

  function newGroup(group: ResultGroup | null = null) {
    if (!state?.categories.length) { setToast({ kind: 'error', message: 'Add a race category in event setup before entering results.' }); return; }
    const supportedDivisions = state.divisions.length ? state.divisions : ['overall'];
    if (!group && state.categories.every((item) => supportedDivisions.every((value) => state.groups.some((existing) => existing.race_category_id === item.id && existing.division === value)))) { setToast({ kind: 'error', message: 'A result group already exists for every supported category and division. Edit an existing group to change it.' }); return; }
    const availablePair = !group ? state.categories.flatMap((item) => supportedDivisions.map((value) => ({ categoryId: item.id, division: value }))).find((pair) => !state.groups.some((existing) => existing.race_category_id === pair.categoryId && existing.division === pair.division)) : null;
    setEditing(group);
    setCategoryId(group?.race_category_id ?? availablePair?.categoryId ?? state.categories[0].id);
    setDivision(group?.division ?? availablePair?.division ?? state.divisions[0] ?? 'overall');
    setWinnerCount([3, 5, 10].includes(group?.winner_limit ?? 3) ? String(group?.winner_limit ?? 3) : 'custom');
    setCustomWinnerCount([3, 5, 10].includes(group?.winner_limit ?? 3) ? '' : String(group?.winner_limit ?? ''));
    const initialEntries: FormEntry[] = Array.from({ length: group?.winner_limit ?? 3 }, () => ({ registration_id: '', participant: null, finish_time: '' }));
    (group?.entries ?? []).forEach((entry, index) => { const rankIndex = (entry.category_rank ?? index + 1) - 1; if (rankIndex >= 0 && rankIndex < 100) initialEntries[rankIndex] = { registration_id: entry.registration_id, participant: { id: entry.registration_id, name: entry.participant_display_name ?? 'Participant', registration_number: '', gender: null, bib: entry.bib_code ?? entry.bib_number }, finish_time: formatTime(entry.gun_time) }; });
    setEntries(initialEntries);
    setQueries([]); setOptions([]); setModal('form');
  }

  useEffect(() => {
    if (!modal || modal !== 'form' || !categoryId) return;
    const timers = queries.map((query, index) => {
      const q = query.trim();
      if (q.length < 2 || entries[index]?.participant) return undefined;
      return window.setTimeout(async () => {
        setSearching(index);
        try {
          const search = new URLSearchParams({ category: categoryId, division, q });
          const response = await fetch(`/api/organizer/events/${params.eventId}/result-groups/participants?${search}`, { cache: 'no-store' });
          const body = await response.json().catch(() => ({}));
          if (response.ok) setOptions((previous) => { const next = [...previous]; next[index] = (body.participants ?? []).filter((person: Participant) => !existingIds.has(person.id)); return next; });
        } finally { setSearching((current) => current === index ? null : current); }
      }, 250);
    });
    return () => timers.forEach((timer) => { if (timer) window.clearTimeout(timer); });
  }, [categoryId, division, entries, existingIds, modal, params.eventId, queries]);

  function updateEntry(index: number, patch: Partial<FormEntry>) { setEntries((current) => current.map((entry, position) => position === index ? { ...entry, ...patch } : entry)); }
  function setRankCount(value: string) { setWinnerCount(value); if (value !== 'custom') { const count = Number(value); setEntries((current) => Array.from({ length: count }, (_, index) => current[index] ?? { registration_id: '', participant: null, finish_time: '' })); } }
  function moveEntry(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= entries.length) return; setEntries((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  function removeEntry(index: number) { setEntries((current) => { const next = [...current]; next.splice(index, 1); next.push({ registration_id: '', participant: null, finish_time: '' }); return next; }); setQueries((current) => { const next = [...current]; next.splice(index, 1); next.push(''); return next; }); setOptions((current) => { const next = [...current]; next.splice(index, 1); next.push([]); return next; }); }

  async function saveDraft(action: 'save' | 'publish' = 'save') {
    if (!categoryId || !Number.isInteger(resolvedWinnerCount) || resolvedWinnerCount < 1 || resolvedWinnerCount > 100) { setToast({ kind: 'error', message: 'Choose a valid winner count between 1 and 100.' }); return; }
    if (action === 'publish') {
      const selected = entries.filter((entry) => entry.registration_id);
      if (!selected.length) { setToast({ kind: 'error', message: 'Add at least one registered participant before publishing.' }); return; }
      if (selected.length < resolvedWinnerCount && !window.confirm(`You have selected ${selected.length} of ${resolvedWinnerCount} possible winners. Publish these results?`)) return;
      const filledIndexes = entries.map((entry, index) => entry.registration_id ? index + 1 : null).filter((rank): rank is number => rank !== null);
      if (filledIndexes.some((rank, index) => rank !== index + 1)) { setToast({ kind: 'error', message: 'Fill rankings from first place down without gaps before publishing.' }); return; }
    }
    if (entries.some((entry) => entry.registration_id && entry.finish_time.trim() && !/^\d{1,3}:[0-5]\d:[0-5]\d(?:\.\d{1,3})?$/.test(entry.finish_time.trim()))) { setToast({ kind: 'error', message: 'Finish times must use HH:MM:SS format.' }); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/result-groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: editing?.id ?? null, race_category_id: categoryId, division, winner_limit: resolvedWinnerCount, entries: entries.map((entry, index) => ({ rank: index + 1, registration_id: entry.registration_id, finish_time: entry.finish_time.trim() })).filter((entry) => entry.registration_id) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Results could not be saved.');
      const groupId = body.group_id as string;
      if (action === 'publish') {
        const publishResponse = await fetch(`/api/organizer/events/${params.eventId}/result-groups/${groupId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }) });
        const publishBody = await publishResponse.json().catch(() => ({}));
        if (!publishResponse.ok) throw new Error(publishBody.error ?? 'Results could not be published.');
      }
      setToast({ kind: 'success', message: action === 'publish' ? 'Results published.' : 'Draft saved.' });
      setModal(null); await load();
    } catch (saveError) { setToast({ kind: 'error', message: saveError instanceof Error ? saveError.message : 'Results could not be saved.' }); }
    finally { setSaving(false); }
  }

  async function transition(group: ResultGroup, action: 'publish' | 'unpublish' | 'delete') {
    const wording = action === 'delete' ? 'Delete this result group and its entries? This cannot be undone.' : action === 'unpublish' ? 'Unpublish these results? They will no longer appear publicly.' : 'Publish these results now?';
    if (!window.confirm(wording)) return;
    setWorkingGroup(group.id);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/result-groups/${group.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Result group could not be updated.');
      setToast({ kind: 'success', message: action === 'delete' ? 'Result group deleted.' : action === 'publish' ? 'Results published.' : 'Results unpublished.' });
      await load();
    } catch (actionError) { setToast({ kind: 'error', message: actionError instanceof Error ? actionError.message : 'Result group could not be updated.' }); }
    finally { setWorkingGroup(null); }
  }

  function previewGroup(group: ResultGroup | null = null) {
    if (group) {
      setEditing(group); setCategoryId(group.race_category_id ?? ''); setDivision(group.division ?? 'overall'); setWinnerCount([3, 5, 10].includes(group.winner_limit ?? 3) ? String(group.winner_limit ?? 3) : 'custom'); setCustomWinnerCount([3, 5, 10].includes(group.winner_limit ?? 3) ? '' : String(group.winner_limit ?? ''));
      const previewEntries: FormEntry[] = Array.from({ length: group.winner_limit ?? 3 }, () => ({ registration_id: '', participant: null, finish_time: '' }));
      group.entries.forEach((entry, index) => { const rankIndex = (entry.category_rank ?? index + 1) - 1; if (rankIndex >= 0 && rankIndex < 100) previewEntries[rankIndex] = { registration_id: entry.registration_id, participant: { id: entry.registration_id, name: entry.participant_display_name ?? 'Participant', registration_number: '', gender: null, bib: entry.bib_code ?? entry.bib_number }, finish_time: formatTime(entry.gun_time) }; });
      setEntries(previewEntries);
    }
    setModal('preview');
  }

  const previewGroupData: PublicWinnerGroup | null = event && category ? { id: editing?.id ?? 'preview', title: `${categoryTitle(category)}${division !== 'overall' ? ` ${division[0].toUpperCase()}${division.slice(1)}` : ' Overall/Open'} — Top ${resolvedWinnerCount || 3}`, distance: category.distance_km == null ? null : `${category.distance_km} km`, total: entries.filter((entry) => entry.participant).length, winnerLimit: resolvedWinnerCount || 3, division, winners: entries.flatMap((entry, index) => entry.participant ? [{ rank: index + 1, bib: entry.participant.bib, name: entry.participant.name, finish_time: entry.finish_time }] : []) } : null;

  if (loading) return <main className="min-h-full bg-[#f4f6fa] p-6"><p role="status" className={`${panel} mx-auto max-w-7xl p-5 text-sm text-slate-600`}>Loading race results…</p></main>;
  if (error) return <main className="min-h-full bg-[#f4f6fa] p-6"><div role="alert" className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}<button className={button} onClick={() => void load()}>Try again</button></div></main>;

  return <main className="min-h-full bg-[#f4f6fa] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-extrabold text-[#10213d]">Race Results</h1><p className="mt-1 text-sm text-slate-600">{event?.name ?? 'Event'}</p></div>{state?.canEdit && <button type="button" onClick={() => newGroup()} className={primary}><Plus className="h-4 w-4" />Add Results</button>}</div>
      {!state?.categories.length && <div className={`${panel} border-amber-200 bg-amber-50 p-4 text-sm text-amber-900`}>Add event categories before creating result groups.</div>}
      <section className={`${panel} overflow-hidden`} aria-label="Result groups">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-bold text-[#10213d]">Result groups</h2><p className="mt-1 text-sm text-slate-500">Manage published leaderboards and saved drafts.</p></div><span className="text-sm text-slate-500">{state?.groups.length ?? 0} groups</span></div>
        {state?.groups.length ? <div className="overflow-x-auto"><table className="w-full min-w-[790px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Race category</th><th className="px-5 py-3">Division</th><th className="px-5 py-3">Winners</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{state.groups.map((group) => <tr key={group.id} className="align-middle"><td className="px-5 py-4 font-semibold text-slate-800">{categoryTitle(group.category)}</td><td className="px-5 py-4 capitalize text-slate-600">{group.division === 'overall' ? 'Overall/Open' : group.division}</td><td className="px-5 py-4 text-slate-600">{group.valid_row_count} / {group.winner_limit}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${group.publication_status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{group.publication_status === 'published' ? 'Published' : 'Draft'}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2">{group.publication_status === 'published' && <button type="button" className={button} onClick={() => previewGroup(group)}><Eye className="h-4 w-4" />Preview</button>}{state.canEdit && <button type="button" className={button} onClick={() => newGroup(group)}>Edit</button>}{group.publication_status === 'draft' && state.canPublish && <button type="button" className={primary} disabled={workingGroup === group.id} onClick={() => void transition(group, 'publish')}>Publish</button>}{group.publication_status === 'published' && state.canPublish && <button type="button" className={button} disabled={workingGroup === group.id} onClick={() => void transition(group, 'unpublish')}>Unpublish</button>}{state.canEdit && <button aria-label="Delete result group" title="Delete result group" type="button" disabled={workingGroup === group.id} onClick={() => void transition(group, 'delete')} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>}</div></td></tr>)}</tbody></table></div> : <div className="px-6 py-14 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><Trophy className="h-5 w-5" /></span><h3 className="mt-3 font-bold text-[#10213d]">No results added yet</h3><p className="mt-1 text-sm text-slate-600">Add a result group to start building this event’s leaderboard.</p></div>}
      </section>

      {state?.auditLogs?.length ? <details className={`${panel} p-5`}><summary className="cursor-pointer font-bold text-[#10213d]">Recent result changes</summary><ul className="mt-4 divide-y divide-slate-100">{state.auditLogs.map((log) => <li key={log.id} className="flex justify-between gap-4 py-2 text-sm text-slate-600"><span className="capitalize">{log.action} result group</span><time>{new Date(log.created_at).toLocaleString()}</time></li>)}</ul></details> : null}
    </div>

    {toast && <div role={toast.kind === 'error' ? 'alert' : 'status'} className={`fixed right-5 top-5 z-[90] max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${toast.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{toast.message}</div>}

    {modal && <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6" role="presentation" onMouseDown={(click) => { if (click.target === click.currentTarget) setModal(null); }}><section role="dialog" aria-modal="true" aria-labelledby="results-form-title" className="my-auto max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-[#f4f6fa] shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><div><h2 id="results-form-title" className="text-lg font-extrabold text-[#10213d]">{modal === 'preview' ? 'Public results preview' : editing ? 'Edit results' : 'Add Results'}</h2>{event && <p className="mt-0.5 text-sm text-slate-500">{event.name}</p>}</div><button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setModal(null)}><X className="h-5 w-5" /></button></div>
      {modal === 'preview' ? <div className="p-4 sm:p-6">{event && previewGroupData ? <EventResultsShowcase eventName={event.name} eventDate={event.event_date} bannerUrl={event.banner_url} groups={[previewGroupData]} /> : <p className={`${panel} p-6 text-sm text-slate-600`}>Select a category and participant before previewing this group.</p>}<div className="mt-4 flex justify-end"><button className={button} onClick={() => setModal('form')}>Back to editing</button></div></div> : <div className="space-y-4 p-4 sm:p-6">
        <section className={`${panel} p-4 sm:p-5`}><h3 className="font-bold text-[#10213d]">Result group setup</h3><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold text-slate-700">Race category<select className={`${input} mt-1`} value={categoryId} onChange={(change) => { setCategoryId(change.target.value); setEntries((current) => current.map(() => ({ registration_id: '', participant: null, finish_time: '' }))); }}><option value="">Select category</option>{state?.categories.map((item) => <option key={item.id} value={item.id}>{categoryTitle(item)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Division<select className={`${input} mt-1`} value={division} onChange={(change) => { setDivision(change.target.value); setEntries((current) => current.map(() => ({ registration_id: '', participant: null, finish_time: '' }))); }}>{(state?.divisions.length ? state.divisions : ['overall']).map((item) => <option key={item} value={item}>{item === 'overall' ? 'Overall / Open' : `${item[0].toUpperCase()}${item.slice(1)}`}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Number of winners<select className={`${input} mt-1`} value={winnerCount} onChange={(change) => setRankCount(change.target.value)}><option value="3">Top 3</option><option value="5">Top 5</option><option value="10">Top 10</option><option value="custom">Custom</option></select></label>{winnerCount === 'custom' && <label className="text-sm font-semibold text-slate-700 sm:col-start-3">Custom winner count<input className={`${input} mt-1`} type="number" min={1} max={100} value={customWinnerCount} onChange={(change) => { const count = Number(change.target.value); setCustomWinnerCount(change.target.value); if (Number.isInteger(count) && count > 0 && count <= 100) setEntries((current) => Array.from({ length: count }, (_, index) => current[index] ?? { registration_id: '', participant: null, finish_time: '' })); }} /></label>}</div><p className="mt-3 text-xs text-slate-500">Participants are limited to non-cancelled registrations in this event category.</p></section>
        <section className={`${panel} overflow-hidden`}><div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5"><div><h3 className="font-bold text-[#10213d]">Ranked participants</h3><p className="mt-1 text-sm text-slate-500">Assign places manually. Finish times are optional.</p></div><span className="text-xs font-semibold text-slate-500">{entries.filter((entry) => entry.registration_id).length} selected</span></div><div className="divide-y divide-slate-100">{entries.map((entry, index) => <div key={index} className="grid items-start gap-3 px-4 py-4 sm:grid-cols-[64px_minmax(0,1fr)_160px_132px] sm:items-center sm:px-5"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-orange-50 text-sm font-extrabold text-orange-700">{index + 1}</span><span className="text-xs font-semibold text-slate-500">{index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`}</span></div><div className="relative"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${input} pl-9`} value={entry.participant?.name ?? queries[index] ?? ''} disabled={!categoryId} placeholder="Search name, registration ID, or bib" onChange={(change) => { updateEntry(index, { registration_id: '', participant: null }); setQueries((current) => { const next = [...current]; next[index] = change.target.value; return next; }); }} /></div>{searching === index && <span className="absolute right-3 top-3"><LoaderCircle className="h-4 w-4 animate-spin text-slate-400" /></span>}{Boolean((options[index]?.length ?? 0) && !entry.participant) && <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">{options[index].map((person) => <li key={person.id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => { updateEntry(index, { registration_id: person.id, participant: person }); setQueries((current) => { const next = [...current]; next[index] = ''; return next; }); setOptions((current) => { const next = [...current]; next[index] = []; return next; }); }}><span className="block text-sm font-semibold text-slate-800">{person.name}</span><span className="block text-xs text-slate-500">{person.registration_number}{person.bib ? ` · Bib ${person.bib}` : ''}</span></button></li>)}</ul>}</div><div className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm text-slate-600"><span className="text-xs uppercase text-slate-400">Bib</span><span className="font-mono font-semibold">{entry.participant?.bib ?? '—'}</span></div><div className="flex items-center gap-1"><input aria-label={`Finish time for rank ${index + 1}`} className={`${input} min-w-0 px-2 font-mono`} placeholder="HH:MM:SS" value={entry.finish_time} onChange={(change) => updateEntry(index, { finish_time: change.target.value })} /><button type="button" aria-label={`Move rank ${index + 1} up`} title="Move up" disabled={index === 0} onClick={() => moveEntry(index, -1)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label={`Move rank ${index + 1} down`} title="Move down" disabled={index === entries.length - 1} onClick={() => moveEntry(index, 1)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button><button type="button" aria-label={`Remove participant at rank ${index + 1}`} title="Remove participant" onClick={() => removeEntry(index)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-red-200 text-red-700 hover:bg-red-50"><X className="h-4 w-4" /></button></div></div>)}</div></section>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#f4f6fa] py-3"><button type="button" className={button} onClick={() => previewGroup()}>Preview</button><div className="flex flex-wrap justify-end gap-2"><button type="button" className={button} disabled={saving} onClick={() => setModal(null)}>Cancel</button><button type="button" className={button} disabled={saving || !state?.canEdit} onClick={() => void saveDraft('save')}>{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Save draft</button><button type="button" className={primary} disabled={saving || !state?.canEdit || !state?.canPublish} onClick={() => void saveDraft('publish')}>{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Publish results</button></div></div>
      </div>}
    </section></div>}
  </main>;
}
