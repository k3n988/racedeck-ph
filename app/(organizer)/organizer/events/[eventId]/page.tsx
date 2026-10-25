'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  Flag,
  Megaphone,
  PackageCheck,
  Settings2,
  Shirt,
  TicketCheck,
  Users,
} from 'lucide-react';

type Event = {
  id: string;
  name: string;
  event_date: string;
  lifecycle_status: string;
  review_status: string;
  registration_availability: string;
  overall_capacity: number | null;
  review_feedback: string | null;
};
type Overview = {
  total_registrations: number;
  confirmed_registrations: number;
  gross_sales: number;
  recent_registrations: Array<{ id: string; status: string }>;
  recent_payments: Array<{ amount_paid: number; status: string }>;
};
type WorkspaceLink = {
  label: string;
  href: string;
  description: string;
  icon: typeof FileText;
};

const setupLinks: WorkspaceLink[] = [
  { label: 'Event Details', href: 'setup/details', description: 'Update event information and schedule.', icon: FileText },
  { label: 'Categories & Pricing', href: 'setup/categories-pricing', description: 'Set race distances, fees, and slots.', icon: TicketCheck },
  { label: 'Registration Form', href: 'setup/registration-form', description: 'Choose the details participants provide.', icon: ClipboardList },
  { label: 'Waiver', href: 'setup/waiver', description: 'Manage participant terms and consent.', icon: FileText },
  { label: 'Race Kit', href: 'setup/race-kit-config', description: 'Configure kit items and sizes.', icon: Shirt },
  { label: 'Additional Merchandise', href: 'setup/merchandise', description: 'Manage optional event merchandise.', icon: PackageCheck },
  { label: 'Email Reminders', href: 'setup/email-reminders', description: 'Schedule reminders for registered participants.', icon: Megaphone },
  { label: 'Certificates', href: 'setup/certificate-settings', description: 'Configure participant certificates.', icon: FileText },
];
const operationsLinks: WorkspaceLink[] = [
  { label: 'Registrations', href: 'registrations', description: 'Review participants and registration status.', icon: Users },
  { label: 'Promo Codes', href: 'promo-codes', description: 'Create and manage registration discounts.', icon: TicketCheck },
  { label: 'Bib Management', href: 'bib-management', description: 'Assign and track participant bib numbers.', icon: ClipboardList },
  { label: 'Kit Claiming', href: 'race-kit-claiming', description: 'Coordinate race-kit pickup on event day.', icon: PackageCheck },
  { label: 'Announcements', href: 'announcements', description: 'Share event updates with participants.', icon: Megaphone },
];
const insightsLinks: WorkspaceLink[] = [
  { label: 'Results', href: 'results', description: 'Publish and manage race results.', icon: Flag },
  { label: 'Reports', href: 'reports', description: 'Review registration and sales reports.', icon: BarChart3 },
  { label: 'Settings', href: 'settings', description: 'Manage event controls and preferences.', icon: Settings2 },
];

const sections = (id: string) => [
  { label: 'Overview', href: `/organizer/events/${id}` },
  { label: 'Event Details', href: `/organizer/events/${id}/setup/details` },
  { label: 'Categories & Pricing', href: `/organizer/events/${id}/setup/categories-pricing` },
  { label: 'Registration Form', href: `/organizer/events/${id}/setup/registration-form` },
  { label: 'Waiver', href: `/organizer/events/${id}/setup/waiver` },
  { label: 'Race Kit', href: `/organizer/events/${id}/setup/race-kit-config` },
  { label: 'Additional Merchandise', href: `/organizer/events/${id}/setup/merchandise` },
  { label: 'Email Reminders', href: `/organizer/events/${id}/setup/email-reminders` },
  { label: 'Certificates', href: `/organizer/events/${id}/setup/certificate-settings` },
  { label: 'Registrations', href: `/organizer/events/${id}/registrations` },
  { label: 'Promo Codes', href: `/organizer/events/${id}/promo-codes` },
  { label: 'Bib Management', href: `/organizer/events/${id}/bib-management` },
  { label: 'Kit Claiming', href: `/organizer/events/${id}/race-kit-claiming` },
  { label: 'Announcements', href: `/organizer/events/${id}/announcements` },
  { label: 'Results', href: `/organizer/events/${id}/results` },
  { label: 'Reports', href: `/organizer/events/${id}/reports` },
  { label: 'Settings', href: `/organizer/events/${id}/settings` },
];

const pretty = (value: string) => value.replaceAll('_', ' ');
const formattedDate = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(date);
};

