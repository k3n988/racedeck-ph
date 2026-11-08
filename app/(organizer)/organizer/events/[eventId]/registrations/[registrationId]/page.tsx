'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CalendarDays, ClipboardList, CreditCard, MapPin, PackageCheck, RefreshCw, UserRound } from 'lucide-react';

type DetailData = {
  event: { id: string; name: string };
  registration: {
    id: string; registration_number: string; status: string; created_at: string;
    first_name?: string | null; middle_name?: string | null; last_name?: string | null;
    birthdate?: string | null; gender?: string | null; email?: string | null; mobile?: string | null;
    address?: string | null; shirt_size?: string | null; competition_classification?: string | null;
    emergency_contact_name?: string | null; emergency_contact_number?: string | null;
    emergency_contact_relationship?: string | null; checkout_group_id?: string | null;
  };
  category: { name?: string; distance_km?: number | null; registration_fee?: number | null } | null;
  answers: Array<{ id: string; value: unknown; event_registration_fields?: { section_key?: string | null; label?: string | null } | null }>;
  history: Array<{ id: string; from_status?: string | null; to_status: string; reason?: string | null; changed_at: string }>;
  activity: Array<{ metadata?: unknown }>;
  emails: Array<{ id: string; subject?: string | null; email_type?: string | null; status: string; sent_at?: string | null; queued_at?: string | null; failure_reason?: string | null }>;
  merchandise: Array<{ id: string; item_name: string; variant?: string | null; quantity: number; unit_price: number; line_total: number }>;
  paymentSnapshot: { id: string; status: string; amount_due: number; amount_paid: number; amount_refunded: number; currency?: string | null; metadata?: unknown; created_at: string } | null;
  canViewPii: boolean;
  canManageRegistrations: boolean;
  warnings: string[];
};

const date = (value?: unknown) => value
  ? new Date(String(value)).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
  : 'Not provided';
const statusLabel = (value?: unknown) => value
  ? String(value).replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  : 'Unknown';
const money = (amount: unknown, currency = 'PHP') => new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(amount ?? 0));
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const text = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

function displayAnswer(raw: unknown) {
  if (raw == null || raw === '') return '—';
  if (typeof raw !== 'string') return Array.isArray(raw) ? raw.map(String).join(', ') : String(raw);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).join(', ');
    if (parsed && typeof parsed === 'object') {
      const value = parsed as { selected?: unknown; other?: unknown };
      const selected = Array.isArray(value.selected) ? value.selected.map(String) : [];
      if (typeof value.other === 'string' && value.other.trim()) selected.push(`Other: ${value.other.trim()}`);
      return selected.join(', ') || '—';
    }
    if (typeof parsed === 'string') return parsed;
  } catch { /* Keep plain-text answers unchanged. */ }
  return raw;
}

