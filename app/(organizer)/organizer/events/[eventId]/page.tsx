'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, BarChart3, CheckCircle2, Circle, ClipboardList, FileText, Flag, Megaphone, PackageCheck, Settings2, Shirt, TicketCheck, Users } from 'lucide-react';
import { EventWorkspaceOverview, useEventWorkspace } from '@/components/organizer/event-workspace-layout';

type WorkspaceLink = { label: string; href: string; description: string; icon: typeof FileText };

const setupLinks: WorkspaceLink[] = [
  { label: 'Event Details', href: 'setup/details', description: 'Update event information, schedule, and public page content.', icon: FileText },
  { label: 'Categories & Pricing', href: 'setup/categories-pricing', description: 'Set race distances, fees, and available slots.', icon: TicketCheck },
  { label: 'Registration Form', href: 'setup/registration-form', description: 'Choose the details participants provide.', icon: ClipboardList },
  { label: 'Waiver', href: 'setup/waiver', description: 'Manage participant terms and consent.', icon: FileText },
  { label: 'Race Kit', href: 'setup/race-kit-config', description: 'Configure kit items and size options.', icon: Shirt },
  { label: 'Additional Merchandise', href: 'setup/merchandise', description: 'Manage optional event merchandise.', icon: PackageCheck },
  { label: 'Email Reminders', href: 'setup/email-reminders', description: 'Schedule reminders for participants.', icon: Megaphone },
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

function WorkspaceGroup({ title, description, links, eventId }: { title: string; description: string; links: WorkspaceLink[]; eventId: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4"><h2 className="text-lg font-bold text-[#071b41]">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map(({ label, href, description: itemDescription, icon: Icon }) => (
          <Link key={href} href={`/organizer/events/${eventId}/${href}`} className="group flex min-h-24 items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-orange-300 hover:bg-orange-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eef3fb] text-[#0b2a59] transition group-hover:bg-orange-100 group-hover:text-orange-700"><Icon size={19} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 font-semibold text-slate-900">{label}<ArrowUpRight size={15} className="shrink-0 text-slate-400 transition group-hover:text-orange-600" aria-hidden="true" /></span><span className="mt-1 block text-sm leading-5 text-slate-500">{itemDescription}</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function pretty(value: string) { return value.replaceAll('_', ' '); }

export default function OrganizerEventWorkspace({ params }: { params: { eventId: string } }) {
  const { event, readiness } = useEventWorkspace();
  const [overview, setOverview] = useState<EventWorkspaceOverview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [contentPagesUnavailable, setContentPagesUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    setOverview(null);
    setOverviewError('');
    setContentPagesUnavailable(false);
    void fetch(`/api/organizer/events/${params.eventId}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Event overview could not be loaded.');
      if (!active) return;
      setOverview(body.overview as EventWorkspaceOverview);
      setContentPagesUnavailable(body.content_pages_available === false);
    }).catch((error) => {
      if (active) setOverviewError(error instanceof Error ? error.message : 'Event overview could not be loaded.');
    });
    return () => { active = false; };
  }, [params.eventId]);
  if (!event) return <main className="mx-auto max-w-7xl p-6"><p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading event overview…</p></main>;

  const metricCards = [
    { label: 'Registration status', value: pretty(event.effective_registration_availability), note: event.registration_availability_reason, icon: TicketCheck },
    { label: 'Registrations', value: overview ? `${overview.confirmed_registrations.toLocaleString()} confirmed` : overviewError ? 'Unavailable' : 'Loading…', note: overview ? `${overview.total_registrations.toLocaleString()} total` : 'Registration metrics', icon: Users },
    { label: 'Capacity', value: event.overall_capacity != null ? event.overall_capacity.toLocaleString() : 'Unlimited', note: 'Event-wide participant limit', icon: ClipboardList },
    { label: 'Gross sales', value: overview ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(overview.gross_sales) : overviewError ? 'Unavailable' : 'Loading…', note: 'Recorded successful payments', icon: BarChart3 },
  ];

  return (
    <main className="mx-auto max-w-[1480px] space-y-5 bg-[#f5f7fa] p-4 sm:p-6 lg:p-8">
      {overviewError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Event overview metrics could not be loaded: {overviewError}</p>}
      {contentPagesUnavailable && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Saved event content tabs are unavailable until the Supabase event-content-pages migration is applied.</p>}
      {event.lifecycle_status === 'draft' && event.review_status === 'pending_review' && <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">RaceDeck is reviewing this event. You can continue setup and monitor its status here.</p>}
      {event.review_feedback && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">RaceDeck review feedback</p><p className="mt-1 whitespace-pre-wrap">{event.review_feedback}</p></section>}
      {event.lifecycle_status === 'draft' && event.review_status !== 'pending_review' && readiness && <section aria-labelledby="event-readiness-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id="event-readiness-heading" className="text-lg font-bold text-[#071b41]">Before you submit</h2><p className="mt-1 text-sm text-slate-600">Complete the required checks. Optional setup sections can be finished later.</p></div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${readiness.can_submit ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{readiness.can_submit ? 'Ready for review' : `${readiness.checklist.filter((item) => !item.complete).length} items to fix`}</span>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {readiness.checklist.map((item) => <li key={item.label}>
            <Link href={`/organizer/events/${params.eventId}/${item.href}`} className="flex h-full items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-orange-300 hover:bg-orange-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              {item.complete ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle size={19} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />}
              <span><span className="block text-sm font-semibold text-slate-900">{item.label}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.detail}</span></span>
            </Link>
          </li>)}
        </ul>
      </section>}
      <section aria-label="Event performance overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ label, value, note, icon: Icon }) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-xl font-extrabold capitalize text-[#071b41]">{value}</p></div><span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-50 text-orange-600"><Icon size={19} aria-hidden="true" /></span></div><p className="mt-2 text-xs text-slate-500">{note}</p></article>)}
      </section>
      <div className="space-y-4">
        <WorkspaceGroup title="Event setup" description="Keep your public event information and registration options up to date." links={setupLinks} eventId={params.eventId} />
        <WorkspaceGroup title="Participant & race-day management" description="Manage registrations and coordinate event-day activities." links={operationsLinks} eventId={params.eventId} />
        <WorkspaceGroup title="Results & reporting" description="Publish outcomes and review event performance." links={insightsLinks} eventId={params.eventId} />
      </div>
    </main>
  );
}
