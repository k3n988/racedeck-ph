import Link from 'next/link';
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, MailWarning, Scale, Users } from 'lucide-react';
import { adminDateRange } from '@/lib/admin/list-query';
import { createAdminClient } from '@/lib/supabase/admin';
import DashboardFilters from './dashboard-filters';

export const dynamic = 'force-dynamic';

function QueueEmptyState({ icon: Icon, title, description }: { icon: typeof CalendarDays; title: string; description: string }) {
  return <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center" role="status">
    <span className="grid h-14 w-14 place-items-center rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-100"><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span>
    <p className="mt-3 text-sm font-bold text-slate-800">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{description}</p>
  </div>;
}

function Metric({ label, value, href, icon: Icon }: {
  label: string; value: number | string | null; href: string; icon: typeof CalendarDays;
}) {
  return <Link href={href} className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
    <div><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-2 text-3xl font-black text-[#071b41]">{value == null ? '—' : value.toLocaleString()}</p></div>
    <span className="grid h-11 w-11 place-items-center text-[#071b41]"><Icon size={21} aria-hidden="true" /></span>
  </Link>;
}

async function getCollectedPlatformRevenue(db: ReturnType<typeof createAdminClient>, eventId: string, range: ReturnType<typeof adminDateRange>) {
  const totalsByCurrency = new Map<string, number>();
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    let query = db.from('platform_fees').select('amount,currency').eq('status', 'collected').order('collected_at', { ascending: true }).range(offset, offset + pageSize - 1);
    if (eventId) query = query.eq('event_id', eventId);
    if (range.from) query = query.gte('collected_at', range.from);
    if (range.toExclusive) query = query.lt('collected_at', range.toExclusive);
    const result = await query;
    if (result.error) return { data: null, error: result.error };

    for (const fee of result.data ?? []) {
      const cents = Math.round(Number(fee.amount) * 100);
      totalsByCurrency.set(fee.currency, (totalsByCurrency.get(fee.currency) ?? 0) + cents);
    }
    if ((result.data?.length ?? 0) < pageSize) break;
    offset += pageSize;
  }

  return { data: totalsByCurrency, error: null };
}

