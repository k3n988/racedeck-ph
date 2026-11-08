'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Activity, CalendarClock, Clock3, Pencil, Plus, TicketCheck, Users, X } from 'lucide-react';
import { isoToManilaDateTime, manilaDateTimeToIso } from '@/lib/events/category-pricing';

type Category = {
  id: string;
  name: string;
  category_group_name: string | null;
  distance_km: number | null;
  registration_fee: number;
  early_bird_fee: number | null;
  early_bird_deadline: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  max_slots: number | null;
  confirmed_count: number;
  held_count: number;
  registration_availability: string;
  gun_start_time: string | null;
  cutoff_time: string | null;
};

type CategoryFormState = {
  name: string;
  category_group_name: string;
  distance_km: string;
  registration_fee: string;
  early_bird_enabled: boolean;
  early_bird_fee: string;
  early_bird_deadline: string;
  registration_opens_at: string;
  registration_closes_at: string;
  max_slots: string;
  gun_start_time: string;
  cutoff_time: string;
  registration_availability: string;
};

const blankForm: CategoryFormState = {
  name: '',
  category_group_name: '',
  distance_km: '',
  registration_fee: '0',
  early_bird_enabled: false,
  early_bird_fee: '',
  early_bird_deadline: '',
  registration_opens_at: '',
  registration_closes_at: '',
  max_slots: '',
  gun_start_time: '',
  cutoff_time: '',
  registration_availability: 'not_yet_open',
};

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100';
const peso = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value) || 0);
const statusLabel = (value: string) => value.replaceAll('_', ' ');

function availabilityTone(value: string) {
  if (value === 'open') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (value === 'sold_out' || value === 'closed') return 'bg-slate-100 text-slate-700 ring-slate-200';
  return 'bg-amber-50 text-amber-800 ring-amber-200';
}

