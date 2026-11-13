'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Category = { id: string; name: string };
type Promo = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'fixed_amount' | 'percentage';
  discount_value: number;
  starts_at: string;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number | null;
  status: 'active' | 'inactive';
  applies_to_all_categories: boolean;
  categories: Category[];
};
type FormState = {
  code: string;
  description: string;
  discount_type: 'fixed_amount' | 'percentage';
  discount_value: string;
  starts_at: string;
  expires_at: string;
  usage_limit: string;
  per_user_limit: string;
  applies_to_all_categories: boolean;
  category_ids: string[];
  status: 'active' | 'inactive';
};

const blank: FormState = { code: '', description: '', discount_type: 'percentage', discount_value: '', starts_at: '', expires_at: '', usage_limit: '', per_user_limit: '', applies_to_all_categories: true, category_ids: [], status: 'active' };
const controlClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const localDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const formatDate = (value: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value));

export default function PromoCodesPage({ params }: { params: { eventId: string } }) {
  const [items, setItems] = useState<Promo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [codesResponse, categoryResponse] = await Promise.all([
        fetch(`/api/organizer/events/${params.eventId}/promo-codes`, { cache: 'no-store' }),
        fetch(`/api/organizer/events/${params.eventId}/categories`, { cache: 'no-store' }),
      ]);
      const codeData = await codesResponse.json().catch(() => ({}));
      if (!codesResponse.ok) throw new Error(codeData.error ?? 'Promo codes could not be loaded.');
      const categoryData = categoryResponse.ok ? await categoryResponse.json().catch(() => []) : [];
      setItems(Array.isArray(codeData) ? codeData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Promo codes could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  function edit(item: Promo) {
    setFormError('');
    setEditing(item.id);
    setForm({ code: item.code, description: item.description ?? '', discount_type: item.discount_type, discount_value: String(item.discount_value), starts_at: localDate(item.starts_at), expires_at: localDate(item.expires_at), usage_limit: item.usage_limit === null ? '' : String(item.usage_limit), per_user_limit: item.per_user_limit === null ? '' : String(item.per_user_limit), applies_to_all_categories: item.applies_to_all_categories, category_ids: item.categories.map((category) => category.id), status: item.status });
    setOpen(true);
  }

  function create() {
    setFormError('');
    setEditing(null);
    setForm({ ...blank, starts_at: localDate(new Date().toISOString()) });
    setOpen(true);
  }

  function payloadFor(current: FormState, original?: Promo) {
    const startsUnchanged = Boolean(original && current.starts_at === localDate(original.starts_at));
    const expiresUnchanged = Boolean(original && current.expires_at === localDate(original.expires_at));
    return {
      ...current,
      description: current.description.trim() || null,
      discount_value: Number(current.discount_value),
      starts_at: startsUnchanged ? original!.starts_at : new Date(current.starts_at).toISOString(),
      expires_at: expiresUnchanged ? original!.expires_at : current.expires_at ? new Date(current.expires_at).toISOString() : null,
      usage_limit: current.usage_limit ? Number(current.usage_limit) : null,
      per_user_limit: current.per_user_limit ? Number(current.per_user_limit) : null,
    };
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/promo-codes${editing ? `/${editing}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFor(form, editing ? items.find((item) => item.id === editing) : undefined)),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Promo code could not be saved.');
      setOpen(false);
      await load();
      setMessage(editing ? 'Promo code updated.' : 'Promo code created.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Promo code could not be saved.';
      setFormError(message);
      setMessage(message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Promo) {
    if (item.usage_count > 0) {
      const shouldDeactivate = window.confirm(`${item.code} has redemption history and cannot be deleted. Deactivate it instead?`);
      if (shouldDeactivate) await changeStatus(item, 'inactive');
      return;
    }
    if (!window.confirm(`Delete promo code ${item.code}? This cannot be undone.`)) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/promo-codes/${item.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Promo code could not be deleted.');
      await load();
      setMessage('Promo code deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Promo code could not be deleted.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(item: Promo, status: 'active' | 'inactive') {
    setBusy(true);
    setMessage('');
    try {
      const current: FormState = { code: item.code, description: item.description ?? '', discount_type: item.discount_type, discount_value: String(item.discount_value), starts_at: localDate(item.starts_at), expires_at: localDate(item.expires_at), usage_limit: item.usage_limit === null ? '' : String(item.usage_limit), per_user_limit: item.per_user_limit === null ? '' : String(item.per_user_limit), applies_to_all_categories: item.applies_to_all_categories, category_ids: item.categories.map((category) => category.id), status };
      const response = await fetch(`/api/organizer/events/${params.eventId}/promo-codes/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadFor(current, item)) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Promo-code status could not be changed.');
      await load();
      setMessage(status === 'active' ? 'Promo code activated.' : 'Promo code deactivated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Promo-code status could not be changed.');
    } finally {
      setBusy(false);
    }
  }

  const isError = /could not|failed|error/i.test(message);

  return <main className="mx-auto max-w-6xl space-y-6 bg-[#f4f6fa] p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event operations</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Promo Codes</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Create discounts for registrations and track when each code can be used.</p></div>
      <button type="button" onClick={create} disabled={loading || busy} className="min-h-11 shrink-0 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:opacity-50">Create promo code</button>
    </header>

    {message && <ToastFeedback message={String(message)} tone="auto">{isError && !loading ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Refresh promo codes</button></div> : undefined}</ToastFeedback>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-lg font-bold text-[#071b41]">Event promo codes</h2><p className="mt-1 text-sm text-slate-600">Review discounts, validity, usage, and status.</p></div>{!loading && <span className="text-xs font-semibold text-slate-500">{items.length} code{items.length === 1 ? '' : 's'}</span>}</div>
      {loading ? <div role="status" className="space-y-3 p-5"><span className="sr-only">Loading promo codes…</span><div className="h-12 animate-pulse rounded-lg bg-slate-100" /><div className="h-12 animate-pulse rounded-lg bg-slate-100" /></div> : isError ? <p className="px-5 py-8 text-center text-sm text-slate-500">Promo codes could not be displayed.</p> : items.length === 0 ? <p className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">No promo codes yet. Create a code to offer participants a registration discount.</p> : <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Discount</th><th className="px-5 py-3">Categories</th><th className="px-5 py-3">Validity</th><th className="px-5 py-3">Usage</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className="text-slate-700 hover:bg-slate-50/70"><td className="px-5 py-3.5"><span className="font-mono font-bold text-[#0b2b5b]">{item.code}</span>{item.description && <span className="mt-1 block max-w-48 truncate text-xs text-slate-500">{item.description}</span>}</td><td className="whitespace-nowrap px-5 py-3.5 font-semibold">{item.discount_type === 'percentage' ? `${item.discount_value}% off` : `₱${Number(item.discount_value).toFixed(2)} off`}</td><td className="max-w-48 px-5 py-3.5">{item.applies_to_all_categories ? 'All categories' : item.categories.map((category) => category.name).join(', ') || 'No categories'}</td><td className="whitespace-nowrap px-5 py-3.5">{formatDate(item.starts_at)}<span className="block text-xs text-slate-500">Through {item.expires_at ? formatDate(item.expires_at) : 'No expiry'}</span></td><td className="whitespace-nowrap px-5 py-3.5">{item.usage_count.toLocaleString()} / {item.usage_limit?.toLocaleString() ?? 'Unlimited'}<span className="block text-xs text-slate-500">Per person: {item.per_user_limit ?? 'Unlimited'}</span></td><td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span></td><td className="px-5 py-3.5"><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => edit(item)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">Edit</button><button type="button" disabled={busy} onClick={() => void (item.status === 'active' ? changeStatus(item, 'inactive') : changeStatus(item, 'active'))} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">{item.status === 'active' ? 'Deactivate' : 'Activate'}</button><button type="button" disabled={busy} onClick={() => void remove(item)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">Delete</button></div></td></tr>)}</tbody>
        </table>
      </div>}
    </section>

    {open && <PromoForm form={form} setForm={setForm} categories={categories} busy={busy} editing={Boolean(editing)} error={formError} onSubmit={save} onCancel={() => setOpen(false)} />}
  </main>;
}

function PromoForm({ form, setForm, categories, busy, editing, error, onSubmit, onCancel }: { form: FormState; setForm: (value: FormState) => void; categories: Category[]; busy: boolean; editing: boolean; error: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <form role="dialog" aria-modal="true" aria-labelledby="promo-dialog-title" onSubmit={onSubmit} className="my-auto max-h-[92vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Event operations</p><h2 id="promo-dialog-title" className="mt-1 text-xl font-extrabold text-[#071b41]">{editing ? 'Edit promo code' : 'Create promo code'}</h2><p className="mt-1 text-sm text-slate-600">Set the discount, valid dates, usage limits, and eligible categories.</p></div><button type="button" aria-label="Close promo code form" disabled={busy} onClick={onCancel} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50">×</button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">Promo code<input required minLength={3} maxLength={64} value={form.code} disabled={busy} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s/g, '') })} className={controlClass} placeholder="SUMMER10" /></label>
        <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-500">(optional)</span><input maxLength={500} value={form.description} disabled={busy} onChange={(event) => setForm({ ...form, description: event.target.value })} className={controlClass} placeholder="Early registration offer" /></label>
        <label className="block text-sm font-semibold text-slate-700">Discount type<select value={form.discount_type} disabled={busy} onChange={(event) => setForm({ ...form, discount_type: event.target.value as FormState['discount_type'] })} className={controlClass}><option value="percentage">Percentage</option><option value="fixed_amount">Fixed amount (PHP)</option></select></label>
        <label className="block text-sm font-semibold text-slate-700">Discount value<input required type="number" min="0.01" max={form.discount_type === 'percentage' ? 100 : 99999999.99} step="0.01" value={form.discount_value} disabled={busy} onChange={(event) => setForm({ ...form, discount_value: event.target.value })} className={controlClass} />{form.discount_type === 'percentage' && <span className="mt-1 block text-xs font-normal text-slate-500">Enter a value from 0.01% to 100%.</span>}</label>
        <label className="block text-sm font-semibold text-slate-700">Starts at<input required type="datetime-local" value={form.starts_at} disabled={busy} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} className={controlClass} /></label>
        <label className="block text-sm font-semibold text-slate-700">Expires at <span className="font-normal text-slate-500">(optional)</span><input type="datetime-local" value={form.expires_at} disabled={busy} min={form.starts_at || undefined} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} className={controlClass} /></label>
        <label className="block text-sm font-semibold text-slate-700">Total usage limit <span className="font-normal text-slate-500">(optional)</span><input type="number" min="1" step="1" value={form.usage_limit} disabled={busy} onChange={(event) => setForm({ ...form, usage_limit: event.target.value })} className={controlClass} placeholder="Unlimited" /></label>
        <label className="block text-sm font-semibold text-slate-700">Per-participant limit <span className="font-normal text-slate-500">(optional)</span><input type="number" min="1" step="1" value={form.per_user_limit} disabled={busy} onChange={(event) => setForm({ ...form, per_user_limit: event.target.value })} className={controlClass} placeholder="Unlimited" /></label>
      </div>
      <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-bold text-slate-700">Eligible categories</legend>
        <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={form.applies_to_all_categories} disabled={busy} onChange={(event) => setForm({ ...form, applies_to_all_categories: event.target.checked, category_ids: [] })} className="mt-1 h-4 w-4 accent-orange-600" /><span><span className="block text-sm font-semibold">All event categories</span><span className="mt-1 block text-xs text-slate-500">The discount can be used for any category.</span></span></label>
        {!form.applies_to_all_categories && <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">{categories.length ? categories.map((category) => <label key={category.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><input type="checkbox" checked={form.category_ids.includes(category.id)} disabled={busy} onChange={(event) => setForm({ ...form, category_ids: event.target.checked ? [...form.category_ids, category.id] : form.category_ids.filter((id) => id !== category.id) })} className="accent-orange-600" />{category.name}</label>) : <p className="text-sm text-slate-500">No event categories are available yet.</p>}</div>}
      </fieldset>
      {editing && <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3"><input type="checkbox" checked={form.status === 'active'} disabled={busy} onChange={(event) => setForm({ ...form, status: event.target.checked ? 'active' : 'inactive' })} className="h-4 w-4 accent-orange-600" /><span><span className="block text-sm font-semibold text-slate-800">Active</span><span className="block text-xs text-slate-500">Inactive codes cannot be used at registration.</span></span></label>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button disabled={busy} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Saving…' : editing ? 'Save changes' : 'Create promo code'}</button></div>
    </form>
  </div>;
}
