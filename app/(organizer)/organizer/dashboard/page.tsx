'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type EventRow = { id: string; name: string; event_date: string; created_at: string; venue: string | null; lifecycle_status: string; review_status: string; registration_availability: string; registrations_count: number; confirmed_count: number; gross_sales: number; capacity: number | null };
type Registration = { id: string; user_id: string | null; event_id: string; registration_number: string; status: string; first_name: string; last_name: string; email: string | null; created_at: string; events?: { name: string } | null; race_categories?: { name: string } | null };
type Payment = { id: string; event_id: string; registration_id: string; status: string; amount_paid: number; amount_refunded: number; currency: string; gateway: string; created_at: string; registrations?: { first_name: string; last_name: string; registration_number: string } | null; events?: { name: string } | null };
type Refund = { id: string; event_id: string; status: string; amount: number; created_at: string };
type Fee = { id: string; event_id: string; status: string; amount: number; created_at: string };
type SectionErrorProps = { message: string; retry: () => void };

const money = (value: number, currency = 'PHP') => new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value) || 0);

function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />; }
function ErrorState({ message, retry }: SectionErrorProps) { return <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{message}</span><button onClick={retry} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-bold hover:bg-red-100">Retry</button></div>; }
function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) { return <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-black tracking-tight text-[#071b41]">{title}</h2>{action}</div>; }
function Kpi({ title, value, detail, href }: { title: string; value: string | number; detail: string; href: string; tone?: 'white' | 'navy' | 'orange' }) { return <Link href={href} className="group block rounded-2xl border border-slate-200 bg-white p-5 text-[#071b41] shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-3 text-3xl font-black tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></Link>; }

type TopEvent = { id: string; name: string; value: number; confirmedCount?: number };

function TopEventsList({ events, format, color }: { events: TopEvent[]; format: (value: number) => string; color: 'orange' | 'navy' }) {
  const maxValue = Math.max(1, ...events.map((event) => event.value));
  const barColor = color === 'orange' ? 'bg-orange-500' : 'bg-[#071b41]';
  return <ol className="space-y-4">{events.map((event, index) => <li key={event.id} className="space-y-2"><div className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#071b41]" title={event.name}>{event.name}</p>{event.confirmedCount !== undefined && <p className="text-xs text-slate-500">{event.confirmedCount.toLocaleString()} confirmed registrations</p>}</div><span className="shrink-0 text-sm font-black text-[#071b41]">{format(event.value)}</span></div><div className="ml-10 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(4, (event.value / maxValue) * 100)}%` }} /></div></li>)}</ol>;
}

function EmptyChartState({ icon, title, description }: { icon: 'chart' | 'trophy'; title: string; description: string }) {
  return <div role="status" className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><span aria-hidden="true" className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-50 text-slate-400"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon === 'chart' ? <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></> : <><path d="M8 21h8m-4-4v4" /><path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4" /></>}</svg></span><h3 className="text-base font-bold text-[#071b41]">{title}</h3><p className="mt-1 max-w-sm text-sm leading-5 text-slate-500">{description}</p></div>;
}
type ChartPoint = { label: string; value: number };

function buildChartPoints(entries: { date: string; value: number }[], period: string): ChartPoint[] {
  const now = Date.now();
  const validEntries = entries.map((entry) => ({ ...entry, timestamp: Date.parse(entry.date) })).filter((entry) => Number.isFinite(entry.timestamp));
  const count = period === '30d' || period === '90d' ? 6 : 12;
  const requestedStart = period === '30d' ? now - 30 * 86400000 : period === '90d' ? now - 90 * 86400000 : period === '12m' ? now - 365 * 86400000 : Math.min(now - 365 * 86400000, ...validEntries.map((entry) => entry.timestamp));
  const start = Math.min(requestedStart, now - 1);
  const step = (now - start) / count;
  const buckets = Array.from({ length: count }, (_, index) => {
    const midpoint = new Date(start + step * (index + 0.5));
    const labelOptions: Intl.DateTimeFormatOptions = period === '30d' || period === '90d' ? { month: 'short', day: 'numeric' } : { month: 'short', ...(period === 'all' ? { year: '2-digit' as const } : {}) };
    return { label: midpoint.toLocaleDateString('en-PH', labelOptions), value: 0 };
  });
  for (const entry of validEntries) {
    if (entry.timestamp < start || entry.timestamp > now) continue;
    const index = Math.min(count - 1, Math.floor((entry.timestamp - start) / step));
    buckets[index].value += entry.value;
  }
  return buckets;
}

function DashboardChart({ points, kind }: { points: ChartPoint[]; kind: 'line' | 'bar' }) {
  const width = 760;
  const height = 250;
  const left = 48;
  const right = 2;
  const top = 12;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = points.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const y = (value: number) => top + ((max - value) / span) * plotHeight;
  const x = (index: number) => left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const zeroY = y(0);
  const tickValues = Array.from({ length: 5 }, (_, index) => min + (span * (4 - index)) / 4);
  const moneyAxis = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.value)}`).join(' ');
  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  return <svg className="h-64 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={kind === 'line' ? 'Net revenue by period' : 'Registrations by period'}>
    {tickValues.map((value, index) => <g key={`tick-${index}`}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#e2e8f0" strokeDasharray={index === tickValues.length - 1 ? undefined : '4 5'} /><text x={left - 10} y={y(value) + 4} textAnchor="end" className="fill-slate-500" fontSize="11">{kind === 'line' ? moneyAxis.format(value) : Math.round(value).toLocaleString()}</text></g>)}
    {kind === 'bar' ? points.map((point, index) => { const barWidth = Math.min(34, (plotWidth / points.length) * 0.54); const pointY = y(point.value); return <g key={`${point.label}-${index}`}><rect x={left + ((index + 0.5) / points.length) * plotWidth - barWidth / 2} y={Math.min(pointY, zeroY)} width={barWidth} height={Math.max(2, Math.abs(zeroY - pointY))} rx="5" fill="#f97316"><title>{`${point.label}: ${point.value.toLocaleString()} registrations`}</title></rect></g>; }) : <><path d={path} fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r="4" fill="white" stroke="#f97316" strokeWidth="2"><title>{`${point.label}: ${moneyAxis.format(point.value)}`}</title></circle>)}</>}
    {points.map((point, index) => index % labelStep === 0 || index === points.length - 1 ? <text key={`label-${index}`} x={kind === 'bar' ? left + ((index + 0.5) / points.length) * plotWidth : x(index)} y={height - 10} textAnchor="middle" className="fill-slate-500" fontSize="11">{point.label}</text> : null)}
  </svg>;
}
export default function OrganizerDashboardPage() {
  const [events, setEvents] = useState<EventRow[]>([]); const [registrations, setRegistrations] = useState<Registration[]>([]); const [payments, setPayments] = useState<Payment[]>([]); const [refunds, setRefunds] = useState<Refund[]>([]); const [fees, setFees] = useState<Fee[]>([]);
  const [eventFilter, setEventFilter] = useState('all'); const [periodFilter, setPeriodFilter] = useState('12m'); const [loading, setLoading] = useState({ events: true, registrations: true, payments: true }); const [errors, setErrors] = useState<Record<string, string>>({});
  const loadSection = useCallback(async (key: keyof typeof loading, endpoint: string, setter: (body: Record<string, unknown>) => void) => { setLoading((current) => ({ ...current, [key]: true })); setErrors((current) => { const next = { ...current }; delete next[key]; return next; }); try { const response = await fetch(endpoint, { cache: 'no-store' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Request could not be completed.'); setter(body); } catch (error) { setErrors((current) => ({ ...current, [key]: error instanceof Error ? error.message : 'Unable to load this section.' })); } finally { setLoading((current) => ({ ...current, [key]: false })); } }, []);
  const loadEvents = useCallback(() => loadSection('events', '/api/organizer/events', (body) => setEvents(Array.isArray(body.events) ? body.events as EventRow[] : [])), [loadSection]);
  const loadRegistrations = useCallback(() => loadSection('registrations', '/api/organizer/registrations', (body) => setRegistrations(Array.isArray(body.registrations) ? body.registrations as Registration[] : [])), [loadSection]);
  const loadPayments = useCallback(() => loadSection('payments', '/api/organizer/payments', (body) => { setPayments(Array.isArray(body.payments) ? body.payments as Payment[] : []); setRefunds(Array.isArray(body.refunds) ? body.refunds as Refund[] : []); setFees(Array.isArray(body.fees) ? body.fees as Fee[] : []); }), [loadSection]);
  useEffect(() => { void loadEvents(); void loadRegistrations(); void loadPayments(); }, [loadEvents, loadRegistrations, loadPayments]);

  const rangeStart = useMemo(() => { if (periodFilter === 'all') return 0; const days = periodFilter === '30d' ? 30 : periodFilter === '90d' ? 90 : 365; return Date.now() - days * 24 * 60 * 60 * 1000; }, [periodFilter]);
  const inPeriod = (date: string) => { const timestamp = Date.parse(date); return Number.isFinite(timestamp) && timestamp >= rangeStart; };
  const selectedEvents = events.filter((event) => eventFilter === 'all' || event.id === eventFilter);
  const scopedEvents = selectedEvents.filter((event) => inPeriod(event.created_at));
  const scopedEventIds = new Set(selectedEvents.map((event) => event.id));
  const scopedRegistrations = registrations.filter((registration) => scopedEventIds.has(registration.event_id) && inPeriod(registration.created_at));
  const scopedPayments = payments.filter((payment) => scopedEventIds.has(payment.event_id) && inPeriod(payment.created_at));
  const scopedRefunds = refunds.filter((refund) => scopedEventIds.has(refund.event_id) && inPeriod(refund.created_at));
  const scopedFees = fees.filter((fee) => scopedEventIds.has(fee.event_id) && inPeriod(fee.created_at));
  const confirmedRegistrations = scopedRegistrations.filter((registration) => registration.status === 'confirmed');
  const participantIdentities = new Set(confirmedRegistrations.map((registration) => registration.user_id?.trim() || registration.email?.trim().toLowerCase() || `registration:${registration.id}`));
  const totalParticipants = participantIdentities.size;
  const successfulPayments = Array.from(new Map(scopedPayments.filter((payment) => ['succeeded', 'partially_refunded', 'refunded'].includes(payment.status)).map((payment) => [payment.id, payment] as const)).values());
  const gross = successfulPayments.reduce((sum, payment) => sum + Number(payment.amount_paid ?? 0), 0);
  const successfulRefunds = Array.from(new Map(scopedRefunds.filter((refund) => refund.status === 'succeeded').map((refund) => [refund.id, refund] as const)).values());
  const applicableFees = Array.from(new Map(scopedFees.filter((fee) => ['accrued', 'collected'].includes(fee.status)).map((fee) => [fee.id, fee] as const)).values());
  const totalRefunds = successfulRefunds.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0);
  const totalFees = applicableFees.reduce((sum, fee) => sum + Number(fee.amount ?? 0), 0);
  const netRevenue = gross - totalRefunds - totalFees;
  const grossRevenueByEvent = new Map<string, number>(selectedEvents.map((event) => [event.id, 0] as const));
  for (const payment of successfulPayments) grossRevenueByEvent.set(payment.event_id, (grossRevenueByEvent.get(payment.event_id) ?? 0) + Number(payment.amount_paid ?? 0));
  const confirmedByEvent = new Map<string, number>();
  for (const registration of confirmedRegistrations) confirmedByEvent.set(registration.event_id, (confirmedByEvent.get(registration.event_id) ?? 0) + 1);
  const topRevenueEvents = selectedEvents.map((event) => ({ id: event.id, name: event.name, value: grossRevenueByEvent.get(event.id) ?? 0, confirmedCount: confirmedByEvent.get(event.id) ?? 0 })).filter((event) => event.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  const registrationsByEvent = new Map<string, number>();
  for (const registration of scopedRegistrations) registrationsByEvent.set(registration.event_id, (registrationsByEvent.get(registration.event_id) ?? 0) + 1);
  const topRegistrationEvents = selectedEvents.map((event) => ({ id: event.id, name: event.name, value: registrationsByEvent.get(event.id) ?? 0 })).filter((event) => event.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);  const netRevenuePoints = buildChartPoints([
    ...successfulPayments.map((payment) => ({ date: payment.created_at, value: Number(payment.amount_paid ?? 0) })),
    ...successfulRefunds.map((refund) => ({ date: refund.created_at, value: -Number(refund.amount ?? 0) })),
    ...applicableFees.map((fee) => ({ date: fee.created_at, value: -Number(fee.amount ?? 0) })),
  ], periodFilter);
  const hasNetRevenueData = successfulPayments.some((payment) => Number(payment.amount_paid ?? 0) > 0) && netRevenuePoints.some((point) => point.value !== 0);
  const registrationPoints = buildChartPoints(scopedRegistrations.map((registration) => ({ date: registration.created_at, value: 1 })), periodFilter);
  const empty = !loading.events && !errors.events && events.length === 0;
  const dashboardHref = (path: string, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    if (eventFilter !== 'all') params.set('eventId', eventFilter);
    if (periodFilter !== 'all') params.set('from', new Date(rangeStart).toISOString());
    params.set('to', new Date().toISOString());
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };
  return <main className="mx-auto max-w-7xl space-y-7 bg-[#f5f7fa] p-5 sm:p-7"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-orange-600">Organizer workspace</p><h1 className="mt-1 text-3xl font-black tracking-tight text-[#071b41]">Dashboard</h1><p className="mt-1 text-sm text-slate-500">Monitor your race events, registrations, payments, and payouts.</p></div><Link href="/organizer/events" className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-700">+ Create event</Link></header>
    {empty ? <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-2xl">🏁</div><h2 className="mt-4 text-xl font-black text-[#071b41]">Create your first race event</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Set up your race details, categories, registration form, and payment settings in one event workspace.</p><Link href="/organizer/events" className="mt-5 inline-flex rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white">Create your first event</Link></section> : <><section className="grid !mt-0 gap-4 sm:grid-cols-2 xl:grid-cols-6">{loading.events ? <>{[1, 2].map((item) => <Skeleton key={item} className="h-32" />)}</> : <><Kpi title="Total events" value={errors.events ? '—' : scopedEvents.length} detail={errors.events ? 'Could not load events' : 'Events matching selected filters'} href={dashboardHref('/organizer/events')} /><Kpi title="Published events" value={errors.events ? '—' : scopedEvents.filter((event) => ['published', 'ongoing'].includes(event.lifecycle_status)).length} detail={errors.events ? 'Could not load events' : 'Published or ongoing events'} href={dashboardHref('/organizer/events', { lifecycle_status: 'published,ongoing' })} /></>}{loading.registrations ? <>{[1, 2].map((item) => <Skeleton key={`r-${item}`} className="h-32" />)}</> : <><Kpi title="Total registrations" value={errors.registrations ? '—' : scopedRegistrations.length} detail={errors.registrations ? 'Could not load registrations' : 'Registration records matching filters'} href={dashboardHref('/organizer/registrations')} /><Kpi title="Confirmed participants" value={errors.registrations ? '—' : totalParticipants} detail={errors.registrations ? 'Could not load participants' : 'Unique confirmed participants'} href={dashboardHref('/organizer/registrations', { status: 'confirmed' })} /></>}{loading.payments ? <Skeleton className="h-32" /> : <><Kpi title="Gross revenue" value={errors.payments ? '—' : money(gross)} detail={errors.payments ? 'Could not load financial data' : 'Total successful payments before deductions'} href={dashboardHref('/organizer/reports', { metric: 'gross' })} /><Kpi title="Net organizer revenue" value={errors.payments ? '—' : money(netRevenue)} detail={errors.payments ? 'Could not load financial data' : 'Gross revenue minus applicable fees and refunds'} href={dashboardHref('/organizer/reports', { metric: 'net' })} /></>}</section>
      <div className="flex flex-wrap items-center gap-3" aria-label="Dashboard filters">
        <label className="relative"><span className="sr-only">Filter by event</span><select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="h-10 w-44 appearance-none rounded-lg border border-blue-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-950 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"><option value="all">All events</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select><svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 fill-current"><path d="m5 7 5 5 5-5z" /></svg></label>
        <label className="relative"><span className="sr-only">Filter by period</span><select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} className="h-10 w-44 appearance-none rounded-lg border border-transparent bg-transparent py-2 pl-2 pr-8 text-sm font-medium text-slate-950 hover:border-slate-200 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="12m">Last 12 months</option><option value="all">All time</option></select><svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 fill-current"><path d="m5 7 5 5 5-5z" /></svg></label>
      </div>
      {errors.events && <ErrorState message={errors.events} retry={() => void loadEvents()} />}
      <section className="grid gap-y-6 gap-x-3 xl:grid-cols-[1.75fr_1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle title="Net revenue" action={<Link href={dashboardHref('/organizer/reports', { metric: 'net' })} className="text-sm font-bold text-orange-600">View reports →</Link>} />{loading.payments ? <Skeleton className="h-64" /> : errors.payments ? <ErrorState message="Net revenue chart could not be loaded." retry={() => void loadPayments()} /> : hasNetRevenueData ? <DashboardChart points={netRevenuePoints} kind="line" /> : <EmptyChartState icon="chart" title="No revenue data yet" description="Revenue trends will appear once your events receive successful payments." />}</div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle title="Top events by revenue" />{loading.payments || loading.events || loading.registrations ? <div className="space-y-5">{[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-8" />)}</div> : errors.payments || errors.events || errors.registrations ? <ErrorState message="Top events by revenue could not be loaded." retry={() => { void loadPayments(); void loadEvents(); void loadRegistrations(); }} /> : topRevenueEvents.length ? <TopEventsList events={topRevenueEvents} format={money} color="orange" /> : <EmptyChartState icon="trophy" title="No revenue data yet" description="Your top-performing events will appear here once payments are received." />}</div></section>
      <section className="grid gap-y-6 gap-x-3 xl:grid-cols-[1.75fr_1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle title="Registrations" action={<Link href={dashboardHref('/organizer/registrations')} className="text-sm font-bold text-orange-600">View all →</Link>} />{loading.registrations ? <Skeleton className="h-64" /> : errors.registrations ? <ErrorState message="Registration chart could not be loaded." retry={() => void loadRegistrations()} /> : <DashboardChart points={registrationPoints} kind="bar" />}</div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SectionTitle title="Top events by registrations" />{loading.registrations || loading.events ? <div className="space-y-5">{[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-8" />)}</div> : errors.registrations || errors.events ? <ErrorState message="Top events by registrations could not be loaded." retry={() => { void loadRegistrations(); void loadEvents(); }} /> : <TopEventsList events={topRegistrationEvents} format={(value) => value.toLocaleString()} color="navy" />}</div></section></>}</main>;
}
