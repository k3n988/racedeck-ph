'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Banknote, Check, CircleAlert, CreditCard, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { ORGANIZATION_COUNTRY_CODES } from '@/lib/organization/countries';

type Profile = {
  id: string;
  provider: string;
  account_reference: string;
  account_label: string | null;
  bank_name: string | null;
  currency: string;
  is_default: boolean;
  is_active: boolean;
  verified_at: string | null;
};

type ProfileForm = {
  account_label: string;
  account_holder_name: string;
  contact_phone: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  country_code: string;
  city: string;
  state_province: string;
  swift_bic: string;
  account_reference: string;
  bank_name: string;
  bank_address: string;
  is_default: boolean;
};

const initialForm: ProfileForm = {
  account_label: '', account_holder_name: '', contact_phone: '', address_line1: '', address_line2: '',
  postal_code: '', country_code: 'PH', city: '', state_province: '', swift_bic: '', account_reference: '',
  bank_name: '', bank_address: '', is_default: true,
};

const PH_REGIONS = [
  'National Capital Region', 'Cordillera Administrative Region', 'Ilocos Region', 'Cagayan Valley',
  'Central Luzon', 'Calabarzon', 'Southwestern Tagalog Region', 'Bicol Region', 'Western Visayas',
  'Central Visayas', 'Eastern Visayas', 'Zamboanga Peninsula', 'Northern Mindanao', 'Davao Region',
  'Soccsksargen', 'Caraga', 'Bangsamoro',
];
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countryLabel = (code: string) => code === 'XK' ? 'Kosovo' : countryNames.of(code) ?? code;
const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100';
const labelClass = 'block text-sm font-semibold text-slate-700';

