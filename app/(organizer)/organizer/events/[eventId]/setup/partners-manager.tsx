'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Handshake, Plus, Trash2 } from 'lucide-react';

type Partner = { id: string; name: string; logo_url: string | null; partner_type: string | null; display_order: number | null };
const tiers = ['Presented By', 'Official Partners', 'Supported By'] as const;

export function PartnersManager({ eventId, disabled = false }: { eventId: string; disabled?: boolean }) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [name, setName] = useState('');
  const [tier, setTier] = useState<(typeof tiers)[number]>('Official Partners');
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/organizer/events/${eventId}/partners`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Sponsors could not be loaded.');
      setPartners(body.partners ?? []);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sponsors could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  async function addPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      let logoUrl: string | null = null;
      if (logo) {
        const form = new FormData();
        form.set('file', logo);
        form.set('kind', 'sponsor_logo');
        const upload = await fetch(`/api/organizer/events/${eventId}/assets`, { method: 'POST', body: form });
        const uploadBody = await upload.json().catch(() => ({}));
        if (!upload.ok || !uploadBody.url) throw new Error(uploadBody.error ?? 'Sponsor logo could not be uploaded.');
        logoUrl = uploadBody.url;
      }
      const response = await fetch(`/api/organizer/events/${eventId}/partners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), partner_type: tier, logo_url: logoUrl }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Sponsor could not be saved.');
      setPartners((current) => [...current, body]);
      setName('');
      setLogo(null);
      const input = document.getElementById(`partner-logo-${eventId}`) as HTMLInputElement | null;
      if (input) input.value = '';
      setMessage('Sponsor saved. It will appear on the public event page.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sponsor could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function removePartner(partner: Partner) {
    if (!window.confirm(`Remove ${partner.name} from this event?`)) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${eventId}/partners/${partner.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Sponsor could not be removed.');
      setPartners((current) => current.filter((item) => item.id !== partner.id));
      setMessage('Sponsor removed from the event.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sponsor could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="partners-manager-title">
    <div className="mb-5 flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600"><Handshake size={19} aria-hidden="true" /></span>
      <div><h2 id="partners-manager-title" className="font-bold text-[#071b41]">Sponsors &amp; partners</h2><p className="mt-1 text-sm text-slate-500">Saved sponsors display automatically below the registration panel on the public event page.</p></div>
    </div>

    {message && <ToastFeedback message={String(message)} tone="auto" />}

    {loading ? <div className="h-16 animate-pulse rounded-lg bg-slate-100" aria-label="Loading sponsors" /> : partners.length ? <ul className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {partners.map((partner) => <li key={partner.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-50 p-1">{partner.logo_url ? <img src={partner.logo_url} alt={`${partner.name} logo`} className="h-full w-full object-contain" /> : <Handshake className="h-5 w-5 text-slate-400" aria-hidden="true" />}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{partner.name}</p><p className="mt-0.5 text-xs text-slate-500">{partner.partner_type ?? 'Partner'}</p></div>
        {!disabled && <button type="button" disabled={busy} onClick={() => void removePartner(partner)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" aria-label={`Remove ${partner.name}`}><Trash2 size={16} aria-hidden="true" /></button>}
      </li>)}
    </ul> : <p className="mb-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">No sponsors saved yet. Add one below to display it publicly.</p>}

    {!disabled && <form onSubmit={(event) => void addPartner(event)} className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-start">
      <label className="block text-sm font-semibold text-slate-700">Sponsor name<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Organization name" className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
      <label className="block text-sm font-semibold text-slate-700">Sponsor tier<select value={tier} onChange={(event) => setTier(event.target.value as (typeof tiers)[number])} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">{tiers.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="block text-sm font-semibold text-slate-700">Logo (optional)<input id={`partner-logo-${eventId}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} className="mt-1.5 block h-[51px] w-full text-xs font-normal file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold" /><span className="-mt-2 block text-xs font-normal text-slate-500">JPG, PNG, or WEBP up to 10 MB</span></label>
      <button type="submit" disabled={busy || loading || !name.trim()} className="sm:mt-[26px] inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} aria-hidden="true" />{busy ? 'Saving…' : 'Add sponsor'}</button>
    </form>}
  </section>;
}
