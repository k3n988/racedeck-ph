'use client';

import { useCallback, useEffect, useState } from 'react';

type Profile = {
  id: string;
  provider: string;
  account_reference: string;
  account_label: string | null;
  currency: string;
  is_default: boolean;
  is_active: boolean;
  verified_at: string | null;
};

export default function PaymentProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState('Loading payment profiles...');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/organizer/payment-profiles', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(body.error ?? 'Payment profiles could not be loaded.'); return; }
    setProfiles(body.profiles ?? []);
    setMessage('');
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(form: HTMLFormElement) {
    setBusy(true);
    const values = new FormData(form);
    const response = await fetch('/api/organizer/payment-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: values.get('provider'),
        account_label: values.get('account_label'),
        account_reference: values.get('account_reference'),
        is_default: values.get('is_default') === 'on',
      }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(body.error ?? 'Payment profile could not be saved.'); return; }
    form.reset();
    setMessage('Payment profile saved. RaceDeck will verify payout account changes.');
    await load();
  }

  async function updateProfile(profile: Profile, action: 'make_default' | 'deactivate') {
    if (action === 'deactivate' && !window.confirm(`Deactivate ${profile.provider} • ${profile.account_reference}?`)) return;
    setBusy(true);
    const response = await fetch('/api/organizer/payment-profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: profile.id, action }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? (action === 'make_default' ? 'Default payout profile updated.' : 'Payment profile deactivated.') : body.error ?? 'Payment profile could not be updated.');
    if (response.ok) await load();
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Organization settings</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900">Payment profiles</h1>
      <p className="mt-2 text-sm text-slate-600">Manage the payout accounts RaceDeck may use for your organization. Account references are masked after saving.</p>
    </header>
    {message && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{message}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Add a payment profile</h2>
      <form onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget); }} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Provider<select name="provider" required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"><option value="">Select provider</option><option>Bank transfer</option><option>GCash</option><option>Maya</option><option>Other</option></select></label>
        <label className="text-sm">Account label<input name="account_label" maxLength={120} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="e.g. Main business account" /></label>
        <label className="text-sm sm:col-span-2">Account number or reference<input name="account_reference" required minLength={4} maxLength={120} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="Enter the payout account reference" /><span className="mt-1 block text-xs text-slate-500">Only the last four characters will appear in this list.</span></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input name="is_default" type="checkbox" className="h-4 w-4 rounded border-slate-300" /> Set as default payout profile</label>
        <div className="sm:col-span-2"><button disabled={busy} className="rounded-lg bg-[#087b18] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Add profile'}</button></div>
      </form>
    </section>
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-900">Saved profiles</h2>
      {profiles.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">You do not have any payment profiles yet. Add one above to get started.</div> : profiles.map((profile) => <article key={profile.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{profile.account_label || profile.provider}</h3>{profile.is_default && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Default</span>}<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${profile.is_active ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-400'}`}>{profile.is_active ? (profile.verified_at ? 'Verified' : 'Pending verification') : 'Inactive'}</span></div><p className="mt-1 text-sm text-slate-600">{profile.provider} · {profile.account_reference} · {profile.currency}</p></div>
        <div className="flex gap-2">{profile.is_active && !profile.is_default && <button disabled={busy} onClick={() => void updateProfile(profile, 'make_default')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Make default</button>}{profile.is_active && <button disabled={busy} onClick={() => void updateProfile(profile, 'deactivate')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Deactivate</button>}</div>
      </article>)}
    </section>
  </main>;
}