function Detail({ label, value }: { label: string; value: unknown }) {
  const text = value == null || value === '' ? 'Not provided' : String(value);
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{text}</dd></div>;
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof UserRound; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">{Icon ? <Icon size={18} className="text-orange-600" aria-hidden="true" /> : null}<h2 className="font-bold text-[#0b2348]">{title}</h2></header><div className="p-5">{children}</div></section>;
}

export default function RegistrationDetailPage({ params }: { params: { eventId: string; registrationId: string } }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/registrations/${params.registrationId}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Participant profile could not be loaded.');
      setData(body as DetailData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Participant profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId, params.registrationId]);

  useEffect(() => { void load(); }, [load]);

  const row = data?.registration;
  const name = useMemo(() => row ? [row.first_name, row.middle_name, row.last_name].filter((part): part is string => Boolean(part)).join(' ') : '', [row]);
  const kitSelections = useMemo(() => (data?.activity ?? []).flatMap((item) => {
    const selections = record(item.metadata).race_kit_selections;
    return Array.isArray(selections) ? selections.map((selection) => record(selection)) : [];
  }), [data?.activity]);
  const payment = data?.paymentSnapshot;
  const paymentCurrency = text(payment?.currency, 'PHP');
  const participantPrice = useMemo(() => {
    const metadata = record(payment?.metadata);
    const participants = metadata.participants;
    return Array.isArray(participants)
      ? participants.map((participant) => record(participant)).find((participant) => participant.registration_id === row?.id)?.category_amount
      : metadata.category_amount;
  }, [payment, row?.id]);

  // Keep all hooks above the loading/error returns so the component has the
  // same hook order while the request transitions from pending to complete.

  if (loading) return <main className="mx-auto max-w-6xl space-y-5 p-5 sm:p-8" aria-busy="true"><div className="h-5 w-40 animate-pulse rounded bg-slate-200" /><div className="h-24 animate-pulse rounded-2xl bg-white" /><div className="h-72 animate-pulse rounded-2xl bg-white" /></main>;
  if (error || !data || !row) return <main className="mx-auto max-w-4xl p-5 sm:p-8"><Link href={`/organizer/events/${params.eventId}/registrations`} className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:underline"><ArrowLeft size={16} /> Back to registrations</Link><div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle size={18} className="mt-0.5 shrink-0" /><p>{error || 'Participant profile could not be loaded.'}</p></div><button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0b2b5b] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#123b77]"><RefreshCw size={16} /> Try again</button></main>;

  const answers = data.answers ?? [];
  const healthAnswers = answers.filter((answer) => answer.event_registration_fields?.section_key === 'health');
  const additionalAnswers = answers.filter((answer) => answer.event_registration_fields?.section_key !== 'health');
  const merchandise = data.merchandise ?? [];
  const merchTotal = merchandise.reduce((total, item) => total + Number(item.line_total ?? 0), 0);

  return <main className="min-h-full bg-[#f4f6fa] p-4 sm:p-7">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/organizer/events/${params.eventId}/registrations`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-[#0b2b5b] hover:border-orange-400 hover:text-orange-700"><ArrowLeft size={16} /> Back to registrations</Link>
        <Link href={`/organizer/events/${params.eventId}/registrations`} className="text-sm font-semibold text-slate-600 hover:text-orange-700">{data.event.name}</Link>
      </div>

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Participant profile</p><h1 className="mt-1 break-words text-2xl font-extrabold text-[#0b2348]">{data.canViewPii ? (name || 'Participant') : `Registration ${row.registration_number}`}</h1><p className="mt-1 text-sm text-slate-600">{row.registration_number} <span aria-hidden="true">·</span> {data.event.name}</p></div>
          <div className="flex flex-wrap gap-2"><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">{statusLabel(row.status)}</span>{payment && <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">Payment: {statusLabel(payment.status)}</span>}</div>
        </div>
      </header>

      {data.warnings?.length > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><p className="font-semibold">Some optional information is unavailable.</p><ul className="mt-1 list-inside list-disc">{data.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}

      {!data.canViewPii && <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your role can view registration operations, but participant personal information and answers are restricted.</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
        <div className="space-y-5">
          <Section title="Personal information" icon={UserRound}>
            {data.canViewPii ? <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <Detail label="First name" value={row.first_name} /><Detail label="Middle name" value={row.middle_name} /><Detail label="Last name" value={row.last_name} />
              <Detail label="Birthdate" value={row.birthdate} /><Detail label="Gender" value={row.gender === 'prefer_not_to_say' ? 'Prefer not to say' : row.gender ? statusLabel(row.gender) : null} /><Detail label="Email" value={row.email} />
              <Detail label="Contact number" value={row.mobile} /><Detail label="Address" value={row.address} /><Detail label="Shirt size" value={row.shirt_size} /><Detail label="Competition classification" value={row.competition_classification} />
              <Detail label="Emergency contact" value={row.emergency_contact_name} /><Detail label="Emergency contact number" value={row.emergency_contact_number} /><Detail label="Relationship" value={row.emergency_contact_relationship} />
            </dl> : <p className="text-sm text-slate-500">Personal information is restricted for your role.</p>}
          </Section>

          <Section title="Health information" icon={ClipboardList}>
            {!data.canViewPii ? <p className="text-sm text-slate-500">Participant answers are restricted for your role.</p> : healthAnswers.length ? <dl className="space-y-4">{healthAnswers.map((answer) => <div key={answer.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"><dt className="text-sm font-semibold text-slate-800">{answer.event_registration_fields?.label ?? 'Health question'}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{displayAnswer(answer.value)}</dd></div>)}</dl> : <p className="text-sm text-slate-500">No health answers were submitted.</p>}
          </Section>

          <Section title="Additional information" icon={ClipboardList}>
            {!data.canViewPii ? <p className="text-sm text-slate-500">Participant answers are restricted for your role.</p> : additionalAnswers.length ? <dl className="space-y-4">{additionalAnswers.map((answer) => <div key={answer.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"><dt className="text-sm font-semibold text-slate-800">{answer.event_registration_fields?.label ?? 'Registration question'}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{displayAnswer(answer.value)}</dd></div>)}</dl> : <p className="text-sm text-slate-500">No additional answers were submitted.</p>}
          </Section>

          <Section title="Included race kit selections" icon={PackageCheck}>
            {kitSelections.length ? <ul className="divide-y divide-slate-100">{kitSelections.map((item, index) => <li key={`${text(item.item_id, text(item.item_name, 'included-item'))}-${index}`} className="flex flex-wrap justify-between gap-2 py-3 first:pt-0 last:pb-0"><span className="font-semibold text-slate-800">{text(item.item_name, 'Included item')}</span><span className="text-sm text-slate-600">{text(item.variant, text(item.size, 'Included'))}</span></li>)}</ul> : <p className="text-sm text-slate-500">No size or variant selections recorded.</p>}
          </Section>

          <Section title="Optional merchandise" icon={PackageCheck}>
            {merchandise.length ? <div className="divide-y divide-slate-100">{merchandise.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="font-semibold text-slate-800">{item.item_name}</p><p className="text-sm text-slate-500">{item.variant || 'No variant'} · Qty {item.quantity}</p></div><div className="text-right text-sm"><p>{money(item.unit_price, paymentCurrency)} each</p><p className="font-bold text-[#0b2348]">{money(item.line_total, paymentCurrency)}</p></div></div>)}</div> : <p className="text-sm text-slate-500">No optional merchandise was selected.</p>}
          </Section>
        </div>

        <aside className="space-y-5">
          <Section title="Race entry" icon={CalendarDays}>
            <dl className="space-y-4"><Detail label="Category" value={data.category?.name} /><Detail label="Distance" value={data.category?.distance_km != null ? `${data.category.distance_km} km` : null} /><Detail label="Registration number" value={row.registration_number} /><Detail label="Registered" value={date(row.created_at)} /><Detail label="Category price at checkout" value={participantPrice != null ? money(participantPrice, paymentCurrency) : data.category?.registration_fee != null ? money(data.category.registration_fee) : null} /></dl>
          </Section>

          <Section title="Payment summary" icon={CreditCard}>
            {payment ? <dl className="space-y-4"><Detail label="Payment status" value={statusLabel(payment.status)} /><Detail label="Amount due" value={money(payment.amount_due, paymentCurrency)} /><Detail label="Amount paid" value={money(payment.amount_paid, paymentCurrency)} /><Detail label="Refunded" value={money(payment.amount_refunded, paymentCurrency)} /><Detail label="Merchandise total" value={money(merchTotal, paymentCurrency)} /><Detail label={row.checkout_group_id ? 'Combined checkout total' : 'Payment recorded'} value={date(payment.created_at)} /></dl> : <p className="text-sm text-slate-500">No payment record is available for this registration.</p>}
          </Section>

          <Section title="Registration status history" icon={RefreshCw}>
            {data.history.length ? <ol className="space-y-4">{data.history.map((item) => <li key={item.id} className="border-l-2 border-orange-200 pl-3"><p className="text-sm font-semibold text-slate-800">{item.from_status ? `${statusLabel(item.from_status)} → ` : ''}{statusLabel(item.to_status)}</p><p className="mt-1 text-xs text-slate-500">{date(item.changed_at)}{item.reason ? ` · ${item.reason}` : ''}</p></li>)}</ol> : <p className="text-sm text-slate-500">No status changes recorded.</p>}
          </Section>

          <Section title="Email history" icon={MapPin}>
            {data.canViewPii && data.emails.length ? <ul className="space-y-3">{data.emails.map((item) => <li key={item.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"><p className="font-semibold text-slate-800">{item.subject || statusLabel(item.email_type)}</p><p className="mt-1 text-sm text-slate-600">{statusLabel(item.status)} · {date(item.sent_at ?? item.queued_at)}</p>{item.failure_reason && <p className="mt-1 text-xs text-red-700">{item.failure_reason}</p>}</li>)}</ul> : <p className="text-sm text-slate-500">No email history recorded.</p>}
          </Section>
        </aside>
      </div>
    </div>
  </main>;
}
