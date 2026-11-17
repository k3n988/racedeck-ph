'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Option = { label: string; value: string };
type List = { id: string; name: string; options: Option[] };
const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100';

export default function ValidationListsPage() {
  const [lists, setLists] = useState<List[]>([]);
  const [name, setName] = useState('');
  const [optionsText, setOptionsText] = useState('XS\nS\nM\nL\nXL');
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await fetch('/api/organizer/settings/validation-lists', { cache: 'no-store' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? 'Lists could not be loaded.'); setLists(body.lists ?? []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Lists could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function startEdit(list: List) { setEditing(list.id); setName(list.name); setOptionsText(list.options.map(option => option.label).join('\n')); setError(''); setNotice(''); }
  function reset() { setEditing(null); setName(''); setOptionsText(''); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    const labels = optionsText.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const options = labels.map(label => ({ label, value: label }));
    try {
      const response = await fetch('/api/organizer/settings/validation-lists', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(editing ? { id: editing } : {}), name, options }) });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? 'List could not be saved.');
      setNotice(`${body.list.name} saved.`); reset(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'List could not be saved.'); }
    finally { setSaving(false); }
  }
  async function remove(list: List) {
    if (!window.confirm(`Delete “${list.name}”? Event questions already using it keep their current options.`)) return;
    const response = await fetch('/api/organizer/settings/validation-lists', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: list.id }) });
    const body = await response.json().catch(() => ({})); if (!response.ok) { setError(body.error ?? 'List could not be deleted.'); return; }
    setNotice(`${list.name} deleted. Existing event questions keep their copied options.`); await load();
  }

  return <main className="min-h-full bg-slate-100 px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl space-y-5">
    <div><h2 className="text-lg font-bold text-[#101c33]">Reusable validation lists</h2><p className="mt-1 text-sm text-slate-600">Create option sets once, then apply them to dropdown, multiple choice, or radio questions in event registration forms. Applying a list copies its current options; later list edits do not change existing events.</p></div>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="font-bold text-[#101c33]">Your lists</h3></div>
        {loading ? <p role="status" className="p-5 text-sm text-slate-500">Loading lists…</p> : lists.length === 0 ? <div className="p-8 text-center"><p className="font-semibold text-slate-700">No validation lists yet</p><p className="mt-1 text-sm text-slate-500">Create a list such as shirt sizes, emergency contact relationships, or preferred distances.</p></div> : <ul className="divide-y divide-slate-100">{lists.map(list => <li key={list.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h4 className="font-semibold text-slate-800">{list.name}<span className="ml-2 text-xs font-normal text-slate-500">{list.options.length} options</span></h4><p className="mt-1 break-words text-xs leading-5 text-slate-500">{list.options.map(option => option.label).join(' · ')}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => startEdit(list)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button><button type="button" onClick={() => void remove(list)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700">Delete</button></div></li>)}</ul>}
      </section>
      <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-[#101c33]">{editing ? 'Edit list' : 'Create a list'}</h3><form onSubmit={save} className="mt-4 space-y-4"><label className="block text-sm font-semibold text-slate-700">List name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Shirt sizes" className={`${inputClass} mt-1.5`} /></label><label className="block text-sm font-semibold text-slate-700">Options <span className="font-normal text-slate-500">(one per line, up to 100)</span><textarea required rows={9} maxLength={14000} value={optionsText} onChange={event => setOptionsText(event.target.value)} placeholder={'Small\nMedium\nLarge'} className={`${inputClass} mt-1.5 font-normal`} /></label><p className="text-xs text-slate-500">Blank lines are ignored. Option text is also used as the saved answer value.</p><div className="flex justify-end gap-2">{editing && <button type="button" onClick={reset} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Cancel</button>}<button disabled={saving} className="rounded-lg bg-[#0b2b5b] px-4 py-2 text-sm font-bold text-white hover:bg-[#123b78] disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create list'}</button></div></form></section>
    </div>
  </div></main>;
}
