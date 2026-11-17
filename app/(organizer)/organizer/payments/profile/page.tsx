'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Banknote, Building2, Check, CircleAlert, CreditCard, Eye, EyeOff, LockKeyhole, Plus, RefreshCw } from 'lucide-react';
import { ORGANIZATION_COUNTRY_CODES } from '@/lib/organization/countries';

type Profile = {
  id: string; profile_name: string; currency: string; account_holder_name: string; notification_email: string;
  contact_phone: string; address_line1: string; address_line2: string | null; postal_code: string; country_code: string;
  city: string; state_province: string; payment_method: 'direct_deposit'; payout_frequency: 'weekly'; swift_bic: string;
  bank_account_number_last4: string; bank_name: string; bank_address: string; created_at: string;
};
type Form = Omit<Profile, 'id' | 'created_at' | 'bank_account_number_last4' | 'payment_method' | 'payout_frequency'> & { bank_account_number: string };

const blankForm: Form = { profile_name: '', currency: 'PHP', account_holder_name: '', notification_email: '', contact_phone: '', address_line1: '', address_line2: '', postal_code: '', country_code: 'PH', city: '', state_province: '', swift_bic: '', bank_account_number: '', bank_name: '', bank_address: '' };
const regions = ['Bangsamoro', 'Bicol Region', 'Cagayan Valley', 'Calabarzon', 'Caraga', 'Central Luzon', 'Central Visayas', 'Cordillera Administrative Region', 'Davao Region', 'Eastern Visayas', 'Ilocos Region', 'National Capital Region', 'Northern Mindanao', 'Soccsksargen', 'Southwestern Tagalog Region', 'Western Visayas', 'Zamboanga Peninsula'];
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const commonCountries = ['PH', 'US', 'CA', 'AU', 'NZ', 'JP', 'ID', 'VN', 'TH', 'MY'];
const countryOptions = [...new Set([...commonCountries, ...ORGANIZATION_COUNTRY_CODES])]
  .map((code) => ({ code, name: code === 'XK' ? 'Kosovo' : countryNames.of(code) ?? code }))
  .sort((a, b) => commonCountries.includes(a.code) && commonCountries.includes(b.code)
    ? commonCountries.indexOf(a.code) - commonCountries.indexOf(b.code)
    : commonCountries.includes(a.code) ? -1 : commonCountries.includes(b.code) ? 1 : a.name.localeCompare(b.name));
const currencies = [['PHP', 'PHP — Philippine peso'], ['USD', 'USD — US dollar'], ['CAD', 'CAD — Canadian dollar'], ['AUD', 'AUD — Australian dollar'], ['NZD', 'NZD — New Zealand dollar'], ['JPY', 'JPY — Japanese yen'], ['IDR', 'IDR — Indonesian rupiah'], ['VND', 'VND — Vietnamese đồng'], ['THB', 'THB — Thai baht'], ['MYR', 'MYR — Malaysian ringgit'], ['SGD', 'SGD — Singapore dollar'], ['HKD', 'HKD — Hong Kong dollar'], ['EUR', 'EUR — Euro'], ['GBP', 'GBP — British pound']];
const inputClass = 'mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-500';
const labelClass = 'block text-sm font-semibold text-slate-800';
const countryLabel = (code: string) => countryOptions.find((country) => country.code === code)?.name ?? code;

