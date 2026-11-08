'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CUSTOM_FIELD_TYPES, CUSTOM_FIELD_TYPE_LABELS, type CustomFieldType } from '@/lib/registration-form/config';

type Option = { id: string; field_id: string; label: string; value: string; display_order: number };
type Field = { id: string; label: string; field_type: string; section_key: 'additional' | 'health'; is_required: boolean; is_active: boolean; display_order: number; options: Option[] };
type FieldForm = { label: string; field_type: CustomFieldType; section_key: 'additional' | 'health'; is_required: boolean; is_active: boolean; display_order: number };

const blank: FieldForm = { label: '', field_type: 'short_text', section_key: 'additional', is_required: false, is_active: true, display_order: 0 };
const DEFAULT_FIELDS = ['First name', 'Middle name (optional)', 'Last name', 'Birthdate', 'Gender (optional)', 'Email', 'Contact number', 'Address', 'Emergency contact person', 'Emergency contact phone', 'Relationship to participant'];
const controlClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100';

export default function RegistrationFormPage({ params }: { params: { eventId: string } }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [form, setForm] = useState<FieldForm>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/registration-form`, { cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? `Could not load registration fields (${response.status}).`);
      if (!Array.isArray(body)) throw new Error('The registration form returned an unexpected response. Please retry.');
      setFields(body as Field[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Registration form could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  function open(field?: Field) {
    setEditing(field?.id ?? null);
    setForm(field ? { label: field.label, field_type: field.field_type as CustomFieldType, section_key: field.section_key ?? 'additional', is_required: field.is_required, is_active: field.is_active, display_order: field.display_order } : { ...blank, display_order: fields.length });
    setModal(true);
    setError('');
    setNotice('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch(`/api/organizer/events/${params.eventId}/registration-form${editing ? `/${editing}` : ''}`, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? 'Field could not be saved.'); return; }
    setModal(false);
    setEditing(null);
    setNotice(form.label + (editing ? ' was updated.' : ' was added.'));
    await load();
  }

  async function remove(field: Field) {
    if (!window.confirm(`Delete “${field.label}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/organizer/events/${params.eventId}/registration-form/${field.id}`, { method: 'DELETE' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error ?? 'Field could not be deleted.'); return; }
    setNotice(`${field.label} was deleted.`);
    await load();
  }

  return (
    <main className="min-h-full bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event setup</p>
            <h1 className="mt-1 text-2xl font-extrabold text-[#101c33] sm:text-3xl">Registration Form</h1>
            <p className="mt-1 text-sm text-slate-600">Choose the information participants need to provide when they register.</p>
          </div>
          <button type="button" onClick={() => open()} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2">
            <span aria-hidden="true" className="mr-2 text-lg leading-none">+</span> Add custom field
          </button>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-l-4 border-orange-500 px-5 py-4 sm:px-6">
            <h2 className="font-bold text-[#101c33]">RaceDeck default fields</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">These standard participant details are collected automatically. Add only event-specific questions below; default fields cannot be duplicated.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DEFAULT_FIELDS.map((field) => <span key={field} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{field}</span>)}
            </div>
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-600 sm:px-6">
            <span className="font-bold text-[#0b2b5b]">Competition classification:</span> Optional event information for ranking when needed.
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <h2 className="font-bold text-[#101c33]">Event-specific questions</h2>
              <p className="mt-1 text-sm text-slate-600">Use short or long text, dropdowns, radio choices, checkboxes, or yes/no questions.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{fields.length} custom field{fields.length === 1 ? '' : 's'}</span>
          </div>

          {notice && <p role="status" className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800 sm:px-6">{notice}</p>}
          {error && <div role="alert" className="m-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-red-800">{error}</p><button type="button" onClick={() => void load()} className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">Try again</button></div>}

          {loading ? (
            <div role="status" className="space-y-3 p-5 sm:p-6"><div className="h-4 w-48 animate-pulse rounded bg-slate-200" /><div className="h-20 animate-pulse rounded-xl bg-slate-100" /><span className="sr-only">Loading registration fields…</span></div>
          ) : error ? null : fields.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-2xl font-light text-orange-600" aria-hidden="true">+</div>
              <h3 className="mt-3 font-bold text-[#101c33]">No custom questions yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">RaceDeck collects the standard participant details. Add an event-specific question if you need any other information.</p>
              <button type="button" onClick={() => open()} className="mt-4 rounded-lg bg-[#0b2b5b] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#123b78]">Add your first field</button>
            </div>
          ) : (
            <ol className="divide-y divide-slate-100">
              {fields.map((field, index) => (
                <li key={field.id} className="px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0b2b5b] text-xs font-bold text-white">{index + 1}</span>
                        <h3 className="font-bold text-[#101c33]">{field.label}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${field.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{field.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <p className="mt-2 pl-9 text-xs text-slate-500">{field.section_key === 'health' ? 'Health information' : 'Additional information'} <span aria-hidden="true">·</span> {CUSTOM_FIELD_TYPE_LABELS[field.field_type as CustomFieldType] ?? field.field_type} <span aria-hidden="true">·</span> {field.is_required ? 'Required' : 'Optional'} <span aria-hidden="true">·</span> Order {field.display_order + 1}</p>
                      <div className="mt-4 pl-9"><Preview field={field} /></div>
                      {['dropdown', 'radio', 'multi_select'].includes(field.field_type) && <div className="mt-4 pl-9"><OptionManager eventId={params.eventId} field={field} onChange={load} /></div>}
                    </div>
                    <div className="flex shrink-0 gap-2 pl-9 sm:pl-0">
                      <button type="button" onClick={() => open(field)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-[#0b2b5b] hover:border-[#0b2b5b] hover:bg-slate-50">Edit</button>
                      <button type="button" onClick={() => void remove(field)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {modal && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setModal(false); }}>
        <form role="dialog" aria-modal="true" aria-labelledby="field-dialog-title" onSubmit={save} className="my-auto w-full max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-600">Registration form</p>
            <h2 id="field-dialog-title" className="mt-1 text-xl font-extrabold text-[#101c33]">{editing ? 'Edit custom field' : 'Add custom field'}</h2>
            <p className="mt-1 text-sm text-slate-600">Set the question and how participants will answer it.</p>
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <label className="block text-sm font-semibold text-slate-700">Field label<input autoFocus required maxLength={160} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="e.g. What is your running club?" className={controlClass} /></label>
          <label className="block text-sm font-semibold text-slate-700">Registration section<select value={form.section_key} onChange={(event) => setForm({ ...form, section_key: event.target.value as FieldForm['section_key'] })} className={controlClass}><option value="additional">Additional information</option><option value="health">Health information</option></select></label>
          <label className="block text-sm font-semibold text-slate-700">Answer type<select value={form.field_type} onChange={(event) => setForm({ ...form, field_type: event.target.value as CustomFieldType })} className={controlClass}>{CUSTOM_FIELD_TYPES.map((type) => <option key={type} value={type}>{CUSTOM_FIELD_TYPE_LABELS[type]}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={form.is_required} onChange={(event) => setForm({ ...form, is_required: event.target.checked })} className="mt-1 accent-orange-600" /><span><span className="block text-sm font-bold text-[#101c33]">Required</span><span className="text-xs font-normal text-slate-500">Participants must answer</span></span></label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="mt-1 accent-orange-600" /><span><span className="block text-sm font-bold text-[#101c33]">Active</span><span className="text-xs font-normal text-slate-500">Show on registration form</span></span></label>
          </div>
          <label className="block max-w-48 text-sm font-semibold text-slate-700">Display order<input type="number" min="0" required value={form.display_order} onChange={(event) => setForm({ ...form, display_order: Number(event.target.value) })} className={controlClass} /></label>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" disabled={busy} onClick={() => setModal(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button disabled={busy} className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Saving…' : editing ? 'Save changes' : 'Add field'}</button>
          </div>
        </form>
      </div>}
    </main>
  );
}

function Preview({ field }: { field: Field }) {
  const control = 'mt-1.5 block w-full max-w-2xl rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500';
  return <div className="max-w-2xl text-sm"><label className="font-medium text-slate-700">{field.label}{field.is_required && <span className="text-orange-600"> *</span>}{field.field_type === 'long_text' ? <textarea disabled rows={2} className={control} /> : field.field_type === 'dropdown' ? <select disabled className={control}><option>Select an option</option></select> : field.field_type === 'multi_select' ? <span className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500"><span>□ Option 1</span><span>□ Option 2</span></span> : field.field_type === 'checkbox' ? <span className="mt-2 flex items-center gap-2 text-sm text-slate-600"><input disabled type="checkbox" className="accent-orange-600" /> Yes</span> : field.field_type === 'radio' ? <span className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500"><span>◯ Option 1</span><span>◯ Option 2</span></span> : field.field_type === 'yes_no' ? <span className="mt-2 flex gap-4 text-xs text-slate-500"><span>◯ Yes</span><span>◯ No</span></span> : <input disabled className={control} placeholder="Participant response" />}</label></div>;
}

function OptionManager({ eventId, field, onChange }: { eventId: string; field: Field; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch(`/api/organizer/events/${eventId}/registration-form/${field.id}/options`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: label.trim(), value: (value.trim() || label.trim()), display_order: field.options.length }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? 'Option could not be added.'); return; }
    setLabel(''); setValue(''); setAdding(false); await onChange();
  }

  async function remove(option: Option) {
    if (!window.confirm(`Remove “${option.label}”?`)) return;
    setBusy(true);
    setError('');
    const response = await fetch(`/api/organizer/events/${eventId}/registration-form/${field.id}/options/${option.id}`, { method: 'DELETE' });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? 'Option could not be removed.'); return; }
    await onChange();
  }

  return <div className="max-w-2xl border-t border-slate-100 pt-3 text-sm">
    <div className="mb-2 flex items-center justify-between"><h4 className="font-bold text-[#101c33]">Answer options</h4><button type="button" disabled={busy} onClick={() => setAdding(!adding)} className="text-xs font-bold text-orange-700 hover:text-orange-800">{adding ? 'Cancel' : '+ Add option'}</button></div>
    {field.options.length ? <ul className="space-y-1.5">{field.options.map((option) => <li key={option.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-700">{option.label} <span className="text-slate-400">({option.value})</span></span><button type="button" disabled={busy} onClick={() => void remove(option)} className="text-xs font-semibold text-slate-500 hover:text-red-700">Remove</button></li>)}</ul> : <p className="text-xs text-slate-500">No answer choices yet.</p>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    {adding && <form onSubmit={add} className="mt-3 grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-xs font-semibold text-slate-600">Option label<input required maxLength={160} value={label} onChange={(event) => setLabel(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-normal" /></label><label className="text-xs font-semibold text-slate-600">Stored value<input maxLength={160} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Defaults to label" className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-normal" /></label><button disabled={busy} className="rounded-lg bg-[#0b2b5b] px-3 py-2 text-xs font-bold text-white hover:bg-[#123b78]">{busy ? 'Adding…' : 'Save option'}</button></form>}
  </div>;
}
