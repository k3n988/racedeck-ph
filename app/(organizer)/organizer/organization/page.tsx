'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ORGANIZATION_COUNTRY_CODES, ORGANIZATION_TIMEZONES } from '@/lib/organization/countries';

type OrganizationForm = {
  name: string;
  logo_url: string;
  website: string;
  facebook_url: string;
  is_nonprofit: boolean;
  address: string;
  country_code: string;
  state_province: string;
  city: string;
  postal_code: string;
  timezone: string;
  contact_person: string;
  contact_phone: string;
  contact_phone_extension: string;
  contact_email: string;
};

const emptyForm: OrganizationForm = {
  name: '', logo_url: '', website: '', facebook_url: '', is_nonprofit: false, address: '', country_code: 'PH',
  state_province: '', city: '', postal_code: '', timezone: 'Asia/Manila', contact_person: '',
  contact_phone: '', contact_phone_extension: '', contact_email: '',
};

const PH_REGIONS = [
  'National Capital Region', 'Cordillera Administrative Region', 'Ilocos Region', 'Cagayan Valley',
  'Central Luzon', 'Calabarzon', 'Southwestern Tagalog Region', 'Bicol Region', 'Western Visayas',
  'Central Visayas', 'Eastern Visayas', 'Zamboanga Peninsula', 'Northern Mindanao', 'Davao Region',
  'Soccsksargen', 'Caraga', 'Bangsamoro',
];

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countryLabel = (code: string) => code === 'XK' ? 'Kosovo' : countryNames.of(code) ?? code;
const controlClass = 'mt-1.5 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100';
const labelClass = 'block text-sm font-semibold text-slate-800';