function WorkspaceGroup({ title, description, links, eventId }: { title: string; description: string; links: WorkspaceLink[]; eventId: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#071b41]">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map(({ label, href, description: itemDescription, icon: Icon }) => (
          <Link key={href} href={`/organizer/events/${eventId}/${href}`} className="group flex min-h-24 items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-orange-300 hover:bg-orange-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eef3fb] text-[#0b2a59] transition group-hover:bg-orange-100 group-hover:text-orange-700"><Icon size={19} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 font-semibold text-slate-900">{label}<ArrowUpRight size={15} className="shrink-0 text-slate-400 transition group-hover:text-orange-600" aria-hidden="true" /></span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">{itemDescription}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function OrganizerEventWorkspace({ params }: { params: { eventId: string } }) {
  const pathname = usePathname();
  const [event, setEvent] = useState<Event | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState('Loading workspace…');
  const [actionBusy, setActionBusy] = useState(false);

  async function refreshEvent() {
    const response = await fetch(`/api/organizer/events/${params.eventId}`, { cache: 'no-store' });
    const details = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(details.error ?? 'Event status could not be refreshed.');
    setEvent(details.event);
    setOverview(details.overview);
  }

  async function runWorkflow(action: 'submit' | 'publish') {
    setActionBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Event action could not be completed.');
      await refreshEvent();
      setMessage(action === 'submit' ? 'Event submitted for RaceDeck review.' : 'Event published.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Event action could not be completed.');
    } finally {
      setActionBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetch(`/api/organizer/events/${params.eventId}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Event could not be loaded.');
      if (!active) return;
      setEvent(body.event);
      setOverview(body.overview);
      setMessage('');
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Event could not be loaded.');
    });
    return () => { active = false; };
  }, [params.eventId]);

  if (!event) return <main className="mx-auto max-w-7xl p-6"><Link href="/organizer/events" className="text-sm font-semibold text-orange-700 hover:text-orange-800">← Back to events</Link><p role="status" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">{message}</p></main>;

  const canSubmit = event.lifecycle_status === 'draft' && ['not_submitted', 'needs_changes', 'rejected'].includes(event.review_status);
  const canPublish = event.lifecycle_status === 'draft' && event.review_status === 'approved';
  const statusTone = event.lifecycle_status === 'published' ? 'bg-emerald-100 text-emerald-800' : event.lifecycle_status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900';
  const metricCards = [
    { label: 'Registration status', value: pretty(event.registration_availability), note: 'Current signup availability', icon: TicketCheck },
    { label: 'Registrations', value: `${(overview?.confirmed_registrations ?? 0).toLocaleString()} confirmed`, note: `${(overview?.total_registrations ?? 0).toLocaleString()} total`, icon: Users },
    { label: 'Capacity', value: event.overall_capacity != null ? event.overall_capacity.toLocaleString() : 'Unlimited', note: 'Event-wide participant limit', icon: ClipboardList },
    { label: 'Gross sales', value: new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(overview?.gross_sales ?? 0), note: 'Recorded successful payments', icon: BarChart3 },
  ];

  return (
    <main className="mx-auto max-w-[1480px] space-y-5 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/organizer/events" className="text-sm font-bold text-orange-700 transition hover:text-orange-800">← All events</Link>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusTone}`}>{pretty(event.lifecycle_status)}</span>
          <Link href={`/organizer/events/${event.id}/preview`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400">Preview event<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </div>

      <header className="flex flex-col justify-between gap-4 rounded-2xl bg-[#071b41] px-5 py-6 text-white shadow-sm sm:flex-row sm:items-end sm:px-7">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">Event workspace</p>
          <h1 className="mt-2 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{event.name}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-200"><CalendarDays size={16} aria-hidden="true" />{formattedDate(event.event_date)}<span className="text-slate-400">·</span><span className="capitalize">{pretty(event.review_status)}</span></p>
        </div>
        {(canSubmit || canPublish) && <div className="flex shrink-0 flex-wrap gap-2">
          {canSubmit && <button disabled={actionBusy} onClick={() => void runWorkflow('submit')} className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50">{actionBusy ? 'Submitting…' : 'Submit for review'}</button>}
          {canPublish && <button disabled={actionBusy} onClick={() => void runWorkflow('publish')} className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50">{actionBusy ? 'Publishing…' : 'Publish event'}</button>}
        </div>}
      </header>

      {message && <p role="status" className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">{message}</p>}
      {event.lifecycle_status === 'draft' && event.review_status === 'pending_review' && <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">RaceDeck is reviewing this event. You can continue to monitor its status here.</p>}
      {event.review_feedback && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">RaceDeck review feedback</p><p className="mt-1 whitespace-pre-wrap">{event.review_feedback}</p></section>}

      <section aria-label="Event performance overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ label, value, note, icon: Icon }) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-xl font-extrabold capitalize text-[#071b41]">{value}</p></div><span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-orange-600"><Icon size={19} aria-hidden="true" /></span></div>
          <p className="mt-2 text-xs text-slate-500">{note}</p>
        </article>)}
      </section>

      <nav aria-label="Event workspace sections" className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {sections(params.eventId).map((item) => {
            const active = pathname === item.href;
            return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? 'bg-[#071b41] text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>{item.label}</Link>;
          })}
        </div>
      </nav>

      <div className="space-y-4">
        <WorkspaceGroup title="Event setup" description="Keep your public event information and registration options up to date." links={setupLinks} eventId={params.eventId} />
        <WorkspaceGroup title="Participant & race-day management" description="Manage registrations and coordinate event-day activities." links={operationsLinks} eventId={params.eventId} />
        <WorkspaceGroup title="Results & reporting" description="Publish outcomes and review how your event is performing." links={insightsLinks} eventId={params.eventId} />
      </div>
    </main>
  );
}
