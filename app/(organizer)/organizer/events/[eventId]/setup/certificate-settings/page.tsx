'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { readCertificateLayout, writeCertificateLayout } from '@/lib/certificates/layout';

type Category = { id: string; name: string };
type Template = { id: string; name: string; certificate_title: string; version: number; is_system_template: boolean; background_asset_reference: string | null; layout_config: unknown };
type Settings = {
  enabled: boolean;
  template_id: string | null;
  certificate_title: string | null;
  event_logo_reference: string | null;
  organizer_logo_reference: string | null;
  sponsor_logo_config: unknown[];
  signature_image_reference: string | null;
  signatory_name: string | null;
  signatory_position: string | null;
  certificate_message: string | null;
  eligibility_mode: 'finished_all' | 'finished_selected_categories' | 'organizer_defined';
  category_ids: string[];
};

const empty: Settings = {
  enabled: false,
  template_id: null,
  certificate_title: null,
  event_logo_reference: null,
  organizer_logo_reference: null,
  sponsor_logo_config: [],
  signature_image_reference: null,
  signatory_name: null,
  signatory_position: null,
  certificate_message: null,
  eligibility_mode: 'organizer_defined',
  category_ids: [],
};

const controlClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
type ImageReferenceKey = 'event_logo_reference' | 'organizer_logo_reference' | 'signature_image_reference';
type PendingImage = { file: File; url: string };

function CertificateImageField({ label, reference, pending, disabled, onReferenceChange, onFile, onClear }: {
  label: string;
  reference: string | null;
  pending?: PendingImage;
  disabled: boolean;
  onReferenceChange: (value: string) => void;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const [error, setError] = useState('');
  const preview = pending?.url ?? reference;
  return <div className="min-w-0">
    <label className="block text-sm font-semibold text-slate-700">{label} URL<input type="url" value={reference ?? ''} disabled={disabled} onChange={(event) => onReferenceChange(event.target.value)} className={controlClass} placeholder="https://â€¦" /></label>
    <label className="mt-2 block text-xs font-semibold text-slate-600">Or upload an image (JPG, PNG, or WEBP · max 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) { setError(`${file.name} must be a JPG, PNG, or WEBP image up to 10 MB.`); return; }
      setError('');
      onFile(file);
    }} className={`${controlClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-semibold file:text-slate-700`} /></label>
    {error && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    {preview && <div className="mt-2 flex items-center gap-3"><Image src={preview} alt={`${label} preview`} width={88} height={64} unoptimized className="h-16 w-[88px] rounded-lg border border-slate-200 bg-slate-50 object-contain" /><button type="button" disabled={disabled} onClick={onClear} className="text-sm font-semibold text-red-700 disabled:opacity-50">Remove image</button></div>}
  </div>;
}

