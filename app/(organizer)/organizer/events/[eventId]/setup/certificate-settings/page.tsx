'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Category = { id: string; name: string };
type Template = { id: string; name: string; certificate_title: string; version: number; is_system_template: boolean };
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
  eligibility_mode: 'finished_all',
  category_ids: [],
};

const controlClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export default function CertificateSettingsPage({ params }: { params: { eventId: string } }) {
  const [settings, setSettings] = useState<Settings>(empty);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [event, setEvent] = useState({ name: 'Event', event_date: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/certificate-settings`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Certificate settings could not be loaded.');
      setEvent(data.event ?? { name: 'Event', event_date: '' });
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
      setSettings(data.settings ? { ...empty, ...data.settings, category_ids: data.settings.category_ids ?? [] } : empty);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Certificate settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  function update(change: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...change }));
  }

  function toggleCategory(id: string) {
    update({ category_ids: settings.category_ids.includes(id) ? settings.category_ids.filter((value) => value !== id) : [...settings.category_ids, id] });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/certificate-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Certificate settings could not be saved.');
      await load();
      setMessage('Certificate settings saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Certificate settings could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const isError = /could not|failed|error/i.test(message);
  const previewDate = event.event_date ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString() : 'Event date';

  return <main className="mx-auto max-w-6xl space-y-6 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
    <header className="border-b border-slate-200 pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event setup</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Certificate Settings</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Set up optional finisher certificates and choose which participants can receive one.</p>
    </header>

    {message && !loading && <ToastFeedback message={String(message)} tone="auto">{isError ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Try again</button></div> : undefined}</ToastFeedback>}

    {loading ? <div role="status" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><span className="sr-only">Loading certificate settings…</span><div className="h-5 w-48 animate-pulse rounded bg-slate-200" /><div className="h-32 animate-pulse rounded-xl bg-slate-100" /><div className="h-32 animate-pulse rounded-xl bg-slate-100" /></div> : !isError && <form onSubmit={(event) => void save(event)} className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={settings.enabled} disabled={busy} onChange={(event) => update({ enabled: event.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-orange-600" />
            <span><span className="block font-bold text-[#071b41]">Enable finisher certificates</span><span className="mt-1 block text-sm leading-5 text-slate-600">Participants who meet the eligibility rules can receive a RaceDeck e-certificate.</span></span>
          </label>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">Certificate title <span className="font-normal text-slate-500">(optional)</span>
              <input maxLength={160} value={settings.certificate_title ?? ''} disabled={busy} onChange={(event) => update({ certificate_title: event.target.value || null })} className={controlClass} placeholder="Certificate of Completion" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Template
              <select value={settings.template_id ?? ''} disabled={busy} onChange={(event) => update({ template_id: event.target.value || null })} className={controlClass}>
                <option value="">Use generation default</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name} · v{template.version}{template.is_system_template ? ' · RaceDeck' : ''}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#071b41]">Participant eligibility</h2>
          <p className="mt-1 text-sm text-slate-600">Certificates are generated for eligible finishers.</p>
          <fieldset className="mt-4 space-y-3">
            <legend className="sr-only">Choose certificate eligibility</legend>
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
          <p className="mt-1 text-sm text-slate-600">Add the image references and signatory details used by the selected template.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">Event logo URL<input type="url" value={settings.event_logo_reference ?? ''} disabled={busy} onChange={(event) => update({ event_logo_reference: event.target.value || null })} className={controlClass} placeholder="https://…" /></label>
            <label className="block text-sm font-semibold text-slate-700">Organizer logo URL<input type="url" value={settings.organizer_logo_reference ?? ''} disabled={busy} onChange={(event) => update({ organizer_logo_reference: event.target.value || null })} className={controlClass} placeholder="https://…" /></label>
            <label className="block text-sm font-semibold text-slate-700">Signature image URL<input type="url" value={settings.signature_image_reference ?? ''} disabled={busy} onChange={(event) => update({ signature_image_reference: event.target.value || null })} className={controlClass} placeholder="https://…" /></label>
            <label className="block text-sm font-semibold text-slate-700">Signatory name<input maxLength={160} value={settings.signatory_name ?? ''} disabled={busy} onChange={(event) => update({ signatory_name: event.target.value || null })} className={controlClass} placeholder="Name shown on certificate" /></label>
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Signatory position<input maxLength={160} value={settings.signatory_position ?? ''} disabled={busy} onChange={(event) => update({ signatory_position: event.target.value || null })} className={controlClass} placeholder="e.g. Race Director" /></label>
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Certificate message<textarea maxLength={2000} rows={4} value={settings.certificate_message ?? ''} disabled={busy} onChange={(event) => update({ certificate_message: event.target.value || null })} className={`${controlClass} min-h-24 resize-y leading-6`} placeholder="Optional message for finishers" /></label>
          </div>
        </section>

        <div className="flex justify-end border-t border-slate-200 pt-4">
          <button disabled={busy} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-wait disabled:opacity-60">{busy ? 'Saving…' : 'Save certificate settings'}</button>
        </div>
      </div>

      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Preview</p><h2 className="mt-1 text-lg font-bold text-[#071b41]">Finisher certificate</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${settings.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{settings.enabled ? 'Enabled' : 'Disabled'}</span></div>
        <div className="mt-4 rounded-xl border border-[#d8c79a] bg-[#fffdf7] p-5 text-center shadow-inner sm:p-7">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#d8c79a] text-xl font-black text-[#b08c3f]">R</div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7c3d]">{event.name}</p>
          <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-500">Certificate of</p>
          <h3 className="mt-1 text-xl font-black text-[#071b41]">{settings.certificate_title || 'Completion'}</h3>
          <p className="mt-5 border-b border-slate-300 pb-2 text-base font-semibold text-slate-700">Sample Participant Name</p>
          <p className="mt-2 text-xs text-slate-500">Finisher · {previewDate}</p>
          {settings.certificate_message && <p className="mt-4 text-xs leading-5 text-slate-600">{settings.certificate_message}</p>}
          {settings.signatory_name && <p className="mt-6 text-sm font-semibold text-slate-700">{settings.signatory_name}<span className="block text-xs font-normal text-slate-500">{settings.signatory_position}</span></p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Preview only. It does not generate a certificate or verification token.</p>
      </aside>
    </form>}
  </main>;
}
