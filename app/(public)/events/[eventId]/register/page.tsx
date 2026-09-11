'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Option = { id: string; label: string; value: string; display_order: number };
type Field = { id: string; label: string; field_type: 'short_text' | 'long_text' | 'dropdown' | 'radio' | 'checkbox' | 'yes_no'; is_required: boolean; event_registration_field_options: Option[] };
type Category = { id: string; name: string; registration_fee: number; registration_availability: string };
type RegistrationInfo = { event: { id: string; name: string; event_date: string; venue: string | null; address: string | null; registration_closes_at: string | null }; categories: Category[]; fields: Field[]; waiver: { id: string; title: string; version: number; content: string | null } | null };

const peso = (amount: number) => `PHP ${Number(amount).toFixed(2)}`;

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
  const options = [...(field.event_registration_field_options ?? [])].sort((a, b) => a.display_order - b.display_order);
  if (field.field_type === 'long_text') return <textarea required={field.is_required} value={value} onChange={event => onChange(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />;
  if (field.field_type === 'dropdown' || field.field_type === 'yes_no') return <select required={field.is_required} value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Select an option</option>{field.field_type === 'yes_no' ? <><option value="yes">Yes</option><option value="no">No</option></> : options.map(option => <option key={option.id} value={option.value}>{option.label}</option>)}</select>;
  if (field.field_type === 'radio') return <div className="mt-2 space-y-2">{options.map(option => <label key={option.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input required={field.is_required} type="radio" name={field.id} value={option.value} checked={value === option.value} onChange={event => onChange(event.target.value)} />{option.label}</label>)}</div>;
  if (field.field_type === 'checkbox') return <label className="mt-2 flex items-center gap-2 text-sm"><input required={field.is_required} type="checkbox" checked={value === 'yes'} onChange={event => onChange(event.target.checked ? 'yes' : '')} />{options[0]?.label ?? 'Yes'}</label>;
  return <input required={field.is_required} value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />;
}

export default function RegisterPage({ params }: { params: { eventId: string } }) {
  const [data, setData] = useState<RegistrationInfo | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [acceptWaiver, setAcceptWaiver] = useState(false);
  const [message, setMessage] = useState('Loading registration details...');
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const idempotencyKey = useRef<string>('');

  useEffect(() => { idempotencyKey.current = crypto.randomUUID(); const supabase = createClient(); void Promise.all([supabase.auth.getUser().then(({ data }) => setAuthenticated(Boolean(data.user))), fetch(`/api/events/${params.eventId}/registration-info`).then(async response => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? 'Registration details could not be loaded'); setData(body as RegistrationInfo); setCategoryId(body.categories[0]?.id ?? ''); })]).then(() => setMessage('')).catch(error => setMessage(error instanceof Error ? error.message : 'Registration details could not be loaded')); }, [params.eventId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !categoryId || busy) return;
    if (authenticated === false) { window.location.assign(`/login?next=${encodeURIComponent(`/events/${params.eventId}/register`)}`); return; }
    if (authenticated === null) return;
    setBusy(true); setMessage('Reserving your slot and preparing secure checkout...');
    const response = await fetch(`/api/events/${params.eventId}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category_id: categoryId, answers, promo_code: promoCode.trim() || undefined, accept_waiver: acceptWaiver, idempotency_key: idempotencyKey.current }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(body.error ?? 'Registration could not be started. Please try again.'); return; }
    if (body.checkout_url) { window.location.assign(body.checkout_url); return; }
    setMessage('Your payment is pending. Open My Races to continue checkout.');
  }

  if (!data) return <main className="mx-auto max-w-3xl p-6"><Link href={`/events/${params.eventId}`} className="text-sm font-semibold text-orange-600">← Back to event</Link><p role="status" className="mt-6 rounded-xl border border-slate-200 p-5 text-sm text-slate-600">{message}</p></main>;
  const selectedCategory = data.categories.find(category => category.id === categoryId);
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><Link href={`/events/${params.eventId}`} className="text-sm font-semibold text-orange-600 hover:text-orange-700">← Back to event details</Link><div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><section><header><p className="text-sm font-semibold uppercase tracking-[0.15em] text-orange-600">Secure race registration</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Register for {data.event.name}</h1><p className="mt-2 text-slate-600">{data.event.event_date} • {data.event.venue ?? data.event.address ?? 'Venue to be announced'}</p></header><form onSubmit={submit} className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><section><h2 className="text-xl font-bold text-slate-900">1. Select your category</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{data.categories.map(category => <label key={category.id} className={`cursor-pointer rounded-xl border p-4 transition ${categoryId === category.id ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 hover:border-orange-300'}`}><input className="sr-only" type="radio" name="category" value={category.id} checked={categoryId === category.id} onChange={() => setCategoryId(category.id)} /><span className="block font-bold text-slate-900">{category.name}</span><span className="mt-1 block text-sm text-slate-600">{peso(category.registration_fee)}</span></label>)}</div></section><section><h2 className="text-xl font-bold text-slate-900">2. Registration details</h2><p className="mt-1 text-sm text-slate-600">Your RaceDeck profile supplies the core participant details. Complete the event-specific fields below.</p><div className="mt-4 space-y-4">{data.fields.map(field => <label key={field.id} className="block text-sm font-semibold text-slate-800">{field.label}{field.is_required && <span className="text-orange-600"> *</span>}<FieldInput field={field} value={answers[field.id] ?? ''} onChange={value => setAnswers(current => ({ ...current, [field.id]: value }))} /></label>)}</div></section><section><h2 className="text-xl font-bold text-slate-900">3. Promo code</h2><input value={promoCode} onChange={event => setPromoCode(event.target.value.toUpperCase())} maxLength={64} autoComplete="off" placeholder="Optional promo code" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></section>{data.waiver && <section><h2 className="text-xl font-bold text-slate-900">4. Event waiver</h2><div className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p className="font-semibold text-slate-900">{data.waiver.title} · Version {data.waiver.version}</p><p className="mt-2 whitespace-pre-wrap">{data.waiver.content ?? 'Review the event waiver before continuing.'}</p></div><label className="mt-3 flex items-start gap-3 text-sm text-slate-700"><input className="mt-1" required type="checkbox" checked={acceptWaiver} onChange={event => setAcceptWaiver(event.target.checked)} /><span>I have read and accept this event waiver.</span></label></section>}<button disabled={busy || !categoryId} className="w-full rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? 'Preparing checkout...' : `Continue to payment${selectedCategory ? ` · ${peso(selectedCategory.registration_fee)}` : ''}`}</button>{message && <p role="status" className="text-center text-sm text-slate-600">{message}</p>}</form></section><aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="font-bold text-slate-900">Your slot hold</h2><p className="mt-2 text-sm leading-6 text-slate-600">Once checkout begins, RaceDeck holds your selected category slot for 15 minutes. Your registration becomes confirmed only after verified payment.</p><div className="mt-5 rounded-xl bg-white p-4 text-sm"><p className="font-semibold text-slate-900">What happens next</p><ol className="mt-3 space-y-2 text-slate-600"><li>1. Slot is reserved</li><li>2. Secure PayMongo checkout opens</li><li>3. Gateway verifies payment</li><li>4. RaceDeck confirms your registration</li></ol></div>{data.event.registration_closes_at && <p className="mt-4 text-xs text-slate-500">Registration closes {new Date(data.event.registration_closes_at).toLocaleString()}</p>}</aside></div></main>;
}
