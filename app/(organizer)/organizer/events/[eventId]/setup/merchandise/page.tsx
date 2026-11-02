'use client';

import { useCallback, useEffect, useState } from 'react';

type Merchandise = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  variants: string[];
  image_urls: string[];
  is_active: boolean;
  display_order: number;
};

type NewItem = { name: string; description: string; price: string; variants: string; images: File[] };
const blank: NewItem = { name: '', description: '', price: '', variants: '', images: [] };
const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100';
const variantsFrom = (value: string) => Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)));

export default function EventMerchandiseSetup({ params }: { params: { eventId: string } }) {
  const [items, setItems] = useState<Merchandise[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Merchandise>>({});
  const [form, setForm] = useState<NewItem>(blank);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/merchandise`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Merchandise could not be loaded.');
      const next = (body.merchandise ?? []) as Merchandise[];
      setItems(next);
      setDrafts(Object.fromEntries(next.map((item) => [item.id, item])));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Merchandise could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  async function uploadImages(files: File[]) {
    const urls: string[] = [];
    for (const file of files) {
      const data = new FormData();
      data.append('file', file);
      data.append('kind', 'merchandise');
      const response = await fetch(`/api/organizer/events/${params.eventId}/assets`, { method: 'POST', body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.url) throw new Error(body.error ?? `Could not upload ${file.name}.`);
      urls.push(body.url as string);
    }
    return urls;
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(form.price);
    const variants = variantsFrom(form.variants);
    if (!form.name.trim() || !Number.isFinite(price) || price <= 0) {
      setMessage('Enter a product name and a price greater than PHP 0.');
      return;
    }
    if (form.images.length > 8 || variants.length > 40) {
      setMessage('Each product supports up to 8 photos and 40 variants.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const image_urls = await uploadImages(form.images);
      const response = await fetch(`/api/organizer/events/${params.eventId}/merchandise`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null, unit_price: price, variants, image_urls, display_order: items.length }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Merchandise could not be saved.');
      setForm(blank);
      setMessage('Merchandise added.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Merchandise could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(item: Merchandise) {
    const draft = drafts[item.id];
    if (!draft.name.trim() || !Number.isFinite(Number(draft.unit_price)) || Number(draft.unit_price) <= 0 || draft.variants.length > 40 || draft.image_urls.length > 8) {
      setMessage('Check the product name, positive price, and maximum of 40 variants and 8 image URLs.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/merchandise/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, name: draft.name.trim(), description: draft.description?.trim() || null, unit_price: Number(draft.unit_price), display_order: draft.display_order }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Merchandise could not be updated.');
      setMessage('Merchandise updated.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Merchandise could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function setActive(item: Merchandise, isActive: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/merchandise/${item.id}`, {
        method: isActive ? 'PATCH' : 'DELETE',
        ...(isActive ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...drafts[item.id], is_active: true, unit_price: Number(drafts[item.id].unit_price) }) } : {}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Merchandise availability could not be changed.');
      setMessage(isActive ? 'Merchandise is available again.' : 'Merchandise removed from registration.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Merchandise availability could not be changed.');
    } finally {
      setBusy(false);
    }
  }

  const updateDraft = (id: string, changes: Partial<Merchandise>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...changes } }));

  return <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-6">
    <header><p className="text-sm font-semibold text-orange-600">Event setup</p><h1 className="mt-1 text-2xl font-black text-[#071b41]">Additional merchandise</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Manage optional paid products sold separately from category race-kit inclusions. Changes are locked while the event is under review or after approval.</p></header>
    {message && <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">{message}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-[#071b41]">Add merchandise</h2><form onSubmit={(event) => void addItem(event)} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Product name<input required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Event finisher shirt" className={input} /></label><label className="text-sm font-semibold">Price (PHP)<input required min="0.01" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="450.00" className={input} /></label></div>
      <label className="block text-sm font-semibold">Description<input maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={input} placeholder="Optional product details" /></label>
      <label className="block text-sm font-semibold">Variants, separated by commas<input value={form.variants} onChange={(event) => setForm({ ...form, variants: event.target.value })} className={input} placeholder="XS, S, M, L, XL" /></label>
      <label className="block text-sm font-semibold">Product photos (up to 8)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setForm({ ...form, images: Array.from(event.target.files ?? []).slice(0, 8) })} className={input} /><span className="mt-1 block text-xs font-normal text-slate-500">JPG, PNG, or WEBP; up to 10 MB each.</span></label>
      <button disabled={busy || loading} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Add merchandise'}</button>
    </form></section>
    <section className="space-y-4"><h2 className="text-lg font-bold text-[#071b41]">Event products</h2>{loading ? <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-600">Loading merchandise…</p> : items.length === 0 ? <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-600">No additional merchandise yet. Race-kit inclusions remain separate.</p> : items.map((item) => { const draft = drafts[item.id] ?? item; return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="font-bold text-[#071b41]">{item.name}</h3><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.is_active ? 'Available' : 'Removed'}</span></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Product name<input value={draft.name} onChange={(event) => updateDraft(item.id, { name: event.target.value })} className={input} /></label><label className="text-sm font-semibold">Price (PHP)<input type="number" min="0.01" step="0.01" value={draft.unit_price} onChange={(event) => updateDraft(item.id, { unit_price: Number(event.target.value) })} className={input} /></label></div><label className="mt-3 block text-sm font-semibold">Description<input value={draft.description ?? ''} onChange={(event) => updateDraft(item.id, { description: event.target.value })} className={input} /></label><label className="mt-3 block text-sm font-semibold">Variants, separated by commas<input value={draft.variants.join(', ')} onChange={(event) => updateDraft(item.id, { variants: variantsFrom(event.target.value) })} className={input} /></label><label className="mt-3 block text-sm font-semibold">Image URLs, one per line<textarea rows={2} value={draft.image_urls.join('\n')} onChange={(event) => updateDraft(item.id, { image_urls: event.target.value.split('\n').map((url) => url.trim()).filter(Boolean) })} className={input} /></label><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void saveItem(item)} className="rounded-lg bg-[#071b41] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save changes</button><button type="button" disabled={busy} onClick={() => void setActive(item, !item.is_active)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">{item.is_active ? 'Remove from registration' : 'Restore availability'}</button></div></article>; })}</section>
  </main>;
}