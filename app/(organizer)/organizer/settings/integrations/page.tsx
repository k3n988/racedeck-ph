'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Values = { google_analytics_id: string; meta_pixel_id: string };
const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100';

export default function IntegrationsPage() {
  const [values, setValues] = useState<Values>({ google_analytics_id: '', meta_pixel_id: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/organizer/settings/integrations', { cache: 'no-store' }).then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Could not load integrations.');
      if (active) setValues({ google_analytics_id: body.google_analytics_id ?? '', meta_pixel_id: body.meta_pixel_id ?? '' });
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load integrations.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/organizer/settings/integrations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Integrations could not be saved.');
      setValues(body); setNotice('Integration settings saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Integrations could not be saved.'); }
    finally { setSaving(false); }
  }

  return <main className="min-h-full bg-slate-100 px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-bold text-[#101c33]">Event tracking</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Connect your organization’s public event pages to Google Analytics or Meta Pixel. These IDs are used on approved events. Visitors must opt in to optional analytics and advertising cookies before either provider loads.</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      <form onSubmit={save} className="mt-5 space-y-5">
        <label className="block text-sm font-semibold text-slate-700">Google Analytics measurement ID<input disabled={loading} value={values.google_analytics_id} onChange={e => setValues({ ...values, google_analytics_id: e.target.value.toUpperCase() })} placeholder="G-XXXXXXXXXX" autoComplete="off" className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Find this in your GA4 web stream. Measurement IDs begin with G-.</span></label>
        <label className="block text-sm font-semibold text-slate-700">Meta Pixel ID<input disabled={loading} inputMode="numeric" value={values.meta_pixel_id} onChange={e => setValues({ ...values, meta_pixel_id: e.target.value.replace(/\D/g, '') })} placeholder="123456789012345" autoComplete="off" className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Use the numeric ID from Events Manager. No access token or secret is needed.</span></label>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">Saving empty fields disconnects the providers.</p><button disabled={loading || saving} className="min-h-10 rounded-lg bg-[#0b2b5b] px-4 py-2 text-sm font-bold text-white hover:bg-[#123b78] disabled:opacity-50">{saving ? 'Saving…' : 'Save integrations'}</button></div>
      </form>
    </section>
  </div></main>;
}
