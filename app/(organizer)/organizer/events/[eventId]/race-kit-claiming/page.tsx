'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { FormEvent, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const controlClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export default function RaceKitClaimingPage({ params }: { params: { eventId: string } }) {
  const [qrValue, setQrValue] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [participantQuery, setParticipantQuery] = useState('');
  const [view, setView] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [lookupMethod, setLookupMethod] = useState<'qr_scan' | 'manual_lookup'>('manual_lookup');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup(body: Record<string, unknown>) {
    setBusy(true);
    setMessage('');
    const method = 'qr_value' in body ? 'qr_scan' : 'manual_lookup';
    setLookupMethod(method);
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-claiming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lookup', ...body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Registration lookup failed.');
      if (Array.isArray(data.matches)) {
        setMatches(data.matches);
        setView(null);
        if (data.matches.length === 0) setMessage('No matching registrations were found.');
        return;
      }
      setMatches([]);
      setView(data);
    } catch (error) {
      setMatches([]);
      setView(null);
      setMessage(error instanceof Error ? error.message : 'Registration lookup failed.');
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (!view?.registration?.id || !view.claim_allowed || busy) return;
    if (!window.confirm('Mark this participant’s race kit as claimed?')) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/race-kit-claiming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim',
          registration_id: view.registration.id,
          claim_method: lookupMethod,
          qr_value: lookupMethod === 'qr_scan' ? qrValue : undefined,
          scan_reference: lookupMethod === 'qr_scan' ? qrValue : view.registration.registration_number,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Race kit could not be marked as claimed.');
      setView({ ...data, claim: data.claim, claim_allowed: false });
      setMessage('Race kit marked as claimed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Race kit could not be marked as claimed.');
    } finally {
      setBusy(false);
    }
  }

  const registration = view?.registration;
  const isError = /failed|could not/i.test(message);

  return <main className="mx-auto max-w-6xl space-y-6 bg-[#f4f6fa] p-4 sm:p-6 lg:p-8">
    <header className="border-b border-slate-200 pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event operations</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Race Kit Claiming</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Find a confirmed registration, verify its kit details, and record when the participant collects it.</p>
    </header>

    {message && <ToastFeedback message={String(message)} tone="auto">{isError ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{message}</span><button type="button" onClick={() => { if (lookupMethod === 'qr_scan' && qrValue) void lookup({ qr_value: qrValue }); else if (registrationId) void lookup({ registration_id: registrationId }); else if (participantQuery.trim().length >= 2) void lookup({ participant_query: participantQuery.trim() }); }} className="shrink-0 font-semibold underline underline-offset-2">Retry lookup</button></div> : undefined}</ToastFeedback>}

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4"><h2 className="text-lg font-bold text-[#071b41]">Scan registration QR</h2><p className="mt-1 text-sm leading-5 text-slate-600">Scan the participant’s registration QR code, or paste its value below.</p></div>
        <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void lookup({ qr_value: qrValue.trim() }); }} className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">QR value<textarea required value={qrValue} disabled={busy} onChange={(event) => setQrValue(event.target.value)} rows={4} placeholder="Scan or paste registration QR value" className={`${controlClass} min-h-28 resize-y font-mono text-xs`} /></label>
          <button type="submit" disabled={busy || !qrValue.trim()} className="min-h-11 w-full rounded-xl bg-[#0b2b5b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#123b78] disabled:cursor-not-allowed disabled:opacity-50">{busy && lookupMethod === 'qr_scan' ? 'Checking QR…' : 'Look up QR registration'}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4"><h2 className="text-lg font-bold text-[#071b41]">Manual lookup</h2><p className="mt-1 text-sm leading-5 text-slate-600">Use a registration number or search by a participant’s name.</p></div>
        <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void lookup({ registration_id: registrationId.trim() }); }} className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">Registration ID<input required value={registrationId} disabled={busy} onChange={(event) => setRegistrationId(event.target.value)} placeholder="Paste registration ID" className={controlClass} /></label>
          <button type="submit" disabled={busy || !registrationId.trim()} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-[#0b2b5b] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Look up registration</button>
        </form>
        <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void lookup({ participant_query: participantQuery.trim() }); }} className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
          <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">Participant name or registration number<input minLength={2} value={participantQuery} disabled={busy} onChange={(event) => setParticipantQuery(event.target.value)} placeholder="Search participant" className={controlClass} /></label>
          <button type="submit" disabled={busy || participantQuery.trim().length < 2} className="min-h-11 self-end rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Search</button>
        </form>
      </section>
    </div>

    {matches.length > 0 && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-[#071b41]">Matching registrations</h2><p className="mt-1 text-sm text-slate-600">Select the participant whose kit is being collected.</p></div>
      <ul className="divide-y divide-slate-100">{matches.map((match) => <li key={match.id}><button type="button" disabled={busy} onClick={() => void lookup({ registration_id: match.id })} className="flex min-h-16 w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left transition hover:bg-slate-50 disabled:opacity-50"><span><span className="block font-semibold text-[#071b41]">{match.first_name} {match.last_name}</span><span className="mt-1 block text-xs text-slate-500">{match.registration_number} · {Array.isArray(match.race_categories) ? match.race_categories[0]?.name : match.race_categories?.name}</span></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{String(match.status).replaceAll('_', ' ')}</span></button></li>)}</ul>
    </section>}

    {registration && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-orange-600">Participant registration</p><h2 className="mt-1 break-words text-xl font-extrabold text-[#071b41]">{registration.first_name} {registration.last_name}</h2><p className="mt-1 text-sm text-slate-600">Registration #{registration.registration_number}</p></div>
        <div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{String(registration.status).replaceAll('_', ' ')}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Payment: {view.payment?.status ?? '—'}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${view.claim ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{view.claim ? 'Kit claimed' : 'Not claimed'}</span></div>
      </header>
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
        <div className="space-y-3"><h3 className="font-bold text-[#071b41]">Race details</h3><dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</dt><dd className="mt-1 font-semibold text-slate-800">{view.category?.name ?? '—'}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bib</dt><dd className="mt-1 font-semibold text-slate-800">{view.bib?.bib_code ?? 'Unassigned'}</dd></div></dl>{view.claim && <p className="text-xs leading-5 text-slate-500">Claimed {new Date(view.claim.claimed_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>}</div>
        <div><h3 className="font-bold text-[#071b41]">Kit inclusions</h3>{view.kit ? <div className="mt-3 rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">{view.kit.name}</p><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{(view.kit.race_kit_items ?? []).filter((item: any) => item.is_active).sort((a: any, b: any) => a.display_order - b.display_order).map((item: any) => <li key={item.id}>{item.item_name} × {item.quantity}</li>)}</ul></div> : <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No active kit configuration for this participant.</p>}</div>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-sm text-slate-600">Check the kit contents with the participant before recording collection.</p><button type="button" disabled={busy || !view.claim_allowed} onClick={() => void claim()} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : view.claim ? 'Already claimed' : 'Mark kit as claimed'}</button></div>
    </section>}
  </main>;
}