export default function PaymentProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState(initialForm);
  const [emails, setEmails] = useState(['']);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/organizer/payment-profiles', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Payment profiles could not be loaded.');
      setProfiles(body.profiles ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Payment profiles could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setError('');
    setNotice('');
  }

  function updateEmail(index: number, value: string) {
    setEmails(current => current.map((email, i) => i === index ? value : email));
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/organizer/payment-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'Bank transfer',
          account_label: form.account_label,
          account_holder_name: form.account_holder_name,
          notification_emails: emails.map(email => email.trim()).filter(Boolean),
          contact_phone: form.contact_phone,
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          postal_code: form.postal_code,
          country_code: form.country_code,
          city: form.city,
          state_province: form.state_province,
          swift_bic: form.swift_bic,
          account_reference: form.account_reference,
          bank_name: form.bank_name,
          bank_address: form.bank_address,
          currency: 'PHP',
          is_default: form.is_default || profiles.length === 0,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Payment profile could not be saved.');
      setForm({ ...initialForm, is_default: false });
      setEmails(['']);
      setNotice('Payout profile saved. Bank account details are masked in this list.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Payment profile could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function updateProfile(profile: Profile, action: 'make_default' | 'deactivate') {
    if (action === 'deactivate' && !window.confirm(`Deactivate “${profile.account_label || profile.provider}”?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/organizer/payment-profiles', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profile.id, action }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Payment profile could not be updated.');
      setNotice(action === 'make_default' ? 'Default payout profile updated.' : 'Payout profile deactivated.');
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Payment profile could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-orange-600">Organizer settings</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#0b2348]">Payment profiles</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Set the bank account RaceDeck should use for organization payouts. Your full account number is never shown after saving.</p>
        </div>
        <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">PHP payouts</span>
      </header>

      {(error || notice) && <div role={error ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
        {error ? <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true"/> : <Check size={18} className="mt-0.5 shrink-0" aria-hidden="true"/>}<span>{error || notice}</span>
      </div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-4 border-b border-slate-200 px-5 py-5 sm:px-7">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600"><Banknote size={23} aria-hidden="true"/></span>
          <div><h2 className="text-xl font-bold text-[#0b2348]">Create payment profile</h2><p className="mt-1 text-sm text-slate-600">Add the account holder, payout contact, and bank details for your organization.</p></div>
        </div>
        <form onSubmit={save} className="space-y-7 p-5 sm:p-7">
          <section className="space-y-4">
            <div><h3 className="font-bold text-[#0b2348]">Profile details</h3><p className="mt-1 text-xs text-slate-500">Give this payout destination a name your team will recognize.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Profile name <span className="text-orange-600">*</span>
                <input required maxLength={120} value={form.account_label} onChange={e => updateField('account_label', e.target.value)} className={inputClass} placeholder="e.g. RaceDeck main account" autoComplete="off"/>
              </label>
              <label className={labelClass}>Currency
                <div className={`${inputClass} flex items-center justify-between bg-slate-100 text-slate-600`}><span>🇵🇭 &nbsp; PHP — Philippine peso</span><span className="text-xs font-semibold">Fixed</span></div>
              </label>
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-200 pt-6">
            <div><h3 className="font-bold text-[#0b2348]">Payment contact</h3><p className="mt-1 text-xs text-slate-500">Details used for payout notices and account verification.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Person or company name <span className="text-orange-600">*</span>
                <input required maxLength={160} value={form.account_holder_name} onChange={e => updateField('account_holder_name', e.target.value)} className={inputClass} autoComplete="name"/>
              </label>
              <label className={labelClass}>Contact telephone number <span className="text-orange-600">*</span>
                <input type="tel" required maxLength={50} value={form.contact_phone} onChange={e => updateField('contact_phone', e.target.value)} className={inputClass} placeholder="+63 912 345 6789" autoComplete="tel"/>
              </label>
              <div className="sm:col-span-2">
                <span className={labelClass}>Email address for payout notifications <span className="text-orange-600">*</span></span>
                <div className="mt-2 space-y-2">
                  {emails.map((email, index) => <div key={index} className="flex gap-2">
                    <input type="email" required={index === 0} value={email} onChange={e => updateEmail(index, e.target.value)} className={`${inputClass} mt-0`} placeholder="name@example.com" autoComplete="email" aria-label={`Notification email ${index + 1}`}/>
                    {emails.length > 1 && <button type="button" onClick={() => setEmails(current => current.filter((_, i) => i !== index))} aria-label={`Remove email ${index + 1}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-700"><Trash2 size={17}/></button>}
                  </div>)}
                  <button type="button" onClick={() => setEmails(current => [...current, ''])} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-bold text-orange-700 hover:bg-orange-100"><Plus size={16}/> Add email</button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-200 pt-6">
            <div><h3 className="font-bold text-[#0b2348]">Billing address</h3><p className="mt-1 text-xs text-slate-500">Use the address associated with the account holder.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`${labelClass} sm:col-span-2`}>Address line 1 <span className="text-orange-600">*</span>
                <input required maxLength={240} value={form.address_line1} onChange={e => updateField('address_line1', e.target.value)} className={inputClass} autoComplete="address-line1"/>
              </label>
              <label className={`${labelClass} sm:col-span-2`}>Address line 2
                <input maxLength={240} value={form.address_line2} onChange={e => updateField('address_line2', e.target.value)} className={inputClass} autoComplete="address-line2"/>
              </label>
              <label className={labelClass}>ZIP / postal code <span className="text-orange-600">*</span>
                <input required maxLength={32} value={form.postal_code} onChange={e => updateField('postal_code', e.target.value)} className={inputClass} autoComplete="postal-code"/>
              </label>
              <label className={labelClass}>Country <span className="text-orange-600">*</span>
                <select required value={form.country_code} onChange={e => updateField('country_code', e.target.value)} className={inputClass} autoComplete="country-name">{ORGANIZATION_COUNTRY_CODES.map(code => <option key={code} value={code}>{countryLabel(code)}</option>)}</select>
              </label>
              <label className={labelClass}>City <span className="text-orange-600">*</span>
                <input required maxLength={120} value={form.city} onChange={e => updateField('city', e.target.value)} className={inputClass} autoComplete="address-level2"/>
              </label>
              <label className={labelClass}>State / province <span className="text-orange-600">*</span>
                {form.country_code === 'PH' ? <select required value={form.state_province} onChange={e => updateField('state_province', e.target.value)} className={inputClass}><option value="">Select region</option>{PH_REGIONS.map(region => <option key={region}>{region}</option>)}</select> : <input required maxLength={120} value={form.state_province} onChange={e => updateField('state_province', e.target.value)} className={inputClass} autoComplete="address-level1"/>}
              </label>
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-200 pt-6">
            <div><h3 className="font-bold text-[#0b2348]">Payment method</h3><p className="mt-1 text-xs text-slate-500">Payouts are sent by direct bank deposit.</p></div>
            <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#0b2348]"><CreditCard size={17} className="text-orange-600" aria-hidden="true"/>Direct deposit</p>
              <p className="mt-1 pl-6 text-xs text-slate-600">RaceDeck payout transfers are processed to the bank account below.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>SWIFT / BIC <span className="text-orange-600">*</span>
                <input required minLength={8} maxLength={11} pattern="[A-Za-z0-9]{8}([A-Za-z0-9]{3})?" value={form.swift_bic} onChange={e => updateField('swift_bic', e.target.value.toUpperCase())} className={inputClass} placeholder="8 or 11 characters" autoComplete="off"/>
                <span className="mt-1 block text-xs font-normal text-slate-500">Your bank can provide its SWIFT / BIC code.</span>
              </label>
              <label className={labelClass}>Bank account number <span className="text-orange-600">*</span>
                <input required minLength={4} maxLength={120} value={form.account_reference} onChange={e => updateField('account_reference', e.target.value)} className={inputClass} autoComplete="off" inputMode="numeric"/>
                <span className="mt-1 block text-xs font-normal text-slate-500">Used for payout processing; only the last four digits appear in the saved profile list.</span>
              </label>
              <label className={labelClass}>Bank name <span className="text-orange-600">*</span>
                <input required maxLength={160} value={form.bank_name} onChange={e => updateField('bank_name', e.target.value)} className={inputClass} autoComplete="organization"/>
              </label>
              <label className={labelClass}>Bank address <span className="text-orange-600">*</span>
                <input required maxLength={500} value={form.bank_address} onChange={e => updateField('bank_address', e.target.value)} className={inputClass} placeholder="Branch address"/>
              </label>
            </div>
          </section>

          <section className="flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={form.is_default} onChange={e => updateField('is_default', e.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-600"/>
              <span><span className="block text-sm font-semibold text-slate-800">Set as default payout profile</span><span className="mt-0.5 block text-xs text-slate-500">RaceDeck will use this profile for future payouts.</span></span>
            </label>
            <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-bold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:opacity-60">
              <ShieldCheck size={17} aria-hidden="true"/>{busy ? 'Saving profile…' : 'Save payment profile'}
            </button>
          </section>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><h2 className="text-lg font-bold text-[#0b2348]">Saved payout profiles</h2><p className="mt-1 text-sm text-slate-600">Manage active bank destinations for your organization.</p></div>
          <span className="text-sm font-semibold text-slate-500">{loading ? 'Loading…' : `${profiles.length} ${profiles.length === 1 ? 'profile' : 'profiles'}`}</span>
        </div>
        {loading ? <div className="space-y-3 p-5"><div className="h-16 animate-pulse rounded-xl bg-slate-100"/><div className="h-16 animate-pulse rounded-xl bg-slate-100"/></div> : profiles.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-orange-50 text-orange-600"><Banknote size={24} aria-hidden="true"/></span>
            <h3 className="mt-4 font-bold text-[#0b2348]">No payout profiles yet</h3>
            <p className="mt-1 max-w-md text-sm text-slate-600">Create a payment profile above to set where your organization receives its payouts.</p>
          </div>
        ) : <div className="divide-y divide-slate-200">{profiles.map(profile => <article key={profile.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#0b2348]"><Banknote size={20} aria-hidden="true"/></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#0b2348]">{profile.account_label || profile.provider}</h3>{profile.is_default && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Default</span>}<span className={`rounded-full px-2.5 py-1 text-xs font-bold ${profile.is_active ? profile.verified_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{profile.is_active ? profile.verified_at ? 'Verified' : 'Pending verification' : 'Inactive'}</span></div>
              <p className="mt-1 text-sm text-slate-600">{profile.bank_name || profile.provider} <span aria-hidden="true">·</span> {profile.account_reference} <span aria-hidden="true">·</span> {profile.currency}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {profile.is_active && !profile.is_default && <button type="button" disabled={busy} onClick={() => void updateProfile(profile, 'make_default')} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-bold text-[#0b2348] hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50">Make default</button>}
            {profile.is_active && <button type="button" disabled={busy} onClick={() => void updateProfile(profile, 'deactivate')} className="min-h-9 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Deactivate</button>}
          </div>
        </article>)}</div>}
      </section>
    </main>
  );
}