function CategoryField({ label, name, value, type = 'text', required = false, min, step, hint, onChange, autoFocus = false }: {
  label: string;
  name: keyof CategoryFormState;
  value: string;
  type?: string;
  required?: boolean;
  min?: number;
  step?: number;
  hint?: string;
  onChange: (name: keyof CategoryFormState, value: string) => void;
  autoFocus?: boolean;
}) {
  return <label className="block text-sm font-semibold text-slate-700">
    {label}{required && <span className="ml-1 text-orange-600" aria-hidden="true">*</span>}
    <input autoFocus={autoFocus} name={name} type={type} required={required} min={min} step={step} value={value} onChange={(event) => onChange(name, event.target.value)} className={inputClass} />
    {hint && <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">{hint}</span>}
  </label>;
}

export default function CategoriesPricingPage({ params }: { params: { eventId: string } }) {
  const [items, setItems] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryFormState>(blankForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [message, setMessage] = useState('Loading categories…');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage('Loading categories…');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/categories`, { cache: 'no-store' });
      const body = await response.json().catch(() => []);
      if (!response.ok) throw new Error(body.error ?? 'Categories could not be loaded.');
      setItems(Array.isArray(body) ? body : []);
      setMessage('');
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Categories could not be loaded.');
      return false;
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  function changeField(name: keyof CategoryFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function open(category?: Category, groupName = '') {
    setEditing(category?.id ?? null);
    setForm(category ? {
      name: category.name,
      category_group_name: category.category_group_name ?? '',
      distance_km: category.distance_km?.toString() ?? '',
      registration_fee: Number(category.registration_fee).toString(),
      early_bird_enabled: category.early_bird_fee !== null && Boolean(category.early_bird_deadline),
      early_bird_fee: category.early_bird_fee === null ? '' : Number(category.early_bird_fee).toString(),
      early_bird_deadline: isoToManilaDateTime(category.early_bird_deadline),
      registration_opens_at: isoToManilaDateTime(category.registration_opens_at),
      registration_closes_at: isoToManilaDateTime(category.registration_closes_at),
      max_slots: category.max_slots?.toString() ?? '',
      gun_start_time: category.gun_start_time?.slice(0, 5) ?? '',
      cutoff_time: category.cutoff_time?.slice(0, 5) ?? '',
      registration_availability: category.registration_availability,
    } : { ...blankForm, category_group_name: groupName });
    setFormError('');
    setMessage('');
    setModal(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    if (!form.distance_km || !Number.isFinite(Number(form.distance_km)) || Number(form.distance_km) <= 0) {
      setFormError('Enter a distance greater than 0 km.');
      setBusy(false);
      return;
    }
    if (Boolean(form.registration_opens_at) !== Boolean(form.registration_closes_at)) {
      setFormError('Enter both distance registration dates, or leave both blank to use the event schedule.');
      setBusy(false);
      return;
    }
    if (form.registration_opens_at && form.registration_closes_at && form.registration_opens_at >= form.registration_closes_at) {
      setFormError('Distance registration must close after it opens.');
      setBusy(false);
      return;
    }
    const body = {
      ...form,
      name: `${Number(form.distance_km)}K`,
      category_group_name: form.category_group_name.trim() || null,
      distance_km: form.distance_km ? Number(form.distance_km) : null,
      registration_fee: Number(form.registration_fee),
      early_bird_fee: form.early_bird_enabled ? Number(form.early_bird_fee) : null,
      early_bird_deadline: form.early_bird_enabled ? manilaDateTimeToIso(form.early_bird_deadline) : null,
      registration_opens_at: form.registration_opens_at ? manilaDateTimeToIso(form.registration_opens_at) : null,
      registration_closes_at: form.registration_closes_at ? manilaDateTimeToIso(form.registration_closes_at) : null,
      max_slots: form.max_slots ? Number(form.max_slots) : null,
      gun_start_time: form.gun_start_time || null,
      cutoff_time: form.cutoff_time || null,
    };
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/categories${editing ? `/${editing}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Category could not be saved.');
      setModal(false);
      setEditing(null);
      setForm(blankForm);
      const loaded = await load();
      if (loaded) setMessage(editing ? 'Category updated.' : 'Category added.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Category could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const totalConfirmed = items.reduce((sum, category) => sum + category.confirmed_count, 0);
  const totalHeld = items.reduce((sum, category) => sum + category.held_count, 0);
  const hasUnlimitedCapacity = items.some((category) => category.max_slots === null);
  const totalCapacity = hasUnlimitedCapacity ? null : items.reduce((sum, category) => sum + (category.max_slots ?? 0), 0);
  const loading = message.startsWith('Loading');
  const failed = Boolean(message && !loading && /could not|failed|error|timed out/i.test(message));

  return <main className="mx-auto max-w-7xl space-y-5 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col justify-between gap-4 rounded-2xl bg-[#071b41] px-5 py-6 text-white shadow-sm sm:flex-row sm:items-center sm:px-7">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-300">Event setup</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Categories &amp; Pricing</h1><p className="mt-2 text-sm text-slate-200">Set race distances, registration fees, capacity, and category schedules.</p></div>
      <button type="button" onClick={() => open()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"><Plus size={17} aria-hidden="true" />Add category</button>
    </header>

    {message && !loading && <div role="status" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${failed ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><span>{message}</span>{failed && <button type="button" onClick={() => void load()} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-bold">Retry</button>}</div>}

    <section aria-label="Category summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Race categories" value={loading ? '—' : items.length.toString()} note="Configured for this event" icon={TicketCheck} />
      <SummaryCard label="Total capacity" value={loading ? '—' : totalCapacity?.toLocaleString() ?? (items.length ? 'Unlimited' : '—')} note={hasUnlimitedCapacity ? 'At least one category has no limit' : 'Combined category slots'} icon={Activity} />
      <SummaryCard label="Confirmed runners" value={loading ? '—' : totalConfirmed.toLocaleString()} note={`${totalHeld.toLocaleString()} active registration holds`} icon={Users} />
      <SummaryCard label="Registration setup" value={loading || !items.length ? '—' : `${items.filter((item) => item.registration_availability === 'open').length} open`} note="Categories currently accepting sign-ups" icon={CalendarClock} />
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold text-[#071b41]">Race categories</h2><p className="mt-1 text-sm text-slate-500">Edit each category’s distance, fee, capacity, and start schedule.</p></div>
        {!loading && <span className="text-sm font-medium text-slate-500">{items.length} {items.length === 1 ? 'category' : 'categories'}</span>}
      </div>

      {loading ? <div className="grid gap-3 lg:grid-cols-2">{[0, 1].map((item) => <div key={item} className="animate-pulse rounded-xl border border-slate-200 p-5"><div className="h-5 w-36 rounded bg-slate-200" /><div className="mt-4 h-4 w-52 rounded bg-slate-100" /><div className="mt-8 h-2 rounded bg-slate-100" /></div>)}</div>
        : failed ? null
          : items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><TicketCheck size={22} aria-hidden="true" /></span><h3 className="mt-3 font-bold text-[#071b41]">No race categories yet</h3><p className="mt-1 text-sm text-slate-500">Add the first distance and registration price for this event.</p><button type="button" onClick={() => open()} className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700">Add first category</button></div>
            : <div className="grid gap-3 lg:grid-cols-2">{items.map((category) => {
              const usedSlots = category.confirmed_count + category.held_count;
              const capacityFill = category.max_slots ? Math.min(100, Math.round((usedSlots / category.max_slots) * 100)) : 0;
              return <article key={category.id} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-lg font-bold text-[#071b41]">{category.category_group_name ? `${category.category_group_name} · ` : ''}{category.distance_km === null ? category.name : `${category.distance_km}K`}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ring-inset ${availabilityTone(category.registration_availability)}`}>{statusLabel(category.registration_availability)}</span></div><p className="mt-1 text-sm text-slate-500">{category.category_group_name ? `Group: ${category.category_group_name} · ` : ''}{category.distance_km === null ? 'Distance not set' : `${category.distance_km} km`}</p>{(category.registration_opens_at || category.registration_closes_at) && <p className="mt-2 text-xs text-slate-500">Registration: {category.registration_opens_at ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(category.registration_opens_at)) : 'event opening'} – {category.registration_closes_at ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(category.registration_closes_at)) : 'event closing'} (Manila)</p>}</div>
                  <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => open(undefined, category.category_group_name ?? '')} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-bold text-orange-700 transition hover:bg-orange-50"><Plus size={14} aria-hidden="true" />Add distance</button><button type="button" onClick={() => open(category)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-[#0b2a59] transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"><Pencil size={14} aria-hidden="true" />Edit</button></div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                  <div><p className="text-xs font-semibold text-slate-500">{category.early_bird_fee !== null && category.early_bird_deadline && Date.parse(category.early_bird_deadline) > Date.now() ? 'Early Bird price' : 'Current registration fee'}</p><p className="mt-1 font-bold text-slate-900">{peso(category.early_bird_fee !== null && category.early_bird_deadline && Date.parse(category.early_bird_deadline) > Date.now() ? category.early_bird_fee : category.registration_fee)}</p>{category.early_bird_fee !== null && category.early_bird_deadline && <p className="mt-1 text-xs text-slate-500">Regular price {peso(category.registration_fee)} · deadline {new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(category.early_bird_deadline))} Manila time</p>}</div>
                  <div><p className="text-xs font-semibold text-slate-500">Capacity</p><p className="mt-1 font-bold text-slate-900">{category.max_slots === null ? 'Unlimited' : category.max_slots.toLocaleString()}</p></div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-600">{category.confirmed_count.toLocaleString()} confirmed <span className="font-normal text-slate-400">·</span> {category.held_count.toLocaleString()} held</span><span className="text-slate-500">{category.max_slots === null ? 'No slot limit' : `${usedSlots.toLocaleString()} / ${category.max_slots.toLocaleString()} used`}</span></div>
                  {category.max_slots !== null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${capacityFill >= 90 ? 'bg-orange-500' : 'bg-[#173d72]'}`} style={{ width: `${capacityFill}%` }} /></div>}
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><Clock3 size={14} className="text-orange-600" aria-hidden="true" />Start {category.gun_start_time?.slice(0, 5) ?? 'TBA'}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock3 size={14} className="text-orange-600" aria-hidden="true" />Cut-off {category.cutoff_time?.slice(0, 5) ?? 'TBA'}</span>
                </div>
              </article>;
            })}</div>}
    </section>

    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4" onKeyDown={(event) => { if (event.key === 'Escape' && !busy) setModal(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" className="my-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-600">Category setup</p><h2 id="category-dialog-title" className="mt-1 text-xl font-extrabold text-[#071b41]">{editing ? 'Edit category' : 'Add category'}</h2><p className="mt-1 text-sm text-slate-500">Set the category details shown to participants at registration.</p></div>
          <button type="button" aria-label="Close dialog" disabled={busy} onClick={() => setModal(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <CategoryField label="Category group name (optional)" name="category_group_name" value={form.category_group_name} autoFocus hint="For example Regular or Early Bird. Leave blank to list distances without a group." onChange={changeField} />
            <CategoryField label="Distance (km)" name="distance_km" value={form.distance_km} type="number" required min={0.01} step={0.01} hint="Enter the race distance, such as 3 or 21.1 km." onChange={changeField} />
            <CategoryField label="Registration fee (PHP)" name="registration_fee" value={form.registration_fee} type="number" required min={0} step={0.01} onChange={changeField} />
            <CategoryField label="Distance registration opens (Manila time, optional)" name="registration_opens_at" value={form.registration_opens_at} type="datetime-local" onChange={changeField} />
            <CategoryField label="Distance registration closes (Manila time, optional)" name="registration_closes_at" value={form.registration_closes_at} type="datetime-local" onChange={changeField} />
            <p className="-mt-2 text-xs leading-5 text-slate-500 sm:col-span-2">Set both dates to override the event registration window for this distance. Leave both blank to inherit the event schedule.</p>
            <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#071b41]"><input type="checkbox" checked={form.early_bird_enabled} onChange={(event) => setForm((current) => ({ ...current, early_bird_enabled: event.target.checked, early_bird_fee: event.target.checked ? current.early_bird_fee : '', early_bird_deadline: event.target.checked ? current.early_bird_deadline : '' }))} className="h-4 w-4 accent-orange-600" />Offer optional Early Bird pricing</label>
              {form.early_bird_enabled && <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <CategoryField label="Early Bird price (PHP)" name="early_bird_fee" value={form.early_bird_fee} type="number" required min={0} step={0.01} onChange={changeField} />
                <CategoryField label="Early Bird deadline (Manila time)" name="early_bird_deadline" value={form.early_bird_deadline} type="datetime-local" required onChange={changeField} />
                <p className="text-xs leading-5 text-slate-600 sm:col-span-2">Early Bird applies until this deadline. At the deadline, checkout automatically switches to the regular registration fee. Early Bird price must be lower than the regular price.</p>
              </div>}
            </div>
            <CategoryField label="Category capacity" name="max_slots" value={form.max_slots} type="number" min={1} step={1} hint="Leave blank for unlimited slots." onChange={changeField} />
            <CategoryField label="Gun start" name="gun_start_time" value={form.gun_start_time} type="time" hint="Leave blank to show time as TBA." onChange={changeField} />
            <CategoryField label="Course cut-off" name="cutoff_time" value={form.cutoff_time} type="time" hint="Leave blank to show time as TBA." onChange={changeField} />
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Registration availability
              <select value={form.registration_availability} onChange={(event) => changeField('registration_availability', event.target.value)} className={inputClass}>
                <option value="not_yet_open">Not yet open</option><option value="open">Open</option><option value="closed">Closed</option><option value="sold_out">Sold out</option>
              </select>
              <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">Registration dates and remaining slots still control whether participants can register.</span>
            </label>
          </div>
          {editing && <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">Capacity cannot be set below the number of confirmed runners. Race kit products are managed in the Race Kit section.</p>}
          {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" disabled={busy} onClick={() => setModal(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Saving…' : editing ? 'Save category' : 'Add category'}</button>
          </div>
        </form>
      </section>
    </div>}
  </main>;
}

function SummaryCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof TicketCheck }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-xl font-extrabold text-[#071b41]">{value}</p></div><span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-orange-600"><Icon size={19} aria-hidden="true" /></span></div>
    <p className="mt-2 text-xs text-slate-500">{note}</p>
  </article>;
}