export default function OrganizationPage() {
  const [form, setForm] = useState<OrganizationForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/organizer/organization', { signal, cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Organization details could not be loaded.');
      setForm({
        name: body.name ?? '', logo_url: body.logo_url ?? '', website: body.website ?? '', facebook_url: body.facebook_url ?? '',
        is_nonprofit: Boolean(body.is_nonprofit), address: body.address ?? '', country_code: body.country_code ?? 'PH',
        state_province: body.state_province ?? '', city: body.city ?? '', postal_code: body.postal_code ?? '',
        timezone: body.timezone ?? 'Asia/Manila', contact_person: body.contact_person ?? '',
        contact_phone: body.contact_phone ?? '', contact_phone_extension: body.contact_phone_extension ?? '',
        contact_email: body.contact_email ?? '',
      });
      setLoaded(true);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'Organization details could not be loaded.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const set = <K extends keyof OrganizationForm>(key: K, value: OrganizationForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setNotice('');
  };

  const missingRequired = useMemo(() => {
    const required: Array<keyof OrganizationForm> = ['name', 'address', 'country_code', 'city', 'postal_code', 'timezone', 'contact_person', 'contact_phone', 'contact_email'];
    return required.some(key => !String(form[key]).trim());
  }, [form]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/organizer/organization', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, logo_url: form.logo_url || null, website: form.website || null, facebook_url: form.facebook_url || null,
          state_province: form.state_province || null, contact_phone_extension: form.contact_phone_extension || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Organization details could not be saved.');
      setNotice('Organization details saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Organization details could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/gif', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError('Choose a GIF, JPG, or PNG image.');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be 5 MB or smaller.');
      input.value = '';
      return;
    }
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const data = new FormData();
      data.append('file', file);
      const response = await fetch('/api/organizer/organization/logo', { method: 'POST', body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Logo upload failed.');
      set('logo_url', body.logo_url);
      setNotice('Logo uploaded. Save your organization details to finish.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Logo upload failed.');
    } finally {
      input.value = '';
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-orange-600">Organizer settings</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#0b2348]">Organization details</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Manage the organization profile and primary contact details used across RaceDeck.</p>
        </div>
        <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">Organization profile</span>
      </header>

      {notice && <ToastFeedback message={String(notice)} tone="success"><p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</p></ToastFeedback>}

      {loading ? <div aria-label="Loading organization details" className="space-y-4"><div className="h-56 animate-pulse rounded-2xl bg-slate-200"/><div className="h-64 animate-pulse rounded-2xl bg-slate-200"/></div> : !loaded ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-800"><span>{error || 'Organization details could not be loaded.'}</span><button type="button" onClick={() => void load()} className="rounded-lg border border-red-300 bg-white px-4 py-2 font-bold">Try again</button></div>
      ) : (
        <form onSubmit={save} className="space-y-5">
          {error && <ToastFeedback message={String(error)} tone="error"><p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p></ToastFeedback>}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-[#0b2348]">Organization profile</h2>
              <p className="mt-1 text-sm text-slate-600">Your public name, logo, and organization type.</p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label className={labelClass}>Organization name <span className="text-orange-600">*</span>
                <input required maxLength={160} value={form.name} onChange={e => set('name', e.target.value)} className={controlClass} autoComplete="organization" />
              </label>
              <label className={labelClass}>Website link
                <input type="url" value={form.website} onChange={e => set('website', e.target.value)} className={controlClass} placeholder="https://example.org" autoComplete="url" />
              </label>
              <label className={labelClass}>Facebook link
                <input type="url" value={form.facebook_url} onChange={e => set('facebook_url', e.target.value)} className={controlClass} placeholder="https://facebook.com/yourpage" autoComplete="url" />
              </label>
              <div className="sm:col-span-2">
                <span className={labelClass}>Organization logo</span>
                <div className="mt-2 flex flex-col gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center">
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {form.logo_url ? <Image src={form.logo_url} alt="Organization logo preview" fill sizes="80px" unoptimized className="object-contain" /> : <span className="text-xs font-semibold text-slate-400">No logo</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-[#0b2348] px-4 text-sm font-bold text-white transition hover:bg-[#143765] focus-within:ring-4 focus-within:ring-orange-100">
                      {uploading ? 'Uploading…' : form.logo_url ? 'Change logo' : 'Upload logo'}
                      <input type="file" accept=".gif,.jpg,.jpeg,.png,image/gif,image/jpeg,image/png" onChange={uploadLogo} disabled={uploading} className="sr-only" />
                    </label>
                    <p className="mt-2 text-xs text-slate-600">GIF, JPG, or PNG · up to 5 MB. A logo is optional.</p>
                  </div>
                </div>
              </div>
              <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                <input type="checkbox" checked={form.is_nonprofit} onChange={e => set('is_nonprofit', e.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-600" />
                <span><span className="block text-sm font-semibold text-slate-800">Non-profit / fundraising organization</span><span className="mt-1 block text-sm text-slate-600">I am a non-profit that fundraises through event partnerships.</span></span>
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-[#0b2348]">Organization address</h2>
              <p className="mt-1 text-sm text-slate-600">Used for organization records and event administration.</p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label className={`${labelClass} sm:col-span-2`}>Address <span className="text-orange-600">*</span>
                <input required maxLength={1000} value={form.address} onChange={e => set('address', e.target.value)} className={controlClass} placeholder="Street address, building, or location name" autoComplete="street-address" />
              </label>
              <label className={labelClass}>Country <span className="text-orange-600">*</span>
                <select required value={form.country_code} onChange={e => { set('country_code', e.target.value); if (e.target.value !== 'PH') set('state_province', ''); }} className={controlClass} autoComplete="country">
                  <option value="">Select country</option>{ORGANIZATION_COUNTRY_CODES.map(code => <option key={code} value={code}>{countryLabel(code)}</option>)}
                </select>
              </label>
              <label className={labelClass}>{form.country_code === 'PH' ? 'State / province' : 'State / province / region'}
                {form.country_code === 'PH' ? <select value={form.state_province} onChange={e => set('state_province', e.target.value)} className={controlClass}><option value="">Select region</option>{PH_REGIONS.map(region => <option key={region}>{region}</option>)}</select> : <input value={form.state_province} onChange={e => set('state_province', e.target.value)} className={controlClass} autoComplete="address-level1" />}
              </label>
              <label className={labelClass}>City <span className="text-orange-600">*</span>
                <input required maxLength={120} value={form.city} onChange={e => set('city', e.target.value)} className={controlClass} autoComplete="address-level2" />
              </label>
              <label className={labelClass}>ZIP / postal code <span className="text-orange-600">*</span>
                <input required maxLength={32} value={form.postal_code} onChange={e => set('postal_code', e.target.value)} className={controlClass} autoComplete="postal-code" />
              </label>
              <label className={labelClass}>Time zone <span className="text-orange-600">*</span>
                <select required value={form.timezone} onChange={e => set('timezone', e.target.value)} className={controlClass}>
                  {!ORGANIZATION_TIMEZONES.includes(form.timezone as typeof ORGANIZATION_TIMEZONES[number]) && form.timezone && <option value={form.timezone}>{form.timezone}</option>}
                  {ORGANIZATION_TIMEZONES.map(zone => <option key={zone} value={zone}>{zone}{zone === 'Asia/Manila' ? ' (UTC+8)' : ''}</option>)}
                </select>
                <span className="mt-1.5 block text-xs font-normal text-slate-500">Sets the time zone used for organization event dates and timestamps.</span>
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-[#0b2348]">Organization point of contact</h2>
              <p className="mt-1 text-sm text-slate-600">Main contact for feature updates, important announcements, and KYC requirements.</p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label className={labelClass}>Full name <span className="text-orange-600">*</span>
                <input required maxLength={160} value={form.contact_person} onChange={e => set('contact_person', e.target.value)} className={controlClass} autoComplete="name" />
              </label>
              <label className={labelClass}>Email <span className="text-orange-600">*</span>
                <input type="email" required maxLength={320} value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className={controlClass} autoComplete="email" />
              </label>
              <label className={labelClass}>Phone number <span className="text-orange-600">*</span>
                <input type="tel" required maxLength={50} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className={controlClass} placeholder="+63 912 345 6789" autoComplete="tel" />
              </label>
              <label className={labelClass}>Ext
                <input value={form.contact_phone_extension} onChange={e => set('contact_phone_extension', e.target.value)} className={controlClass} maxLength={12} inputMode="numeric" placeholder="Optional" />
              </label>
            </div>
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#f4f6fa]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <p className="text-xs text-slate-600"><span className="text-orange-600">*</span> Required fields</p>
            <button type="submit" disabled={saving || uploading || missingRequired} className="min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Saving details…' : 'Save organization details'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
