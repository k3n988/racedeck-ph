'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ToastFeedback } from '@/components/toast-feedback';
import { parseVariantOptions, type VariantOption, variantOptionsPayload } from '@/lib/events/variant-options';

const MAX_VARIANTS = 40;
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PRICE = 1_000_000;
const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100';

type Merchandise = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  variants: VariantOption[];
  image_urls: string[];
  is_active: boolean;
  display_order: number;
};

type ImageValue = { url: string; file?: File };
type ProductDraft = {
  name: string;
  description: string;
  price: string;
  variants: VariantOption[];
  images: ImageValue[];
};

const blank: ProductDraft = { name: '', description: '', price: '', variants: [], images: [] };
const validImage = (file: File) => file.size > 0 && file.size <= MAX_IMAGE_BYTES && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
const toDraft = (item: Merchandise): ProductDraft => ({
  name: item.name,
  description: item.description ?? '',
  price: String(item.unit_price),
  variants: item.variants,
  images: item.image_urls.map((url) => ({ url })),
});

function VariantEditor({ variants, onChange, label = 'Variants' }: { variants: VariantOption[]; onChange: (variants: VariantOption[]) => void; label?: string }) {
  const [variantDraft, setVariantDraft] = useState('');
  const [error, setError] = useState('');

  function addVariant() {
    const name = variantDraft.trim();
    if (!name) return;
    if (name.length > 80) { setError('Variant names must be 80 characters or fewer.'); return; }
    if (variants.some((variant) => variant.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { setError('Each variant must have a unique name.'); return; }
    if (variants.length >= MAX_VARIANTS) { setError('Use no more than 40 variants.'); return; }
    onChange([...variants, { name, slots: null }]);
    setVariantDraft('');
    setError('');
  }

  return <div>
    <label className="block text-sm font-semibold text-slate-700">{label} <span className="font-normal text-slate-500">(optional: size, color, or style)</span></label>
    <div className="mt-2 space-y-2">{variants.map((variant, index) => <div key={`${variant.name}-${index}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <span className="min-w-0 break-words text-sm font-semibold text-slate-700">{variant.name}</span>
      <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-600">Slots (optional)<input type="number" min="0" max="1000000" step="1" inputMode="numeric" value={variant.slots ?? ''} onChange={(event) => { const raw = event.target.value; onChange(variants.map((current, currentIndex) => currentIndex === index ? { ...current, slots: raw === '' ? null : Number(raw) } : current)); }} aria-label={`Optional stock limit for ${variant.name}`} placeholder="No limit" className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
      <button type="button" onClick={() => onChange(variants.filter((_, currentIndex) => currentIndex !== index))} aria-label={`Remove ${variant.name}`} className="rounded px-2 py-1 text-slate-600 hover:bg-white">×</button>
    </div>)}</div>
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2"><input value={variantDraft} maxLength={80} onChange={(event) => { setVariantDraft(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addVariant(); } }} placeholder="Add an option, e.g. Medium" className={`${input} mt-0`} /><button type="button" onClick={addVariant} disabled={!variantDraft.trim()} className="rounded-lg border border-orange-300 px-3 text-sm font-bold text-orange-700 disabled:opacity-50">Add</button></div>
    {error && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{error}</p>}
  </div>;
}

function ImageEditor({ images, onChange }: { images: ImageValue[]; onChange: (images: ImageValue[]) => void }) {
  const [error, setError] = useState('');
  return <div>
    <label className="block text-sm font-semibold text-slate-700">Product photos <span className="font-normal text-slate-500">(JPG, PNG, or WEBP · max 10 MB each · up to 8)</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        event.currentTarget.value = '';
        if (images.length + files.length > MAX_IMAGES) { setError('Upload no more than 8 product photos.'); return; }
        const invalid = files.find((file) => !validImage(file));
        if (invalid) { setError(`${invalid.name} must be a JPG, PNG, or WEBP image no larger than 10 MB.`); return; }
        setError('');
        onChange([...images, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
      }} className={`${input} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-semibold file:text-slate-700`} />
    </label>
    <div className="mt-2 flex flex-wrap gap-2">{images.map((image, index) => <div key={`${image.url}-${index}`} className="relative"><Image src={image.url} alt={`Merchandise photo ${index + 1}`} width={96} height={96} unoptimized className="h-24 w-24 rounded-lg border border-slate-200 object-cover" /><button type="button" aria-label={`Remove product photo ${index + 1}`} onClick={() => { if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url); onChange(images.filter((_, currentIndex) => currentIndex !== index)); setError(''); }} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-bold text-red-600 shadow ring-1 ring-slate-200">×</button></div>)}</div>
    {error && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{error}</p>}
  </div>;
}

function ProductFields({ draft, onChange }: { draft: ProductDraft; onChange: (draft: ProductDraft) => void }) {
  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold text-slate-700">Product name<input required maxLength={160} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="Event finisher shirt" className={input} /></label>
      <label className="block text-sm font-semibold text-slate-700">Price (PHP)<input required type="number" min="0.01" max={MAX_PRICE} step="0.01" value={draft.price} onChange={(event) => onChange({ ...draft, price: event.target.value })} placeholder="450.00" className={input} /></label>
    </div>
    <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-500">(optional)</span><input maxLength={1000} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} placeholder="Add fabric, fit, or other helpful details" className={input} /></label>
    <VariantEditor variants={draft.variants} onChange={(variants) => onChange({ ...draft, variants })} />
    <ImageEditor images={draft.images} onChange={(images) => onChange({ ...draft, images })} />
  </div>;
}

export default function EventMerchandiseSetup({ params }: { params: { eventId: string } }) {
  const [items, setItems] = useState<Merchandise[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProductDraft>>({});
  const [form, setForm] = useState<ProductDraft>(blank);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (preserveMessage = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/merchandise`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Merchandise could not be loaded.');
      const next = ((body.merchandise ?? []) as Array<Omit<Merchandise, 'variants'> & { variants: unknown }>).map((item) => ({ ...item, variants: parseVariantOptions(item.variants) }));
      setItems(next);
      setDrafts(Object.fromEntries(next.map((item) => [item.id, toDraft(item)])));
      setError(false);
      if (!preserveMessage) setMessage('');
    } catch (loadError) {
      setError(true);
      setMessage(loadError instanceof Error ? loadError.message : 'Merchandise could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!addOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallbackFocus = addButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), textarea:not([disabled]), select:not([disabled])')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      (previousFocus ?? fallbackFocus)?.focus();
    };
  }, [addOpen]);

  function closeAddModal() {
    if (busy) return;
    form.images.forEach((image) => { if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url); });
    setForm(blank);
    setAddError('');
    setAddOpen(false);
  }

  function validateDraft(draft: ProductDraft) {
    if (!draft.name.trim()) return 'Enter a product name.';
    if (draft.name.trim().length > 160) return 'Product names must be 160 characters or fewer.';
    if (draft.description.trim().length > 1000) return 'Descriptions must be 1,000 characters or fewer.';
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) return 'Enter a price greater than PHP 0 and no more than PHP 1,000,000.';
    if (draft.variants.length > MAX_VARIANTS) return 'Use no more than 40 variants.';
    if (draft.variants.some((variant) => !variant.name.trim() || variant.name.trim().length > 80)) return 'Variant names must be 1 to 80 characters.';
    if (new Set(draft.variants.map((variant) => variant.name.trim().toLocaleLowerCase())).size !== draft.variants.length) return 'Variant names must be unique.';
    if (draft.variants.some((variant) => variant.slots !== null && (!Number.isSafeInteger(variant.slots) || variant.slots < 0 || variant.slots > 1_000_000))) return 'Stock limits must be whole numbers from 0 to 1,000,000, or left blank for unlimited stock.';
    if (draft.images.length > MAX_IMAGES) return 'Upload no more than 8 product photos.';
    if (draft.images.some((image) => image.file && !validImage(image.file))) return 'Photos must be JPG, PNG, or WEBP files no larger than 10 MB each.';
    return '';
  }

  async function uploadImages(images: ImageValue[]) {
    const urls: string[] = [];
    for (const image of images) {
      if (!image.file) { urls.push(image.url); continue; }
      const data = new FormData();
      data.append('file', image.file);
      data.append('kind', 'merchandise');
      const response = await fetch(`/api/organizer/events/${params.eventId}/assets`, { method: 'POST', body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.url) throw new Error(body.error ?? `Could not upload ${image.file.name}.`);
      urls.push(body.url as string);
    }
    return urls;
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateDraft(form);
    if (validationError) { setError(true); setAddError(validationError); setMessage(validationError); return; }
    setBusy(true);
    setError(false);
    setAddError('');
    setMessage('');
    try {
      const image_urls = await uploadImages(form.images);
      const response = await fetch(`/api/organizer/events/${params.eventId}/merchandise`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null, unit_price: Number(form.price), variants: variantOptionsPayload(form.variants.map((variant) => variant.name), Object.fromEntries(form.variants.map((variant) => [variant.name, variant.slots === null ? '' : String(variant.slots)]))), image_urls, display_order: items.length }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Merchandise could not be saved.');
      form.images.forEach((image) => { if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url); });
      setForm(blank);
      setAddOpen(false);
      setMessage('Merchandise added and available during participant registration.');
      await load(true);
    } catch (saveError) {
      setError(true);
      const errorMessage = saveError instanceof Error ? saveError.message : 'Merchandise could not be saved.';
      setAddError(errorMessage);
      setMessage(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(item: Merchandise, isActive = item.is_active) {
    const draft = drafts[item.id] ?? toDraft(item);
    const validationError = validateDraft(draft);
    if (validationError) { setError(true); setMessage(validationError); return; }
    setBusy(true);
    setError(false);
    setMessage('');
    try {
      const image_urls = await uploadImages(draft.images);
      const response = await fetch(`/api/organizer/events/${params.eventId}/merchandise/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name.trim(), description: draft.description.trim() || null, unit_price: Number(draft.price), variants: variantOptionsPayload(draft.variants.map((variant) => variant.name), Object.fromEntries(draft.variants.map((variant) => [variant.name, variant.slots === null ? '' : String(variant.slots)]))), image_urls, display_order: item.display_order, is_active: isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Merchandise could not be updated.');
      draft.images.forEach((image) => { if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url); });
      setMessage(isActive === item.is_active ? 'Merchandise updated and saved.' : isActive ? 'Merchandise restored for participant registration.' : 'Merchandise removed from participant registration.');
      await load(true);
    } catch (saveError) {
      setError(true);
      setMessage(saveError instanceof Error ? saveError.message : 'Merchandise could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  const updateDraft = (id: string, draft: ProductDraft) => setDrafts((current) => ({ ...current, [id]: draft }));

  return <main className="mx-auto max-w-6xl space-y-6 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    {message && <ToastFeedback message={message} tone={error ? 'error' : 'auto'}><div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span>{error && !loading && <button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Refresh products</button>}</div></ToastFeedback>}
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-[#071b41]">Event products</h2><p className="mt-1 text-sm text-slate-600">These products appear as optional add-ons at participant registration.</p></div>
        <button ref={addButtonRef} type="button" disabled={loading} onClick={() => { setAddError(''); setAddOpen(true); }} className="min-h-11 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">+ Add merchandise</button>
      </div>
      {loading ? <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-600">Loading merchandise…</p> : items.length === 0 ? <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-600">No additional merchandise yet. Race-kit inclusions remain separate.</p> : items.map((item) => {
        const draft = drafts[item.id] ?? toDraft(item);
        return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-[#071b41]">{item.name}</h3><p className="mt-1 text-xs text-slate-500">PHP {Number(item.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.is_active ? 'Available' : 'Removed'}</span></div>
          <ProductFields draft={draft} onChange={(next) => updateDraft(item.id, next)} />
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void saveItem(item)} className="rounded-lg bg-[#071b41] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save changes</button><button type="button" disabled={busy} onClick={() => void saveItem(item, !item.is_active)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">{item.is_active ? 'Remove from registration' : 'Restore availability'}</button></div>
        </article>;
      })}
    </section>
    {addOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAddModal(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-merchandise-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeAddModal(); return; }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }} className="max-h-[min(92vh,900px)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><h2 id="add-merchandise-title" className="text-xl font-bold text-[#071b41]">Add merchandise</h2><p className="mt-1 text-sm text-slate-600">Optional paid products participants can add to their registration. Stock limits apply to each variant.</p></div>
          <button type="button" aria-label="Close add merchandise dialog" disabled={busy} onClick={closeAddModal} className="rounded-lg p-2 text-xl leading-none text-slate-500 hover:bg-slate-100 disabled:opacity-50">×</button>
        </div>
        <form onSubmit={(event) => void addItem(event)} className="space-y-5">
          <ProductFields draft={form} onChange={setForm} />
          {addError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" disabled={busy} onClick={closeAddModal} className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy || loading} className="min-h-10 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50">{busy ? 'Saving…' : 'Add merchandise'}</button>
          </div>
        </form>
      </div>
    </div>}
  </main>;
}
