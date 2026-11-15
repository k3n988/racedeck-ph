'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CreditCard, MapPin, PackageCheck, RefreshCw, UserRound } from 'lucide-react';
import { ToastFeedback } from '@/components/toast-feedback';

type DetailData = {
  event: { id: string; name: string };
  registrationPersonalFields?: string[] | null;
  bib?: { bib_code?: string | null; bib_number?: number | null; prefix?: string | null; status?: string | null } | null;
  raceKitClaimedAt?: string | null;
  registration: {
    id: string; registration_number: string; status: string; created_at: string;
    first_name?: string | null; middle_name?: string | null; last_name?: string | null;
    birthdate?: string | null; gender?: string | null; email?: string | null; mobile?: string | null;
    address?: string | null; shirt_size?: string | null; competition_classification?: string | null;
    emergency_contact_name?: string | null; emergency_contact_number?: string | null;
    emergency_contact_relationship?: string | null; checkout_group_id?: string | null;
  };
  category: { name?: string; distance_km?: number | null; registration_fee?: number | null } | null;
  answers: Array<{ id: string; value: unknown; event_registration_fields?: { section_key?: string | null; label?: string | null } | null; event_registration_field_options?: Array<{ label?: string | null; value?: string | null }> | null }>;
  history: Array<{ id: string; from_status?: string | null; to_status: string; reason?: string | null; changed_at: string }>;
  activity: Array<{ metadata?: unknown }>;
  emails: Array<{ id: string; subject?: string | null; email_type?: string | null; status: string; sent_at?: string | null; queued_at?: string | null; failure_reason?: string | null }>;
  merchandise: Array<{ id: string; item_name: string; variant?: string | null; quantity: number; unit_price: number; line_total: number }>;
  inclusions?: Array<{ id: string; item_name: string; details?: unknown }>;
  paymentSnapshot: { id: string; status: string; amount_due: number; amount_paid: number; amount_refunded: number; currency?: string | null; metadata?: unknown; created_at: string } | null;
  paymentScope?: 'participant' | 'checkout_group' | null;
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

function displayAnswer(raw: unknown, options: Array<{ label?: string | null; value?: string | null }> = []) {
  const displayOption = (value: unknown) => {
    const key = String(value ?? '');
    return options.find((option) => option.value === key)?.label ?? key;
  };
  if (raw == null || raw === '') return '—';
  if (typeof raw !== 'string') return Array.isArray(raw) ? raw.map(displayOption).join(', ') : displayOption(raw);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(displayOption).join(', ');
    if (parsed && typeof parsed === 'object') {
      const value = parsed as { selected?: unknown; other?: unknown };
      const selected = Array.isArray(value.selected) ? value.selected.map(displayOption) : [];
      if (typeof value.other === 'string' && value.other.trim()) selected.push(`Other: ${value.other.trim()}`);
      return selected.join(', ') || '—';
    }
    if (typeof parsed === 'string') return displayOption(parsed);
  } catch { /* Keep plain-text answers unchanged. */ }
  return displayOption(raw);
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof UserRound; children: React.ReactNode }) {
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">{Icon ? <Icon size={16} className="shrink-0 text-slate-600" aria-hidden="true" /> : null}<h2 className="text-sm font-bold text-[#0b2348]">{title}</h2></header><div className="p-4">{children}</div></section>;
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
  if (error || !data || !row) return <main className="mx-auto max-w-4xl space-y-4 p-5 sm:p-8"><Link href={`/organizer/events/${params.eventId}/registrations`} className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:text-orange-800"><ArrowLeft size={16} aria-hidden="true" />All registrations</Link><section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900"><div className="flex flex-wrap items-center justify-between gap-3"><p>{error || 'Participant profile could not be loaded.'}</p><button type="button" onClick={() => void load()} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 font-semibold hover:bg-red-100"><RefreshCw size={16} /> Try again</button></div></section></main>;

  const answers = data.answers ?? [];
  const healthAnswers = answers.filter((answer) => answer.event_registration_fields?.section_key === 'health');
  const additionalAnswers = answers.filter((answer) => answer.event_registration_fields?.section_key === 'additional');
  const merchandise = data.merchandise ?? [];
  const merchTotal = merchandise.reduce((total, item) => total + Number(item.line_total ?? 0), 0);
  const configuredInclusions = data.inclusions ?? [];
  const selectedKitById = new Map(kitSelections.map((selection) => [text(selection.item_id), selection]));
  const configuredInclusionIds = new Set(configuredInclusions.map((item) => item.id));
  const inclusionRows = configuredInclusions.map((item) => {
    const details = record(item.details);
    const selection = selectedKitById.get(item.id);
    return { id: item.id, name: item.item_name, variant: text(selection?.variant, 'Included'), description: text(details.description) };
  });
  const legacyInclusionRows = kitSelections.filter((selection) => {
    const id = text(selection.item_id);
    return id && !configuredInclusionIds.has(id) && text(selection.item_name).toLowerCase() !== 'race kit claiming';
  }).map((selection, index) => ({ id: `legacy-${text(selection.item_id, String(index))}`, name: text(selection.item_name, 'Included item'), variant: text(selection.variant, text(selection.size, 'Included')), description: '' }));
  const hasShirtInclusion = configuredInclusions.some((item) => /shirt|singlet/i.test(item.item_name));
  const selectedPersonalFields = new Set(data.registrationPersonalFields ?? ['first_name', 'last_name', 'birthdate', 'email', 'contact_number', 'address', 'emergency_contact', 'emergency_contact_phone', 'emergency_contact_relationship']);
  const personalDetails = ([
    ['First name', 'first_name', row.first_name], ['Middle name', 'middle_name', row.middle_name], ['Last name', 'last_name', row.last_name],
    ['Birthdate', 'birthdate', row.birthdate], ['Gender', 'gender', row.gender === 'prefer_not_to_say' ? 'Prefer not to say' : row.gender ? statusLabel(row.gender) : null],
    ['Email', 'email', row.email], ['Contact number', 'contact_number', row.mobile], ['Address', 'address', row.address],
    ['Emergency contact person', 'emergency_contact', row.emergency_contact_name], ['Emergency contact phone', 'emergency_contact_phone', row.emergency_contact_number],
    ['Relationship to participant', 'emergency_contact_relationship', row.emergency_contact_relationship],
  ] as Array<[string, string, unknown]>).filter(([, key]) => selectedPersonalFields.has(key));
  const paymentMetadata = record(payment?.metadata);
  const paymentMethod = text(paymentMetadata.payment_method, text(paymentMetadata.method, text(record(paymentMetadata.payment).method)));
  const transactionId = text(paymentMetadata.transaction_id, text(paymentMetadata.payment_intent_id, text(paymentMetadata.paymongo_payment_id)));
  const bibLabel = data.bib?.bib_code ?? (data.bib?.bib_number != null ? `${data.bib.prefix ?? ''}${data.bib.bib_number}` : null);

  return <main className="min-h-full bg-[#f4f6fa] px-3 pb-4 pt-1 sm:px-5 sm:pb-5 sm:pt-2">
    <div className="mx-auto max-w-[1440px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/organizer/events/${params.eventId}/registrations`} className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:text-orange-800"><ArrowLeft size={16} aria-hidden="true" />All registrations</Link>
        <Link href={`/organizer/events/${params.eventId}/registrations`} className="text-sm font-semibold text-slate-600 hover:text-orange-700">{data.event.name}</Link>
      </div>

      <header className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
          <div className="min-w-0"><h1 className="break-words text-xl font-extrabold text-[#0b2348] sm:text-2xl">{data.canViewPii ? (name || 'Participant') : `Registration ${row.registration_number}`}</h1><p className="mt-1 text-sm text-slate-500">{row.registration_number}<span className="px-1.5">·</span>Registered {date(row.created_at)}</p><div className="mt-3 flex flex-wrap gap-2">{data.category?.name && <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{data.category.name}</span>}{bibLabel && <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Bib {bibLabel}</span>}</div></div>
          <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-sm sm:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><div><p className="text-xs text-slate-500">Registration</p><span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{statusLabel(row.status)}</span></div><div><p className="text-xs text-slate-500">Payment</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${payment?.status === 'paid' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{statusLabel(payment?.status)}</span></div><div><p className="text-xs text-slate-500">Race kit</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${data.raceKitClaimedAt ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{data.raceKitClaimedAt ? 'Claimed' : 'Unclaimed'}</span></div></div>
        </div>
      </header>

      {data.warnings?.length > 0 && <ToastFeedback message={`Some optional information is unavailable: ${data.warnings.join('; ')}`} tone="auto" />}

      {!data.canViewPii && <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your role can view registration operations, but participant personal information and answers are restricted.</div>}

      <div className="space-y-3">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Section title="Personal Information" icon={UserRound}>
              {!data.canViewPii ? <p className="text-sm text-slate-500">Personal information is restricted for your role.</p> : <dl className="divide-y divide-slate-100">{personalDetails.map(([label, key, value]) => <div key={String(key)} className="grid grid-cols-[minmax(82px,0.75fr)_minmax(0,1.25fr)] gap-2 py-2 first:pt-0 last:pb-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="break-words text-xs font-medium text-slate-800">{value == null || value === '' ? '—' : String(value)}</dd></div>)}</dl>}
            </Section>

            <Section title="Merchandise & Inclusions" icon={PackageCheck}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Organizer-configured inclusions and selected merchandise</span>{merchandise.length > 0 && <span className="font-semibold text-slate-700">Merchandise total: {money(merchTotal, paymentCurrency)}</span>}</div>
            {inclusionRows.length || legacyInclusionRows.length || merchandise.length || (row.shirt_size && !hasShirtInclusion) ? <div className="divide-y divide-slate-100">
              {row.shirt_size && !hasShirtInclusion && <div className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0"><span className="text-sm font-medium text-slate-800">Race shirt</span><span className="text-xs text-slate-500">Size {row.shirt_size}</span></div>}
              {[...inclusionRows, ...legacyInclusionRows].map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0"><div><span className="text-sm font-medium text-slate-800">{item.name}</span>{item.description && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{item.description}</p>}</div><span className="text-xs text-slate-500">{item.variant}</span></div>)}
              {merchandise.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2 last:pb-0"><div><p className="text-sm font-medium text-slate-800">{item.item_name}{item.variant ? ` · ${item.variant}` : ''}</p><p className="text-xs text-slate-500">Qty {item.quantity} × {money(item.unit_price, paymentCurrency)}</p></div><p className="text-sm font-semibold text-[#0b2348]">{money(item.line_total, paymentCurrency)}</p></div>)}
            </div> : <p className="text-sm text-slate-500">No merchandise or inclusions are configured for this participant.</p>}
            </Section>
            <Section title="Payment Details" icon={CreditCard}>
              {payment ? <dl className="divide-y divide-slate-100">
                <div className="grid grid-cols-[minmax(82px,0.75fr)_minmax(0,1.25fr)] gap-2 py-2 first:pt-0"><dt className="text-xs text-slate-500">Status</dt><dd className="text-xs font-semibold text-slate-800">{statusLabel(payment.status)}</dd></div>
                {paymentMethod && <div className="grid grid-cols-[minmax(82px,0.75fr)_minmax(0,1.25fr)] gap-2 py-2"><dt className="text-xs text-slate-500">Method</dt><dd className="break-words text-xs font-medium text-slate-800">{statusLabel(paymentMethod)}</dd></div>}
                {transactionId && <div className="grid grid-cols-[minmax(82px,0.75fr)_minmax(0,1.25fr)] gap-2 py-2"><dt className="text-xs text-slate-500">Transaction ID</dt><dd className="break-all text-xs font-medium text-slate-800">{transactionId}</dd></div>}
                <div className="grid grid-cols-[minmax(82px,0.75fr)_minmax(0,1.25fr)] gap-2 py-2"><dt className="text-xs text-slate-500">Payment date</dt><dd className="text-xs font-medium text-slate-800">{date(payment.created_at)}</dd></div>
                <div className="mt-2 rounded-md bg-teal-50 px-2.5 py-2"><div className="flex justify-between gap-2 text-xs"><dt className="text-slate-600">Registration fee</dt><dd className="font-medium text-slate-800">{participantPrice != null ? money(participantPrice, paymentCurrency) : data.category?.registration_fee != null ? money(data.category.registration_fee, paymentCurrency) : '—'}</dd></div><div className="mt-1 flex justify-between gap-2 text-xs"><dt className="text-slate-600">Merchandise & add-ons</dt><dd className="font-medium text-slate-800">{money(merchTotal, paymentCurrency)}</dd></div><div className="mt-2 flex justify-between gap-2 border-t border-teal-100 pt-2 text-sm"><dt className="font-bold text-[#0b2348]">{data.paymentScope === 'checkout_group' ? 'Checkout total paid' : 'Amount paid'}</dt><dd className="font-extrabold text-[#0b2348]">{money(payment.amount_paid, paymentCurrency)}</dd></div>{data.paymentScope === 'checkout_group' && <p className="mt-1 text-[11px] text-slate-500">This payment covers multiple registrations.</p>}</div>
                {Number(payment.amount_refunded) > 0 && <div className="grid grid-cols-[minmax(82px,0.75fr)_minmax(0,1.25fr)] gap-2 pt-2"><dt className="text-xs text-slate-500">Refunded</dt><dd className="text-xs font-medium text-slate-800">{money(payment.amount_refunded, paymentCurrency)}</dd></div>}
              </dl> : <p className="text-sm text-slate-500">No payment record is available.</p>}
            </Section>
          </div>
        </div>

        {data.canViewPii && (healthAnswers.length > 0 || additionalAnswers.length > 0) && <div className="grid items-start gap-3 md:grid-cols-2">
          {healthAnswers.length > 0 && <Section title="Health Information" icon={UserRound}><dl className="divide-y divide-slate-100">{healthAnswers.map((answer) => <div key={answer.id} className="py-3 first:pt-0 last:pb-0"><dt className="text-xs font-semibold text-slate-600">{answer.event_registration_fields?.label ?? 'Health question'}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-800">{answer.value == null || answer.value === '' ? 'No response provided' : displayAnswer(answer.value, answer.event_registration_field_options ?? [])}</dd></div>)}</dl></Section>}
          {additionalAnswers.length > 0 && <Section title="Additional Information" icon={UserRound}><dl className="divide-y divide-slate-100">{additionalAnswers.map((answer) => <div key={answer.id} className="py-3 first:pt-0 last:pb-0"><dt className="text-xs font-semibold text-slate-600">{answer.event_registration_fields?.label ?? 'Registration question'}</dt><dd className="mt-1 break-words whitespace-pre-wrap text-sm text-slate-800">{answer.value == null || answer.value === '' ? 'No response provided' : displayAnswer(answer.value, answer.event_registration_field_options ?? [])}</dd></div>)}</dl></Section>}
        </div>}
        {data.canViewPii && data.emails.length > 0 && <Section title="Email history" icon={MapPin}><ul className="space-y-3">{data.emails.map((item) => <li key={item.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"><p className="text-sm font-semibold text-slate-800">{item.subject || statusLabel(item.email_type)}</p><p className="mt-1 text-xs text-slate-600">{statusLabel(item.status)} · {date(item.sent_at ?? item.queued_at)}</p>{item.failure_reason && <p className="mt-1 text-xs text-red-700">{item.failure_reason}</p>}</li>)}</ul></Section>}
      </div>
    </div>
  </main>;
}
