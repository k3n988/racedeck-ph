'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { parseVariantOptions, variantOptionsPayload } from '@/lib/events/variant-options';
import { isValidRaceKitImage, MAX_RACE_KIT_ITEM_DESCRIPTION_LENGTH, MAX_RACE_KIT_PICKUP_LOCATIONS, MAX_RACE_KIT_PRODUCT_IMAGES, MAX_RACE_KIT_PRODUCT_VARIANTS, RACE_KIT_CLAIMING_ITEM, RACE_KIT_DELIVERY_OPTION } from '@/lib/events/race-kit';

type KitImage = { url: string; file?: File };
type Item = {
  id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  details: Record<string, unknown>;
  is_required: boolean;
  is_active: boolean;
  display_order: number;
};
type ItemDraft = Omit<Item, 'id'>;
type Config = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  race_kit_items: Item[];
};
type Category = { id: string; name: string };

const emptyItem = (kind: 'product' | 'text_inclusion' = 'product'): ItemDraft => ({
  item_code: '',
  item_name: '',
  quantity: 1,
  details: { kind, description: '', variants: [], product_image_urls: [], reference_image_url: null },
  is_required: false,
  is_active: true,
  display_order: 0,
});

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export default function RaceKitConfigPage({ params }: { params: { eventId: string } }) {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [config, setConfig] = useState({ name: '', description: '', category_id: null as string | null, status: 'active' as Config['status'] });
  const [configId, setConfigId] = useState<string | null>(null);
  const [item, setItem] = useState<ItemDraft>(emptyItem());
  const [variants, setVariants] = useState<string[]>([]);
  const [variantSlots, setVariantSlots] = useState<Record<string, string>>({});
  const [variantDraft, setVariantDraft] = useState('');
  const [productImages, setProductImages] = useState<KitImage[]>([]);
  const [referenceImage, setReferenceImage] = useState<KitImage | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [editorConfigId, setEditorConfigId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [editorError, setEditorError] = useState('');

  const load = useCallback(async (preserveMessage = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-config`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Race kit configurations could not be loaded.');
      setConfigs(data.configs ?? []);
      setCategories(data.categories ?? []);
      setError(false);
      if (!preserveMessage) setMessage('');
    } catch (loadError) {
      setError(true);
      setMessage(loadError instanceof Error ? loadError.message : 'Race kit configurations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  async function uploadAsset(kind: 'race_kit_image' | 'size_chart', file: File) {
    const body = new FormData();
    body.append('kind', kind);
    body.append('file', file);
    const response = await fetch(`/api/organizer/events/${params.eventId}/assets`, { method: 'POST', body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.url !== 'string') throw new Error(result.error ?? 'Race kit image could not be uploaded.');
    return result.url as string;
  }

  async function saveConfig(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-config${configId ? `/${configId}` : ''}`, {
        method: configId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Configuration could not be saved.');
      setConfigId(null);
      setConfig({ name: '', description: '', category_id: null, status: 'active' });
      setMessage('Race kit configuration saved.');
      await load(true);
    } catch (saveError) {
      setError(true);
      setMessage(saveError instanceof Error ? saveError.message : 'Configuration could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function setConfigStatus(current: Config) {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-config/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: current.name, description: current.description, category_id: current.category_id, status: current.status === 'active' ? 'inactive' : 'active' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Configuration status could not be updated.');
      setMessage(current.status === 'active' ? 'Configuration deactivated; it will no longer appear during registration.' : 'Configuration activated and available during registration.');
      await load(true);
    } catch (statusError) {
      setError(true);
      setMessage(statusError instanceof Error ? statusError.message : 'Configuration status could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(event: FormEvent, currentConfig: Config) {
    event.preventDefault();
    const isProduct = item.details.kind !== 'text_inclusion';
    const isClaimingItem = item.item_name.trim().toLocaleLowerCase() === RACE_KIT_CLAIMING_ITEM.toLocaleLowerCase();
    const variantNames = variants.map((variant) => variant.trim());
    const pickupLocations = variantNames.filter((variant) => variant.toLocaleLowerCase() !== RACE_KIT_DELIVERY_OPTION.toLocaleLowerCase());
    const duplicateVariants = new Set(variantNames.map((variant) => variant.toLocaleLowerCase())).size !== variantNames.length;
    const invalidVariantSlots = !isClaimingItem && Object.entries(variantSlots).some(([variant, value]) => {
      if (!variants.includes(variant) || !value.trim()) return false;
      const slots = Number(value);
      return !Number.isSafeInteger(slots) || slots < 0 || slots > 1000000;
    });
    const invalidImage = [...productImages.filter((image) => image.file).map((image) => image.file!), ...(referenceImage?.file ? [referenceImage.file] : [])].some((file) => !isValidRaceKitImage(file));
    let validationError = '';
    if (!item.item_name.trim()) validationError = 'Enter a name for this race kit item.';
    else if (item.item_name.trim().length > 160) validationError = 'Item names must be 160 characters or fewer.';
    else if (String(item.details.description ?? '').trim().length > MAX_RACE_KIT_ITEM_DESCRIPTION_LENGTH) validationError = 'Descriptions must be 1,000 characters or fewer.';
    else if (isProduct && (variantNames.some((variant) => !variant) || duplicateVariants)) validationError = 'Complete each option and remove duplicate choices.';
    else if (isProduct && variants.length > (isClaimingItem ? MAX_RACE_KIT_PICKUP_LOCATIONS + 1 : MAX_RACE_KIT_PRODUCT_VARIANTS)) validationError = isClaimingItem ? 'Use no more than 40 pickup locations, plus the delivery option.' : 'Use no more than 40 product options.';
    else if (isProduct && !isClaimingItem && (variantNames.some((variant) => variant.length > 80) || invalidVariantSlots)) validationError = 'Each option must be 80 characters or fewer, and entered slot counts must be whole numbers from 0 to 1,000,000.';
    else if (isClaimingItem && pickupLocations.some((location) => location.length > 160)) validationError = 'Pickup locations must be 160 characters or fewer.';
    else if (isClaimingItem && pickupLocations.length === 0 && !variantNames.some((variant) => variant.toLocaleLowerCase() === RACE_KIT_DELIVERY_OPTION.toLocaleLowerCase())) validationError = 'Add at least one pickup location or enable Race Kit Delivery.';
    else if (isProduct && productImages.length > MAX_RACE_KIT_PRODUCT_IMAGES) validationError = 'Upload no more than 8 product photos.';
    else if (isProduct && invalidImage) validationError = 'Images must be JPG, PNG, or WEBP files no larger than 10 MB each.';
    if (validationError) { setEditorError(validationError); return; }
    setEditorError('');
    setBusy(true);
    setError(false);
    try {
      const currentImageUrls = isProduct ? productImages.map((image) => image.file ? uploadAsset('race_kit_image', image.file) : Promise.resolve(image.url)) : [];
      const imageUrls = await Promise.all(currentImageUrls);
      const sizeChartUrl = isProduct ? referenceImage?.file ? await uploadAsset('size_chart', referenceImage.file) : referenceImage?.url ?? null : null;
      const name = item.item_name.trim();
      const itemCode = itemId ? item.item_code : `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'kit-item'}-${crypto.randomUUID().slice(0, 8)}`;
      const payload = {
        ...item,
        item_code: itemCode,
        item_name: name,
        details: { ...item.details, kind: isProduct ? 'product' : 'text_inclusion', description: String(item.details.description ?? '').trim() || null, variants: isProduct ? variantOptionsPayload(variants, variantSlots) : [], product_image_urls: imageUrls, reference_image_url: sizeChartUrl },
        is_required: isProduct && variants.length > 0,
      };
      const url = `/api/organizer/events/${params.eventId}/race-kit-config/${currentConfig.id}/items${itemId ? `/${itemId}` : ''}`;
      const response = await fetch(url, { method: itemId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Race kit item could not be saved.');
      resetItemEditor();
      setMessage('Race kit item saved and available to participant registration.');
      await load(true);
    } catch (saveError) {
      setError(true);
      setMessage(saveError instanceof Error ? saveError.message : 'Race kit item could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function resetItemEditor() {
    productImages.forEach((image) => { if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url); });
    if (referenceImage?.url.startsWith('blob:')) URL.revokeObjectURL(referenceImage.url);
    setItemId(null);
    setEditorConfigId(null);
    setItem(emptyItem());
    setVariants([]);
    setVariantSlots({});
    setVariantDraft('');
    setProductImages([]);
    setReferenceImage(null);
    setEditorError('');
  }

  function editItem(currentConfigId: string, currentItem: Item) {
    resetItemEditor();
    const details = currentItem.details && typeof currentItem.details === 'object' ? currentItem.details : {};
    setEditorConfigId(currentConfigId);
    setItemId(currentItem.id);
    setItem({ ...currentItem, details });
    const options = parseVariantOptions(details.variants);
    setVariants(options.map((option) => option.name));
    setVariantSlots(Object.fromEntries(options.filter((option) => option.slots !== null).map((option) => [option.name, String(option.slots)])));
    setVariantDraft('');
    setProductImages(strings(details.product_image_urls).map((url) => ({ url })));
    setReferenceImage(typeof details.reference_image_url === 'string' ? { url: details.reference_image_url } : null);
  }

  function addItem(currentConfig: Config, kind: 'product' | 'text_inclusion') {
    resetItemEditor();
    setItem(emptyItem(kind));
    setEditorConfigId(currentConfig.id);
  }

  async function setItemActive(currentConfigId: string, currentItem: Item) {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-config/${currentConfigId}/items/${currentItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentItem, is_active: !currentItem.is_active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Race kit item status could not be updated.');
      setMessage(currentItem.is_active ? 'Item deactivated; existing kit history is preserved.' : 'Item activated for participant registration.');
      await load(true);
    } catch (statusError) {
      setError(true);
      setMessage(statusError instanceof Error ? statusError.message : 'Race kit item status could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(currentConfigId: string, currentItem: Item) {
    if (!window.confirm(`Permanently remove ${currentItem.item_name}? If it has claim history, deactivate it instead.`)) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-config/${currentConfigId}/items/${currentItem.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Race kit item could not be removed.');
      setMessage('Race kit item removed.');
      await load(true);
    } catch (removeError) {
      setError(true);
      setMessage(removeError instanceof Error ? removeError.message : 'Race kit item could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  function addVariant() {
    const next = variantDraft.trim();
    if (!next || variants.some((value) => value.toLowerCase() === next.toLowerCase())) return;
    if (next.toLocaleLowerCase() === RACE_KIT_DELIVERY_OPTION.toLocaleLowerCase() && item.item_name.trim().toLocaleLowerCase() === RACE_KIT_CLAIMING_ITEM.toLocaleLowerCase()) {
      setEditorError('Use the Race Kit Delivery checkbox to add the reserved delivery option.');
      return;
    }
    const claimingItem = item.item_name.trim().toLocaleLowerCase() === RACE_KIT_CLAIMING_ITEM.toLocaleLowerCase();
    if (claimingItem && variants.filter((value) => value.toLocaleLowerCase() !== RACE_KIT_DELIVERY_OPTION.toLocaleLowerCase()).length >= MAX_RACE_KIT_PICKUP_LOCATIONS) {
      setEditorError('Use no more than 40 pickup locations.');
      return;
    }
    if (!claimingItem && variants.length >= MAX_RACE_KIT_PRODUCT_VARIANTS) {
      setEditorError('Use no more than 40 product options.');
      return;
    }
    setEditorError('');
    setVariants([...variants, next]);
    setVariantSlots((current) => ({ ...current, [next]: '' }));
    if (!itemId) setItem((current) => ({ ...current, is_required: true }));
    setVariantDraft('');
  }

  function addProductImages(files: File[]) {
    if (productImages.length + files.length > MAX_RACE_KIT_PRODUCT_IMAGES) {
      setEditorError('Upload no more than 8 product photos.');
      return;
    }
    if (files.some((file) => !isValidRaceKitImage(file))) {
      setEditorError('Images must be JPG, PNG, or WEBP files no larger than 10 MB each.');
      return;
    }
    setEditorError('');
    setProductImages([...productImages, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function addReferenceImage(file: File | undefined) {
    if (!file) return;
    if (!isValidRaceKitImage(file)) {
      setEditorError('Images must be JPG, PNG, or WEBP files no larger than 10 MB each.');
      return;
    }
    setEditorError('');
    if (referenceImage?.url.startsWith('blob:')) URL.revokeObjectURL(referenceImage.url);
    setReferenceImage({ file, url: URL.createObjectURL(file) });
  }

  const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100';
  const editItemDescription = typeof item.details.description === 'string' ? item.details.description : '';
  const isProductItem = item.details.kind !== 'text_inclusion';
  const isClaimingItem = item.item_name.trim().toLocaleLowerCase() === RACE_KIT_CLAIMING_ITEM.toLocaleLowerCase();

  return (
    <main className="mx-auto max-w-6xl space-y-6 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
      {message && <ToastFeedback message={message} tone="auto"><div className="flex items-center gap-3"><span>{message}</span>{error && <button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button>}</div></ToastFeedback>}

      <form onSubmit={saveConfig} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold text-[#071b41]">{configId ? 'Edit race kit configuration' : 'Add race kit configuration'}</h2><p className="mt-1 text-sm text-slate-600">Create one shared kit or configure a kit for a specific category.</p></div>{configId && <button type="button" onClick={() => { setConfigId(null); setConfig({ name: '', description: '', category_id: null, status: 'active' }); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Cancel edit</button>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Configuration name<input required maxLength={160} value={config.name} onChange={(event) => setConfig({ ...config, name: event.target.value })} placeholder="e.g. 5K Race Kit" className={inputClass} /></label>
          <label className="block text-sm font-semibold text-slate-700">Applies to<select value={config.category_id ?? ''} onChange={(event) => setConfig({ ...config, category_id: event.target.value || null })} className={inputClass}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-500">(optional)</span><textarea maxLength={1000} value={config.description} onChange={(event) => setConfig({ ...config, description: event.target.value })} placeholder="Short description shown with the included kit" className={`${inputClass} min-h-20`} /></label>
        <button disabled={busy} className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : configId ? 'Save configuration' : 'Add configuration'}</button>
      </form>

      <div className="space-y-4">
        {!loading && !error && configs.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-2xl text-orange-600" aria-hidden="true">＋</div><h2 className="mt-3 font-bold text-[#071b41]">No race kit configured yet</h2><p className="mt-1 text-sm text-slate-600">Add an included singlet, shirt, or other race kit above. It will appear to participants after they select an eligible category.</p></div>}
        {configs.map((current) => {
          const currentCategory = categories.find((category) => category.id === current.category_id)?.name ?? 'All categories';
          return <section key={current.id} className={`rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${current.status === 'inactive' ? 'border-slate-200 opacity-80' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-[#071b41]">{current.name}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${current.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{current.status === 'active' ? 'Active' : 'Inactive'}</span></div><p className="mt-1 text-sm text-slate-600">Applies to {currentCategory} · {current.race_kit_items?.filter((kitItem) => kitItem.is_active).length ?? 0} active items</p>{current.description && <p className="mt-1 text-sm text-slate-600">{current.description}</p>}</div>
              <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { setConfigId(current.id); setConfig({ name: current.name, description: current.description ?? '', category_id: current.category_id, status: current.status }); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Edit config</button><button type="button" disabled={busy} onClick={() => void setConfigStatus(current)} className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${current.status === 'active' ? 'border-amber-300 text-amber-800' : 'border-emerald-300 text-emerald-800'}`}>{current.status === 'active' ? 'Deactivate' : 'Activate'}</button></div>
            </div>

            <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
              {current.race_kit_items?.map((currentItem) => {
                const details = currentItem.details && typeof currentItem.details === 'object' ? currentItem.details : {};
                const itemVariants = parseVariantOptions(details.variants).map((option) => option.name);
                const imageUrls = strings(details.product_image_urls);
                return <article key={currentItem.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                  <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
                    {imageUrls[0] && <Image src={imageUrls[0]} alt="" width={80} height={64} unoptimized className="h-16 w-20 rounded-lg border border-slate-200 object-cover" />}
                    <div className="min-w-[12rem] flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{currentItem.item_name}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${currentItem.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{currentItem.is_active ? 'Active' : 'Inactive'}</span></div><p className="mt-1 text-sm text-slate-600">{typeof details.description === 'string' && details.description ? details.description : 'Included in this registration category'} · Qty {currentItem.quantity}</p>{itemVariants.length > 0 && <p className="mt-1 text-sm text-slate-600">{currentItem.item_name.trim().toLowerCase() === 'race kit claiming' ? 'Claiming places' : 'Sizes / options'}: {itemVariants.join(', ')}</p>}{typeof details.reference_image_url === 'string' && <a href={details.reference_image_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-sm font-semibold text-orange-700 underline">View size guide</a>}</div>
                  </div>
                  <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => editItem(current.id, currentItem)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-60">Edit</button><button type="button" disabled={busy} onClick={() => void setItemActive(current.id, currentItem)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-semibold text-amber-800 disabled:opacity-60">{currentItem.is_active ? 'Deactivate' : 'Activate'}</button><button type="button" disabled={busy} onClick={() => void removeItem(current.id, currentItem)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-60">Remove</button></div>
                </article>;
              })}
              {!current.race_kit_items?.length && <p className="py-4 text-sm text-slate-600">No items yet. Add an included product or kit item below.</p>}
            </div>

            {editorConfigId === current.id ? <form onSubmit={(event) => void saveItem(event, current)} className="mt-4 space-y-4 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-[#071b41]">{itemId ? 'Edit included item' : 'Add included item'}</h3><p className="mt-1 text-xs text-slate-600">Matches the race kit fields in Create Event. These items are included, not paid merchandise.</p></div><button type="button" onClick={resetItemEditor} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">Close</button></div>
              <label className="block max-w-sm text-sm font-semibold text-slate-700">Item type<select value={isProductItem ? 'product' : 'text_inclusion'} onChange={(event) => { const kind = event.target.value as 'product' | 'text_inclusion'; setItem({ ...item, details: { ...item.details, kind }, is_required: kind === 'product' && variants.length > 0 }); if (kind === 'text_inclusion') { setVariants([]); setProductImages([]); setReferenceImage(null); } }} className={inputClass}><option value="text_inclusion">Simple inclusion (text only)</option><option value="product">Product with choices or images</option></select></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">{isProductItem ? 'Product name' : 'Inclusion name'}<input required maxLength={160} value={item.item_name} onChange={(event) => setItem({ ...item, item_name: event.target.value })} placeholder={isProductItem ? 'e.g. Event singlet' : 'e.g. E-certificate'} className={inputClass} /></label>
                <label className="block text-sm font-semibold text-slate-700">Quantity included<input required type="number" min="1" max="100" value={item.quantity} onChange={(event) => setItem({ ...item, quantity: Number(event.target.value) })} className={inputClass} /></label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-500">(optional)</span><input maxLength={MAX_RACE_KIT_ITEM_DESCRIPTION_LENGTH} value={editItemDescription} onChange={(event) => setItem({ ...item, details: { ...item.details, description: event.target.value } })} placeholder="e.g. Moisture-wicking event singlet" className={inputClass} /></label>
              {isProductItem && <>
              <div><label className="block text-sm font-semibold text-slate-700">{item.item_name.trim().toLowerCase() === 'race kit claiming' ? 'Claiming place options' : 'Available variants'} <span className="font-normal text-slate-500">{item.item_name.trim().toLowerCase() === 'race kit claiming' ? '(participant chooses one)' : '(sizes, colors, or other options)'}</span></label><div className="mt-2 space-y-2">{variants.map((variant) => <div key={variant} className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 rounded-lg border border-slate-200 bg-white p-2"><span className="min-w-0 break-words text-sm font-semibold text-slate-700">{variant}</span>{item.item_name.trim().toLowerCase() !== 'race kit claiming' && <label className="text-xs font-semibold text-slate-600">Slots<input type="number" min="0" step="1" inputMode="numeric" value={variantSlots[variant] ?? ''} onChange={(event) => setVariantSlots({ ...variantSlots, [variant]: event.target.value })} aria-label={`Available slots for ${variant}`} placeholder="Qty" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label>}<button type="button" onClick={() => { setVariants(variants.filter((value) => value !== variant)); const next = { ...variantSlots }; delete next[variant]; setVariantSlots(next); }} className="ml-1 rounded px-2 py-1 text-slate-600" aria-label={`Remove ${variant}`}>×</button></div>)}</div><div className="mt-2 flex gap-2"><input value={variantDraft} onChange={(event) => setVariantDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addVariant(); } }} placeholder={item.item_name.trim().toLowerCase() === 'race kit claiming' ? 'Add a place, e.g. Race-day venue' : 'Add a variant, e.g. Kids Small'} className={`${inputClass} mt-0`} /><button type="button" onClick={addVariant} disabled={!variantDraft.trim()} className="shrink-0 rounded-lg border border-orange-300 bg-white px-3 text-sm font-bold text-orange-700 disabled:opacity-50">Add</button></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">Product photos <span className="font-normal text-slate-500">(JPG, PNG, WEBP · max 10 MB each)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addProductImages(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1`} />{productImages.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{productImages.map((image, index) => <div key={`${image.url}-${index}`} className="relative"><Image src={image.url} alt={`Product photo ${index + 1}`} width={80} height={64} unoptimized className="h-16 w-20 rounded-md border border-slate-200 object-cover" /><button type="button" aria-label={`Remove product photo ${index + 1}`} onClick={() => { if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url); setProductImages(productImages.filter((_, imageIndex) => imageIndex !== index)); }} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white">×</button></div>)}</div>}</label>
                <label className="block text-sm font-semibold text-slate-700">Size chart or reference guide <span className="font-normal text-slate-500">(optional)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { addReferenceImage(event.target.files?.[0]); event.currentTarget.value = ''; }} className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1`} />{referenceImage && <div className="mt-2 flex items-center gap-2"><Image src={referenceImage.url} alt="Size guide preview" width={80} height={64} unoptimized className="h-16 w-20 rounded-md border border-slate-200 object-cover" /><button type="button" onClick={() => { if (referenceImage.url.startsWith('blob:')) URL.revokeObjectURL(referenceImage.url); setReferenceImage(null); }} className="text-sm font-semibold text-red-700">Remove guide</button></div>}</label>
              </div>
              {isClaimingItem && <label className="inline-flex cursor-pointer items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={variants.some((variant) => variant.toLocaleLowerCase() === RACE_KIT_DELIVERY_OPTION.toLocaleLowerCase())} onChange={(event) => setVariants((current) => event.target.checked ? current.some((variant) => variant.toLocaleLowerCase() === RACE_KIT_DELIVERY_OPTION.toLocaleLowerCase()) ? current : [...current, RACE_KIT_DELIVERY_OPTION] : current.filter((variant) => variant.toLocaleLowerCase() !== RACE_KIT_DELIVERY_OPTION.toLocaleLowerCase()))} className="mt-0.5 h-4 w-4 accent-orange-600" /><span><span className="font-semibold">Enable Race Kit Delivery</span><span className="mt-0.5 block text-xs text-slate-500">Participants can choose delivery to the address entered during registration.</span></span></label>}
              {variants.length > 0 && <p className="text-sm text-slate-600">Participants must choose one option when choices are configured, matching Create Event.</p>}
              </>}
              {editorError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{editorError}</p>}
              <div className="flex flex-wrap gap-2"><button disabled={busy || !item.item_name.trim()} className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : itemId ? 'Save item' : 'Add included item'}</button><button type="button" disabled={busy} onClick={resetItemEditor} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button></div>
            </form> : <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => addItem(current, 'text_inclusion')} className="rounded-lg border border-orange-300 px-4 py-2.5 text-sm font-bold text-orange-700 disabled:opacity-60">+ Add simple inclusion</button><button type="button" disabled={busy} onClick={() => addItem(current, 'product')} className="rounded-lg border border-orange-300 px-4 py-2.5 text-sm font-bold text-orange-700 disabled:opacity-60">+ Add product with choices</button></div>}
          </section>;
        })}
      </div>
    </main>
  );
}