export default function CertificateSettingsPage({ params }: { params: { eventId: string } }) {
  const [settings, setSettings] = useState<Settings>(empty);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [event, setEvent] = useState({ name: 'Event', event_date: '', logo_url: null as string | null, organizer_logo_url: null as string | null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [issuedCount, setIssuedCount] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [imageUploads, setImageUploads] = useState<Partial<Record<ImageReferenceKey, PendingImage>>>({});
  const [backgroundUpload, setBackgroundUpload] = useState<PendingImage | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const layout = readCertificateLayout(settings.sponsor_logo_config);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/certificate-settings`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Certificate settings could not be loaded.');
      setEvent(data.event ?? { name: 'Event', event_date: '', logo_url: null, organizer_logo_url: null });
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
      setIssuedCount(typeof data.issued_count === 'number' ? data.issued_count : 0);
      setSettings(data.settings ? {
        ...empty,
        ...data.settings,
        event_logo_reference: data.settings.event_logo_reference ?? data.event?.logo_url ?? null,
        organizer_logo_reference: data.settings.organizer_logo_reference ?? data.event?.organizer_logo_url ?? null,
        category_ids: data.settings.category_ids ?? [],
      } : { ...empty, event_logo_reference: data.event?.logo_url ?? null, organizer_logo_reference: data.event?.organizer_logo_url ?? null });
      setBackgroundUpload((current) => { if (current?.url.startsWith('blob:')) URL.revokeObjectURL(current.url); return null; });
      setDirty(false);
      setError(false);
      setLoadFailed(false);
      setMessage('');
    } catch (error) {
      setError(true);
      setLoadFailed(true);
      setMessage(error instanceof Error ? error.message : 'Certificate settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  function update(change: Partial<Settings>) {
    setDirty(true);
    setSettings((current) => ({ ...current, ...change }));
  }

  function updateLayout(change: Partial<ReturnType<typeof readCertificateLayout>>) {
    update({ sponsor_logo_config: writeCertificateLayout(settings.sponsor_logo_config, { ...layout, ...change }) });
  }

  function moveParticipantName(event: React.PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !previewRef.current) return;
    const bounds = previewRef.current.getBoundingClientRect();
    const x = Math.round(Math.min(90, Math.max(10, ((event.clientX - bounds.left) / bounds.width) * 100)));
    const y = Math.round(Math.min(85, Math.max(20, ((event.clientY - bounds.top) / bounds.height) * 100)));
    updateLayout({ participant_name_position: { x, y } });
  }

  function toggleCategory(id: string) {
    update({ category_ids: settings.category_ids.includes(id) ? settings.category_ids.filter((value) => value !== id) : [...settings.category_ids, id] });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (settings.enabled && !settings.template_id) { setError(true); setMessage('Choose an active certificate template before enabling certificates.'); return; }
    if (settings.eligibility_mode === 'finished_selected_categories' && settings.category_ids.length === 0) { setError(true); setMessage('Select at least one eligible category.'); return; }
    setBusy(true);
    setError(false);
    setMessage('');
    try {
      const savedSettings = { ...settings };
      for (const [key, upload] of Object.entries(imageUploads) as Array<[ImageReferenceKey, PendingImage]>) {
        const formData = new FormData();
        formData.append('file', upload.file);
        formData.append('kind', 'certificate_asset');
        const uploadResponse = await fetch(`/api/organizer/events/${params.eventId}/assets?kind=certificate_asset`, { method: 'POST', body: formData });
        const uploadData = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || !uploadData.url) throw new Error(uploadData.error ?? `The ${key.replaceAll('_', ' ')} image could not be uploaded.`);
        savedSettings[key] = uploadData.url;
      }
      if (backgroundUpload) {
        const formData = new FormData();
        formData.append('file', backgroundUpload.file);
        formData.append('kind', 'certificate_asset');
        const uploadResponse = await fetch(`/api/organizer/events/${params.eventId}/assets?kind=certificate_asset`, { method: 'POST', body: formData });
        const uploadData = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || !uploadData.url) throw new Error(uploadData.error ?? 'Certificate background could not be uploaded.');
        const currentLayout = readCertificateLayout(savedSettings.sponsor_logo_config);
        savedSettings.sponsor_logo_config = writeCertificateLayout(savedSettings.sponsor_logo_config, { ...currentLayout, background_reference: uploadData.url });
      }
      const response = await fetch(`/api/organizer/events/${params.eventId}/certificate-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedSettings),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Certificate settings could not be saved.');
      Object.values(imageUploads).forEach((upload) => { if (upload?.url.startsWith('blob:')) URL.revokeObjectURL(upload.url); });
      setImageUploads({});
      if (backgroundUpload?.url.startsWith('blob:')) URL.revokeObjectURL(backgroundUpload.url);
      setBackgroundUpload(null);
      setSettings({ ...savedSettings, category_ids: settings.category_ids });
      setDirty(false);
      setMessage('Certificate settings saved.');
    } catch (error) {
      setError(true);
      setMessage(error instanceof Error ? error.message : 'Certificate settings could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function setImageFile(key: ImageReferenceKey, file: File) {
    setDirty(true);
    setImageUploads((current) => {
      const previous = current[key];
      if (previous?.url.startsWith('blob:')) URL.revokeObjectURL(previous.url);
      return { ...current, [key]: { file, url: URL.createObjectURL(file) } };
    });
  }

  function setImageReference(key: ImageReferenceKey, value: string) {
    setImageUploads((current) => {
      const previous = current[key];
      if (previous?.url.startsWith('blob:')) URL.revokeObjectURL(previous.url);
      const next = { ...current };
      delete next[key];
      return next;
    });
    update({ [key]: value || null } as Pick<Settings, ImageReferenceKey>);
  }

  function clearImageReference(key: ImageReferenceKey) {
    setImageUploads((current) => {
      const previous = current[key];
      if (previous?.url.startsWith('blob:')) URL.revokeObjectURL(previous.url);
      const next = { ...current };
      delete next[key];
      return next;
    });
    update({ [key]: null } as Pick<Settings, ImageReferenceKey>);
  }

  async function issueCertificates() {
    if (dirty) { setError(true); setMessage('Save certificate settings before issuing participant certificates.'); return; }
    setBusy(true);
    setError(false);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/certificates/issue`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Certificates could not be issued.');
      setIssuedCount(data.participants ?? issuedCount);
      setMessage(`${data.certificates_issued.toLocaleString()} certificates generated and ${data.emails_queued.toLocaleString()} participant emails queued.`);
    } catch (issueError) {
      setError(true);
      setMessage(issueError instanceof Error ? issueError.message : 'Certificates could not be issued.');
    } finally {
      setBusy(false);
    }
  }

  const selectedTemplate = templates.find((template) => template.id === settings.template_id);
  const isError = error;
  const previewDate = event.event_date ? new Date(`${event.event_date}T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : 'Event date';

  return <main className="mx-auto max-w-6xl space-y-6 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    {message && !loading && <ToastFeedback message={String(message)} tone={isError ? 'error' : 'auto'}>{isError ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div> : undefined}</ToastFeedback>}

    {loading ? <div role="status" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><span className="sr-only">Loading certificate settings…</span><div className="h-5 w-48 animate-pulse rounded bg-slate-200" /><div className="h-32 animate-pulse rounded-xl bg-slate-100" /><div className="h-32 animate-pulse rounded-xl bg-slate-100" /></div> : !loadFailed && <form onSubmit={(event) => void save(event)} className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={settings.enabled} disabled={busy} onChange={(event) => update({ enabled: event.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-orange-600" />
            <span><span className="block font-bold text-[#071b41]">Enable participant certificates</span><span className="mt-1 block text-sm leading-5 text-slate-600">Send a certificate to each confirmed participant after you issue them.</span></span>
          </label>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">Certificate title <span className="font-normal text-slate-500">(optional)</span>
              <input maxLength={240} value={settings.certificate_title ?? ''} disabled={busy} onChange={(event) => update({ certificate_title: event.target.value || null })} className={controlClass} placeholder="Certificate of Completion" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Template
              <select value={settings.template_id ?? ''} disabled={busy} onChange={(event) => update({ template_id: event.target.value || null })} className={controlClass}>
                <option value="">Select a template</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name} · v{template.version}{template.is_system_template ? ' · RaceDeck' : ''}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#071b41]">Participant eligibility</h2>
          <p className="mt-1 text-sm text-slate-600">Choose who can receive a certificate.</p>
          <fieldset className="mt-4 space-y-3">
            <legend className="sr-only">Choose certificate eligibility</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-orange-200 bg-orange-50/40 p-3 hover:bg-orange-50">
              <input type="radio" name="eligibility" checked={settings.eligibility_mode === 'organizer_defined'} disabled={busy} onChange={() => update({ eligibility_mode: 'organizer_defined', category_ids: [] })} className="mt-1 accent-orange-600" />
              <span><span className="block text-sm font-semibold text-slate-800">All confirmed participants</span><span className="mt-1 block text-xs leading-5 text-slate-500">Issue a participation certificate to every confirmed registration, even without race results.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
              <input type="radio" name="eligibility" checked={settings.eligibility_mode === 'finished_all'} disabled={busy} onChange={() => update({ eligibility_mode: 'finished_all', category_ids: [] })} className="mt-1 accent-orange-600" />
              <span><span className="block text-sm font-semibold text-slate-800">All categories</span><span className="mt-1 block text-xs leading-5 text-slate-500">Any participant recorded as a finisher is eligible.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
              <input type="radio" name="eligibility" checked={settings.eligibility_mode === 'finished_selected_categories'} disabled={busy} onChange={() => update({ eligibility_mode: 'finished_selected_categories' })} className="mt-1 accent-orange-600" />
              <span><span className="block text-sm font-semibold text-slate-800">Selected categories</span><span className="mt-1 block text-xs leading-5 text-slate-500">Choose the categories whose finishers are eligible.</span></span>
            </label>
          </fieldset>
          {settings.eligibility_mode === 'finished_selected_categories' && <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-800">Eligible categories</p>
            {categories.length ? <div className="grid gap-2 sm:grid-cols-2">{categories.map((category) => <label key={category.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700"><input type="checkbox" checked={settings.category_ids.includes(category.id)} disabled={busy} onChange={() => toggleCategory(category.id)} className="accent-orange-600" />{category.name}</label>)}</div> : <p className="text-sm text-slate-600">Add race categories before selecting eligibility.</p>}
          </div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#071b41]">Certificate details</h2>
          <p className="mt-1 text-sm text-slate-600">Add the template artwork, logos, and signatory details.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">Certificate background image <span className="font-normal text-slate-500">(optional · JPG, PNG, or WEBP up to 10 MB)</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (!file) return;
                  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) { setError(true); setMessage(`${file.name} must be a JPG, PNG, or WEBP image up to 10 MB.`); return; }
                  setError(false); setMessage('');
                  setBackgroundUpload((current) => { if (current?.url.startsWith('blob:')) URL.revokeObjectURL(current.url); return { file, url: URL.createObjectURL(file) }; });
                  setDirty(true);
                }} className={`${controlClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-semibold file:text-slate-700`} />
              </label>
              {(backgroundUpload || layout.background_reference) && <button type="button" disabled={busy} onClick={() => { if (backgroundUpload?.url.startsWith('blob:')) URL.revokeObjectURL(backgroundUpload.url); setBackgroundUpload(null); updateLayout({ background_reference: null }); }} className="mt-2 text-sm font-semibold text-red-700 disabled:opacity-50">Remove custom background</button>}
            </div>
            <CertificateImageField label="Event logo" reference={settings.event_logo_reference} pending={imageUploads.event_logo_reference} disabled={busy} onReferenceChange={(value) => setImageReference('event_logo_reference', value)} onFile={(file) => setImageFile('event_logo_reference', file)} onClear={() => clearImageReference('event_logo_reference')} />
            <CertificateImageField label="Organizer logo" reference={settings.organizer_logo_reference} pending={imageUploads.organizer_logo_reference} disabled={busy} onReferenceChange={(value) => setImageReference('organizer_logo_reference', value)} onFile={(file) => setImageFile('organizer_logo_reference', file)} onClear={() => clearImageReference('organizer_logo_reference')} />
            <CertificateImageField label="Signature image" reference={settings.signature_image_reference} pending={imageUploads.signature_image_reference} disabled={busy} onReferenceChange={(value) => setImageReference('signature_image_reference', value)} onFile={(file) => setImageFile('signature_image_reference', file)} onClear={() => clearImageReference('signature_image_reference')} />
            <label className="block text-sm font-semibold text-slate-700">Signatory name<input maxLength={200} value={settings.signatory_name ?? ''} disabled={busy} onChange={(event) => update({ signatory_name: event.target.value || null })} className={controlClass} placeholder="Name shown on certificate" /></label>
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Signatory position<input maxLength={200} value={settings.signatory_position ?? ''} disabled={busy} onChange={(event) => update({ signatory_position: event.target.value || null })} className={controlClass} placeholder="e.g. Race Director" /></label>
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Certificate message<textarea maxLength={4000} rows={4} value={settings.certificate_message ?? ''} disabled={busy} onChange={(event) => update({ certificate_message: event.target.value || null })} className={`${controlClass} min-h-24 resize-y leading-6`} placeholder="Optional message for finishers" /><span className="mt-1 block text-right text-xs font-normal text-slate-500">{(settings.certificate_message ?? '').length}/4,000</span></label>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="text-sm text-slate-600">{issuedCount.toLocaleString()} certificates issued</div>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => void issueCertificates()} disabled={busy || dirty || !settings.enabled || !settings.template_id || settings.eligibility_mode !== 'organizer_defined'} title={dirty ? 'Save settings before issuing certificates' : undefined} className="min-h-11 rounded-xl border border-orange-300 bg-white px-5 py-2.5 text-sm font-bold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">Issue &amp; email all participants</button>
            <button disabled={busy} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-wait disabled:opacity-60">{busy ? 'Saving…' : 'Save certificate settings'}</button>
          </div>
        </div>
      </div>

      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Preview</p><h2 className="mt-1 text-lg font-bold text-[#071b41]">Finisher certificate</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${settings.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{settings.enabled ? 'Enabled' : 'Disabled'}</span></div>
        <div ref={previewRef} className="relative mt-4 aspect-[1.414/1] overflow-hidden rounded-xl border border-[#d8c79a] bg-[#fffdf7] bg-cover bg-center p-5 text-center shadow-inner sm:p-7" style={{ backgroundImage: `url("${backgroundUpload?.url ?? layout.background_reference ?? selectedTemplate?.background_asset_reference ?? ''}")` }}>
          <div className="flex items-center justify-center gap-5">{settings.event_logo_reference && <Image src={imageUploads.event_logo_reference?.url ?? settings.event_logo_reference} alt="Event logo" width={84} height={64} unoptimized className="h-14 w-20 object-contain" />}<div className="grid h-12 w-12 place-items-center rounded-full border border-[#d8c79a] text-xl font-black text-[#b08c3f]">R</div>{settings.organizer_logo_reference && <Image src={imageUploads.organizer_logo_reference?.url ?? settings.organizer_logo_reference} alt="Organizer logo" width={84} height={64} unoptimized className="h-14 w-20 object-contain" />}</div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7c3d]">{event.name}</p>
          <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-500">{selectedTemplate?.name ?? 'Finisher certificate'}</p>
          <h3 className="mt-1 text-lg font-bold text-[#071b41]">{settings.certificate_title || selectedTemplate?.certificate_title || 'Certificate of Completion'}</h3>
          <button type="button" aria-label="Drag to position sample participant name" onPointerDown={(pointerEvent) => pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)} onPointerMove={moveParticipantName} className="absolute z-10 max-w-[85%] touch-none cursor-move whitespace-nowrap rounded border border-dashed border-orange-500 bg-white/85 px-3 py-1 text-base font-semibold text-slate-800 shadow-sm" style={{ left: `${layout.participant_name_position.x}%`, top: `${layout.participant_name_position.y}%`, transform: 'translate(-50%, -50%)' }}>Sample Participant Name</button>
          <p className="absolute bottom-4 left-0 right-0 text-xs text-slate-500">Participant Â· {previewDate}</p>
          {settings.certificate_message && <p className="mt-4 text-xs leading-5 text-slate-600">{settings.certificate_message}</p>}
          {settings.signature_image_reference && <Image src={imageUploads.signature_image_reference?.url ?? settings.signature_image_reference} alt="Signature" width={160} height={72} unoptimized className="mx-auto mt-5 h-12 max-w-40 object-contain" />}
          {settings.signatory_name && <p className="mt-2 border-t border-slate-300 pt-2 text-sm font-semibold text-slate-700">{settings.signatory_name}<span className="block text-xs font-normal text-slate-500">{settings.signatory_position}</span></p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Drag the sample name to set where each participant’s name appears. Save settings, then issue certificates to queue one email per confirmed participant.</p>
      </aside>
    </form>}
  </main>;
}