function formatCurrencyTotals(totals: Map<string, number>) {
  if (totals.size === 0) return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(0);
  return Array.from(totals.entries()).map(([currency, cents]) => new Intl.NumberFormat('en-PH', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(cents / 100)).join(' · ');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminDashboardPage({ searchParams }: { searchParams?: { from?: string; to?: string; event?: string } }) {
  const db = createAdminClient();
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const range = adminDateRange(from, to);
  const eventId = UUID.test(searchParams?.event ?? '') ? searchParams!.event! : '';
  const eventsQuery = () => {
    let query = db.from('events').select('id', { count: 'exact', head: true });
    if (eventId) query = query.eq('id', eventId);
    if (from && !range.error) query = query.gte('event_date', from);
    if (to && !range.error) query = query.lte('event_date', to);
    return query;
  };
  let pendingEventsQuery = db.from('events').select('id,name,event_date,updated_at,organizations(name)').eq('review_status', 'pending_review');
  if (eventId) pendingEventsQuery = pendingEventsQuery.eq('id', eventId);
  if (from && !range.error) pendingEventsQuery = pendingEventsQuery.gte('event_date', from);
  if (to && !range.error) pendingEventsQuery = pendingEventsQuery.lte('event_date', to);
  let registrationsQuery = db.from('registrations').select('id', { count: 'exact', head: true });
  if (eventId) registrationsQuery = registrationsQuery.eq('event_id', eventId);
  if (range.from) registrationsQuery = registrationsQuery.gte('created_at', range.from);
  if (range.toExclusive) registrationsQuery = registrationsQuery.lt('created_at', range.toExclusive);
  const [eventCount, organizerCount, liveCount, registrationCount, pendingEvents, pendingOrganizers, reconciliationCount, emailCount, eventOptions, platformRevenue] = await Promise.all([
    eventsQuery().eq('review_status', 'pending_review'),
    db.from('organizer_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    eventsQuery().in('lifecycle_status', ['published', 'ongoing']).eq('review_status', 'approved'),
    registrationsQuery,
    pendingEventsQuery.order('updated_at', { ascending: true }).limit(5),
    db.from('organizer_verifications').select('organization_id,submitted_at,organizations!inner(name)').eq('status', 'pending_review').order('submitted_at', { ascending: true }).limit(5),
    db.from('finance_reconciliation_records').select('id', { count: 'exact', head: true }).eq('discrepancy_status', 'open'),
    db.from('email_messages').select('id', { count: 'exact', head: true }).in('status', ['failed', 'bounced', 'suppressed']),
    db.from('events').select('id,name').order('event_date', { ascending: false }),
    getCollectedPlatformRevenue(db, eventId, range),
  ]);
  const loadFailed = [eventCount, organizerCount, liveCount, registrationCount, pendingEvents, pendingOrganizers, reconciliationCount, emailCount, eventOptions, platformRevenue].some((result) => result.error);
  const eventRows = pendingEvents.data ?? [];
  const organizerRows = pendingOrganizers.data ?? [];
  const issueCount = (reconciliationCount.count ?? 0) + (emailCount.count ?? 0);

  return <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
    <DashboardFilters events={eventOptions.data ?? []} from={from} to={to} eventId={eventId} />
    {loadFailed && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle size={18} aria-hidden="true" /> Some dashboard data could not be loaded. Unavailable counts are shown as a dash; refresh to try again.</p>}
    {range.error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{range.error}</p>}
    <section aria-label="Platform metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Events awaiting review" value={eventCount.error ? null : eventCount.count} href="/admin/events?review=pending_review" icon={CalendarDays} />
      <Metric label="Organizers awaiting review" value={organizerCount.error ? null : organizerCount.count} href="/admin/organizers" icon={Users} />
      <Metric label="Public events" value={liveCount.error ? null : liveCount.count} href="/admin/events" icon={CheckCircle2} />
      <Metric label="Registrations" value={registrationCount.error ? null : registrationCount.count} href="/admin/participants" icon={Users} />
      <Metric label="Platform revenue collected" value={platformRevenue.error ? null : formatCurrencyTotals(platformRevenue.data ?? new Map())} href="/admin/finance/platform-fees?status=collected" icon={Scale} />
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-extrabold text-[#071b41]">Event review queue</h2><Link href="/admin/events?review=pending_review" className="text-sm font-bold text-orange-600">View all <ArrowRight size={15} className="inline" /></Link></div>
        {pendingEvents.error ? <p className="p-5 text-sm text-red-700">Event submissions could not be loaded.</p> : eventRows.length ? <ul className="divide-y divide-slate-100">{eventRows.map((event) => <li key={event.id}><Link href={`/admin/events/${event.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"><span className="min-w-0"><span className="block truncate font-bold text-[#071b41]">{event.name}</span><span className="block text-xs text-slate-500">{event.organizations?.name ?? 'Organizer unavailable'} · Event {new Date(event.event_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</span></span><ArrowRight size={17} className="shrink-0 text-orange-600" /></Link></li>)}</ul> : <QueueEmptyState icon={CalendarDays} title="No events waiting for review" description="New event submissions will appear here." />}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-extrabold text-[#071b41]">Organizer review queue</h2><Link href="/admin/organizers?status=pending_review" className="text-sm font-bold text-orange-600">View all <ArrowRight size={15} className="inline" /></Link></div>
        {pendingOrganizers.error ? <p className="p-5 text-sm text-red-700">Organizer applications could not be loaded.</p> : organizerRows.length ? <ul className="divide-y divide-slate-100">{organizerRows.map((item) => <li key={item.organization_id}><Link href={`/admin/organizers/${item.organization_id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"><span className="min-w-0"><span className="block truncate font-bold text-[#071b41]">{item.organizations?.name ?? 'Unnamed organization'}</span><span className="block text-xs text-slate-500">{item.submitted_at ? `Submitted ${new Date(item.submitted_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}` : 'Submission date unavailable'}</span></span><ArrowRight size={17} className="shrink-0 text-orange-600" /></Link></li>)}</ul> : <QueueEmptyState icon={Users} title="No organizer applications waiting for review" description="New applications will appear here." />}
      </section>
    </div>
    {(issueCount > 0 || reconciliationCount.error || emailCount.error) && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-extrabold text-[#071b41]">Operations needing attention</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Link href="/admin/finance/reconciliation" className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-orange-300"><Scale size={20} className="text-orange-600" /><span className="font-semibold">{reconciliationCount.error ? 'Reconciliation unavailable' : `${reconciliationCount.count ?? 0} open discrepancies`}</span></Link><Link href="/admin/email-delivery" className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-orange-300"><MailWarning size={20} className="text-orange-600" /><span className="font-semibold">{emailCount.error ? 'Email delivery unavailable' : `${emailCount.count ?? 0} delivery issues`}</span></Link></div></section>}
  </main>;
}
