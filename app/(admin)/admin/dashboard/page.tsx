import Link from 'next/link';
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, MailWarning, Scale, Users } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function QueueEmptyState({ icon: Icon, title, description }: { icon: typeof CalendarDays; title: string; description: string }) {
  return <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center" role="status">
    <span className="grid h-14 w-14 place-items-center rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-100"><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span>
    <p className="mt-3 text-sm font-bold text-slate-800">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{description}</p>
  </div>;
}

function Metric({ label, value, href, icon: Icon, attention = false }: {
  label: string; value: number | null; href: string; icon: typeof CalendarDays; attention?: boolean;
}) {
  return <Link href={href} className={`group flex items-center justify-between rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${attention && value ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'}`}>
    <div><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-2 text-3xl font-black text-[#071b41]">{value == null ? '—' : value.toLocaleString()}</p></div>
    <span className={`grid h-11 w-11 place-items-center rounded-xl ${attention && value ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-[#071b41]'}`}><Icon size={21} aria-hidden="true" /></span>
  </Link>;
}

export default async function AdminDashboardPage() {
  const db = createAdminClient();
  const [eventCount, organizerCount, liveCount, registrationCount, pendingEvents, pendingOrganizers, reconciliationCount, emailCount] = await Promise.all([
    db.from('events').select('id', { count: 'exact', head: true }).eq('review_status', 'pending_review'),
    db.from('organizer_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    db.from('events').select('id', { count: 'exact', head: true }).in('lifecycle_status', ['published', 'ongoing']).eq('review_status', 'approved'),
    db.from('registrations').select('id', { count: 'exact', head: true }),
    db.from('events').select('id,name,event_date,updated_at,organizations(name)').eq('review_status', 'pending_review').order('updated_at', { ascending: true }).limit(5),
    db.from('organizer_verifications').select('organization_id,submitted_at,organizations!inner(name)').eq('status', 'pending_review').order('submitted_at', { ascending: true }).limit(5),
    db.from('finance_reconciliation_records').select('id', { count: 'exact', head: true }).eq('discrepancy_status', 'open'),
    db.from('email_messages').select('id', { count: 'exact', head: true }).in('status', ['failed', 'bounced', 'suppressed']),
  ]);
  const loadFailed = [eventCount, organizerCount, liveCount, registrationCount, pendingEvents, pendingOrganizers, reconciliationCount, emailCount].some((result) => result.error);
  const eventRows = pendingEvents.data ?? [];
  const organizerRows = pendingOrganizers.data ?? [];
  const issueCount = (reconciliationCount.count ?? 0) + (emailCount.count ?? 0);

  return <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
    {loadFailed && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle size={18} aria-hidden="true" /> Some dashboard data could not be loaded. Unavailable counts are shown as a dash; refresh to try again.</p>}
    <section aria-label="Platform metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Events awaiting review" value={eventCount.error ? null : eventCount.count} href="/admin/events?review=pending_review" icon={CalendarDays} attention />
      <Metric label="Organizers awaiting review" value={organizerCount.error ? null : organizerCount.count} href="/admin/organizers" icon={Users} attention />
      <Metric label="Public events" value={liveCount.error ? null : liveCount.count} href="/admin/events" icon={CheckCircle2} />
      <Metric label="Registrations" value={registrationCount.error ? null : registrationCount.count} href="/admin/participants" icon={Users} />
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-extrabold text-[#071b41]">Event review queue</h2><p className="text-sm text-slate-500">Oldest submissions first</p></div><Link href="/admin/events?review=pending_review" className="text-sm font-bold text-orange-600">View all <ArrowRight size={15} className="inline" /></Link></div>
        {pendingEvents.error ? <p className="p-5 text-sm text-red-700">Event submissions could not be loaded.</p> : eventRows.length ? <ul className="divide-y divide-slate-100">{eventRows.map((event) => <li key={event.id}><Link href={`/admin/events/${event.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"><span className="min-w-0"><span className="block truncate font-bold text-[#071b41]">{event.name}</span><span className="block text-xs text-slate-500">{event.organizations?.name ?? 'Organizer unavailable'} · Event {new Date(event.event_date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</span></span><ArrowRight size={17} className="shrink-0 text-orange-600" /></Link></li>)}</ul> : <QueueEmptyState icon={CalendarDays} title="No events waiting for review" description="New event submissions will appear here." />}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-extrabold text-[#071b41]">Organizer review queue</h2><p className="text-sm text-slate-500">Open an application to review its documents</p></div><Link href="/admin/organizers?status=pending_review" className="text-sm font-bold text-orange-600">View all <ArrowRight size={15} className="inline" /></Link></div>
        {pendingOrganizers.error ? <p className="p-5 text-sm text-red-700">Organizer applications could not be loaded.</p> : organizerRows.length ? <ul className="divide-y divide-slate-100">{organizerRows.map((item) => <li key={item.organization_id}><Link href={`/admin/organizers/${item.organization_id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"><span className="min-w-0"><span className="block truncate font-bold text-[#071b41]">{item.organizations?.name ?? 'Unnamed organization'}</span><span className="block text-xs text-slate-500">{item.submitted_at ? `Submitted ${new Date(item.submitted_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}` : 'Submission date unavailable'}</span></span><ArrowRight size={17} className="shrink-0 text-orange-600" /></Link></li>)}</ul> : <QueueEmptyState icon={Users} title="No organizer applications waiting for review" description="New applications will appear here." />}
      </section>
    </div>
    {(issueCount > 0 || reconciliationCount.error || emailCount.error) && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-extrabold text-[#071b41]">Operations needing attention</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Link href="/admin/finance/reconciliation" className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-orange-300"><Scale size={20} className="text-orange-600" /><span className="font-semibold">{reconciliationCount.error ? 'Reconciliation unavailable' : `${reconciliationCount.count ?? 0} open discrepancies`}</span></Link><Link href="/admin/email-delivery" className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-orange-300"><MailWarning size={20} className="text-orange-600" /><span className="font-semibold">{emailCount.error ? 'Email delivery unavailable' : `${emailCount.count ?? 0} delivery issues`}</span></Link></div></section>}
  </main>;
}