export default function PaymentProfilePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(blankForm);
  const [initialForm, setInitialForm] = useState<Form>(blankForm);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [savedLast4, setSavedLast4] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/organizer/payment-profiles', { cache: 'no-store', signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Payment profiles could not be loaded.');
      setProfiles(body.profiles ?? []);
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Payment profiles could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const sortedProfiles = useMemo(() => profiles, [profiles]);
  const setValue = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  function newProfile() {
    setEditingId(null); setForm(blankForm); setInitialForm(blankForm); setSavedLast4(''); setShowAccountNumber(false); setError(''); setNotice(''); setFormOpen(true);
  }

  function editProfile(profile: Profile) {
    setEditingId(profile.id);
    const draft: Form = { profile_name: profile.profile_name, currency: profile.currency, account_holder_name: profile.account_holder_name, notification_email: profile.notification_email, contact_phone: profile.contact_phone, address_line1: profile.address_line1, address_line2: profile.address_line2 ?? '', postal_code: profile.postal_code, country_code: profile.country_code, city: profile.city, state_province: profile.state_province, swift_bic: profile.swift_bic, bank_account_number: '', bank_name: profile.bank_name, bank_address: profile.bank_address };
    setForm(draft); setInitialForm(draft);
    setSavedLast4(profile.bank_account_number_last4); setShowAccountNumber(false); setError(''); setNotice(''); setFormOpen(true);
  }

  function backToProfiles() {
    if (busy) return;
    const changed = Object.entries(form).some(([key, value]) => value !== initialForm[key as keyof Form]);
    if (changed && !window.confirm('Discard these payment profile changes?')) return;
    setFormOpen(false); setForm(blankForm); setInitialForm(blankForm); setEditingId(null); setSavedLast4(''); setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(editingId ? `/api/organizer/payment-profiles/${editingId}` : '/api/organizer/payment-profiles', {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, bank_account_number: form.bank_account_number.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || 'Payment profile could not be saved. Review the details and try again.'); return; }
      setFormOpen(false); setForm(blankForm); setInitialForm(blankForm); setEditingId(null); setSavedLast4(''); setNotice(editingId ? 'Payment profile updated.' : 'Payment profile saved.'); await load();
    } catch { setError('Payment profile could not be saved. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    {!formOpen ? <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-[0.15em] text-orange-600">Organizer settings</p><h1 className="mt-1 text-2xl font-extrabold text-[#0b2348] sm:text-3xl">Payment profiles</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Save your organization’s payment details for future transactions. Keep a profile for each currency or account you use.</p></div>
        <button type="button" onClick={newProfile} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-100"><Plus size={17} aria-hidden="true" /> Add payment profile</button>
      </header>
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => void load()} className="font-bold underline underline-offset-2">Try again</button></div>}
      <section aria-label="Saved payment profiles" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="font-bold text-[#0b2348]">Saved profiles</h2><p className="mt-1 text-sm text-slate-500">Account numbers are protected and identified by their last four digits.</p></div><span aria-live="polite" className="text-sm text-slate-500">{loading ? 'Loading…' : `${profiles.length} ${profiles.length === 1 ? 'profile' : 'profiles'}`}</span></div>
        {loading ? <div aria-label="Loading profiles" className="space-y-3 p-5">{[0, 1].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}</div> : !sortedProfiles.length ? <div className="px-6 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-orange-600"><Banknote size={25} aria-hidden="true" /></span><h3 className="mt-4 font-bold text-[#0b2348]">No payment profiles yet</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Add an organization profile to save its contact, address, and direct deposit details.</p><button type="button" onClick={newProfile} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0b2b5b] px-4 text-sm font-bold text-white hover:bg-[#123b78]"><Plus size={15} aria-hidden="true" /> Create profile</button></div> : <ul className="divide-y divide-slate-100">{sortedProfiles.map((profile) => <li key={profile.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex min-w-0 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Building2 size={19} aria-hidden="true" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-bold text-[#0b2348]">{profile.profile_name}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{profile.currency}</span></div><p className="mt-1 text-sm text-slate-600">{profile.account_holder_name} · {profile.bank_name}</p><p className="mt-1 text-xs text-slate-500">Direct deposit · Weekly · Account ending {profile.bank_account_number_last4} · {countryLabel(profile.country_code)}</p></div></div><button type="button" onClick={() => editProfile(profile)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-orange-300 hover:bg-orange-50">Edit profile <ArrowRight size={15} aria-hidden="true" /></button></li>)}</ul>}
      </section>
      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole size={15} aria-hidden="true" className="mt-0.5 shrink-0" /> Only the organization owner can view or edit payment profiles. Bank account numbers are encrypted before storage.</p>
      <Link href="/organizer/payments" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#0b2b5b] hover:underline"><ArrowLeft size={15} aria-hidden="true" /> Back to payments</Link>
    </> : <>
      <header><button type="button" onClick={backToProfiles} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowLeft size={16} aria-hidden="true" /> Back to payment profiles</button><p className="mt-5 text-sm font-bold uppercase tracking-[0.15em] text-orange-600">Organizer settings</p><h1 className="mt-1 text-2xl font-extrabold text-[#0b2348] sm:text-3xl">{editingId ? 'Edit payment profile' : 'Add payment profile'}</h1><p className="mt-2 text-sm leading-6 text-slate-600">Enter your organization’s payment information. This profile can be used for future transactions related to your organization.</p></header>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><CircleAlert size={17} aria-hidden="true" className="mt-0.5 shrink-0" /><span>{error}</span></div>}
      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-base font-extrabold text-[#0b2348]">Profile details</h2><p className="mt-1 text-sm text-slate-500">Give this profile a name so it’s easy to recognize later.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Profile name <span className="text-orange-600">*</span><input required minLength={2} maxLength={100} value={form.profile_name} onChange={(event) => setValue('profile_name', event.target.value)} placeholder="e.g., Casey’s PHP Profile" className={inputClass} /></label><label className={labelClass}>Currency <span className="text-orange-600">*</span><select required value={form.currency} onChange={(event) => setValue('currency', event.target.value)} className={inputClass}>{currencies.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label></div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-orange-600"><Building2 size={19} aria-hidden="true" /></span><div><h2 className="text-base font-extrabold text-[#0b2348]">Payment information</h2><p className="mt-1 text-sm text-slate-500">Enter the details associated with the receiving bank account.</p></div></div>
          <div className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>Person or company name <span className="text-orange-600">*</span><input required maxLength={200} autoComplete="name" value={form.account_holder_name} onChange={(event) => setValue('account_holder_name', event.target.value)} placeholder="Name on the bank account" className={inputClass} /></label>
            <label className={labelClass}>Email address for statement notifications <span className="text-orange-600">*</span><input required type="email" maxLength={320} autoComplete="email" value={form.notification_email} onChange={(event) => setValue('notification_email', event.target.value)} placeholder="name@example.com" className={inputClass} /></label>
            <label className={labelClass}>Contact telephone number <span className="text-orange-600">*</span><input required type="tel" maxLength={50} autoComplete="tel" value={form.contact_phone} onChange={(event) => setValue('contact_phone', event.target.value)} placeholder="+63 912 345 6789" className={inputClass} /></label>
            <label className={labelClass}>Address line 1 <span className="text-orange-600">*</span><input required maxLength={240} autoComplete="address-line1" value={form.address_line1} onChange={(event) => setValue('address_line1', event.target.value)} placeholder="Street address" className={inputClass} /></label>
            <label className={labelClass}>Address line 2 <span className="font-normal text-slate-400">(optional)</span><input maxLength={240} autoComplete="address-line2" value={form.address_line2 ?? ''} onChange={(event) => setValue('address_line2', event.target.value)} placeholder="Unit, floor, building" className={inputClass} /></label>
            <label className={labelClass}>ZIP code <span className="text-orange-600">*</span><input required maxLength={32} autoComplete="postal-code" value={form.postal_code} onChange={(event) => setValue('postal_code', event.target.value)} placeholder="Postal code" className={inputClass} /></label>
            <label className={labelClass}>Country <span className="text-orange-600">*</span><select required autoComplete="country" value={form.country_code} onChange={(event) => { setValue('country_code', event.target.value); setValue('state_province', ''); }} className={inputClass}>{countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
            <label className={labelClass}>City <span className="text-orange-600">*</span><input required maxLength={120} autoComplete="address-level2" value={form.city} onChange={(event) => setValue('city', event.target.value)} placeholder="City" className={inputClass} /></label>
            <label className={labelClass}>State/province <span className="text-orange-600">*</span>{form.country_code === 'PH' ? <select required value={form.state_province} onChange={(event) => setValue('state_province', event.target.value)} className={inputClass}><option value="">Select a region</option>{regions.map((region) => <option key={region} value={region}>{region}</option>)}</select> : <input required maxLength={120} autoComplete="address-level1" value={form.state_province} onChange={(event) => setValue('state_province', event.target.value)} placeholder="State or province" className={inputClass} />}</label>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><CreditCard size={19} aria-hidden="true" /></span><div><h2 className="text-base font-extrabold text-[#0b2348]">Payment method</h2><p className="mt-1 text-sm text-slate-500">Preferred method of payment</p></div></div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50/70 p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-orange-600"><Banknote size={18} aria-hidden="true" /></span><div><p className="text-sm font-bold text-slate-900">Direct deposit</p><p className="mt-0.5 text-xs text-slate-600">Payment issued every week</p></div></div><span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-800"><Check size={13} aria-hidden="true" /> Preferred</span></div>
          <div className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <label className={labelClass}>SWIFT ID <span className="text-orange-600">*</span><input required minLength={8} maxLength={11} autoCapitalize="characters" value={form.swift_bic} onChange={(event) => setValue('swift_bic', event.target.value.toUpperCase())} placeholder="e.g., ABCDPHMM" className={inputClass} /><span className="mt-1.5 block text-xs font-normal text-slate-500">8 or 11 characters, provided by your bank.</span></label>
            <div><label htmlFor="bank_account_number" className={labelClass}>Bank account number <span className="text-orange-600">*</span></label><span className="relative mt-1.5 block"><input id="bank_account_number" required={!editingId} minLength={4} maxLength={34} autoComplete="off" type={showAccountNumber ? 'text' : 'password'} value={form.bank_account_number} onChange={(event) => setValue('bank_account_number', event.target.value)} placeholder={editingId ? `Saved account ending in ${savedLast4}; enter to replace` : 'Enter bank account number'} className={`${inputClass} mt-0 pr-12`} /><button type="button" onClick={() => setShowAccountNumber((visible) => !visible)} aria-label={showAccountNumber ? 'Hide bank account number' : 'Show bank account number'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">{showAccountNumber ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></span><span className="mt-1.5 block text-xs font-normal text-slate-500">{editingId ? 'Leave blank to keep the saved account number.' : 'Encrypted before it is saved.'}</span></div>
            <label className={labelClass}>Bank name <span className="text-orange-600">*</span><input required maxLength={160} value={form.bank_name} onChange={(event) => setValue('bank_name', event.target.value)} placeholder="Bank name" className={inputClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}>Bank address <span className="text-orange-600">*</span><textarea required maxLength={500} rows={3} value={form.bank_address} onChange={(event) => setValue('bank_address', event.target.value)} placeholder="Branch address" className={`${inputClass} min-h-24 resize-y py-3`} /></label>
          </div>
        </section>
        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"><div className="mx-auto flex max-w-5xl flex-col-reverse justify-between gap-3 sm:flex-row"><button type="button" disabled={busy} onClick={backToProfiles} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Back</button><button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0b2b5b] px-6 text-sm font-extrabold text-white shadow-sm hover:bg-[#123b78] disabled:cursor-wait disabled:opacity-60">{busy ? <><RefreshCw size={16} className="animate-spin" aria-hidden="true" /> Saving…</> : <><Check size={16} aria-hidden="true" /> Save and exit</>}</button></div></div>
      </form>
    </>}
  </main>;
}
