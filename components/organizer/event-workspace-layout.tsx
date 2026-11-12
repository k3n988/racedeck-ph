'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, ChevronDown, ClipboardList, FileText, Settings2, Users } from 'lucide-react';

export type EventWorkspaceEvent = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  event_date: string;
  start_time: string | null;
  venue: string | null;
  lifecycle_status: string;
  review_status: string;
  registration_availability: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  effective_registration_availability: string;
  registration_availability_reason: string;
  overall_capacity: number | null;
  review_feedback: string | null;
};

export type EventWorkspaceChecklistItem = { label: string; href: string; complete: boolean; detail: string };
export type EventWorkspaceReadiness = { checklist: EventWorkspaceChecklistItem[]; can_submit: boolean };

export type EventWorkspaceOverview = {
  total_registrations: number;
  confirmed_registrations: number;
  gross_sales: number;
  recent_registrations: Array<{ id: string; status: string }>;
  recent_payments: Array<{ amount_paid: number; status: string }>;
};

type EventWorkspaceContextValue = {
  event: EventWorkspaceEvent | null;
  readiness: EventWorkspaceReadiness | null;
};

const EventWorkspaceContext = createContext<EventWorkspaceContextValue>({ event: null, readiness: null });
export function useEventWorkspace() { return useContext(EventWorkspaceContext); }

const groups = [
  {
    label: 'Setup',
    icon: FileText,
    links: [
      ['Event Details', 'setup/details'],
      ['Categories & Pricing', 'setup/categories-pricing'],
      ['Registration Form', 'setup/registration-form'],
      ['Waiver', 'setup/waiver'],
      ['Race Kit', 'setup/race-kit-config'],
      ['Additional Merchandise', 'setup/merchandise'],
      ['Email Reminders', 'setup/email-reminders'],
      ['Certificates', 'setup/certificate-settings'],
    ],
  },
  {
    label: 'Operations',
    icon: Users,
    links: [
      ['Registrations', 'registrations'],
      ['Promo Codes', 'promo-codes'],
      ['Bib Management', 'bib-management'],
      ['Kit Claiming', 'race-kit-claiming'],
      ['Announcements', 'announcements'],
    ],
  },
  {
    label: 'Results & Reports',
    icon: BarChart3,
    links: [['Results', 'results'], ['Reports', 'reports']],
  },
] as const;

const directLinks = [
  { label: 'Overview', path: '' , icon: ClipboardList },
  { label: 'Settings', path: 'settings', icon: Settings2 },
] as const;

function titleCase(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function WorkspaceMenu({ eventId, label, icon: Icon, links, pathname }: {
  eventId: string;
  label: string;
  icon: typeof FileText;
  links: ReadonlyArray<readonly [string, string]>;
  pathname: string;
}) {
  const base = `/organizer/events/${eventId}`;
  const activeItem = links.find(([, path]) => pathname === `${base}${path ? `/${path}` : ''}`);
  const isActive = Boolean(activeItem);
  return (
    <details name="event-workspace-sections" className="group relative shrink-0">
      <summary aria-label={isActive ? `${label}, current section: ${activeItem?.[0]}` : label} className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 [&::-webkit-details-marker]:hidden ${isActive ? 'bg-[#0b2b5b] text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
        <Icon size={16} aria-hidden="true" />
        <span>{label}</span>
        {isActive && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-orange-400" />}
        <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <div className={`absolute ${label === 'Results & Reports' ? 'right-0' : 'left-0'} top-full z-50 mt-2 min-w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl`}>
        {links.map(([linkLabel, path]) => {
          const href = `${base}${path ? `/${path}` : ''}`;
          const active = pathname === href;
          return <Link key={path} href={href} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} aria-current={active ? 'page' : undefined} className={`block rounded-lg px-3 py-2.5 text-sm transition ${active ? 'bg-orange-50 font-bold text-orange-800' : 'text-slate-700 hover:bg-slate-50 hover:text-[#071b41]'}`}>{linkLabel}</Link>;
        })}
      </div>
    </details>
  );
}

export default function EventWorkspaceLayout({ eventId, children }: { eventId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isPreview = pathname.endsWith('/preview');
  const [event, setEvent] = useState<EventWorkspaceEvent | null>(null);
  const [readiness, setReadiness] = useState<EventWorkspaceReadiness | null>(null);
  const [loadMessage, setLoadMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/organizer/events/${eventId}/summary`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? 'Event workspace could not be loaded.');
    setEvent(body.event as EventWorkspaceEvent);
    setReadiness(Array.isArray(body.checklist) ? { checklist: body.checklist, can_submit: body.can_submit === true } : null);
  }, [eventId]);

  useEffect(() => {
    if (isPreview) return;
    let active = true;
    setEvent(null);
    setReadiness(null);
    setLoadMessage('');
    void load().catch((error) => { if (active) setLoadMessage(error instanceof Error ? error.message : 'Event workspace could not be loaded.'); });
    return () => { active = false; };
  }, [isPreview, load]);

  async function runWorkflow(action: 'submit' | 'publish') {
    if (!readiness || !readiness.can_submit) {
      setNotice('Complete the required items in the setup checklist before continuing.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(`/api/organizer/events/${eventId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Event action could not be completed.');
      await load();
      setNotice(action === 'submit' ? 'Event submitted for RaceDeck review.' : 'Event published successfully.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Event action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = event?.lifecycle_status === 'draft' && ['not_submitted', 'needs_changes', 'rejected'].includes(event.review_status);
  const canPublish = event?.lifecycle_status === 'draft' && event.review_status === 'approved';
  const statusColor = event?.review_status === 'pending_review' ? 'bg-blue-50 text-blue-800 ring-blue-200' : event?.lifecycle_status === 'published' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : event?.lifecycle_status === 'cancelled' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-amber-50 text-amber-900 ring-amber-200';
  const statusLabel = event?.review_status === 'pending_review' ? 'Pending Review' : event ? `${titleCase(event.lifecycle_status)} · ${titleCase(event.review_status)}` : '';
  const context = useMemo(() => ({ event, readiness }), [event, readiness]);
  const isRegistrationSection = pathname.startsWith(`/organizer/events/${eventId}/registrations`);

  if (isPreview) return <>{children}</>;

  return (
    <EventWorkspaceContext.Provider value={context}>
      {!isRegistrationSection && <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1480px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <Link href="/organizer/events" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-orange-700 hover:text-orange-800"><ArrowLeft size={14} aria-hidden="true" /> All events</Link>
              <h2 className="min-w-0 flex-1 basis-48 truncate text-lg font-extrabold text-[#071b41] sm:text-xl">{event?.name ?? (loadMessage ? 'Event workspace' : 'Loading event…')}</h2>
              {event && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${statusColor}`}>{statusLabel}</span>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canSubmit && <button type="button" disabled={busy || !readiness?.can_submit} title={!readiness?.can_submit ? 'Complete the event setup checklist before submitting.' : undefined} onClick={() => void runWorkflow('submit')} className="min-h-10 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Submitting…' : 'Submit for review'}</button>}
              {canPublish && <button type="button" disabled={busy || !readiness?.can_submit} title={!readiness?.can_submit ? 'Complete the event setup checklist before publishing.' : undefined} onClick={() => void runWorkflow('publish')} className="min-h-10 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Publishing…' : 'Publish event'}</button>}
            </div>
          </div>
          {(notice || loadMessage) && <ToastFeedback message={notice || loadMessage} tone={notice ? 'success' : 'error'} />}
          <nav aria-label="Event workspace sections" className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            {directLinks.map(({ label, path, icon: Icon }) => {
              const href = `/organizer/events/${eventId}${path ? `/${path}` : ''}`;
              const active = pathname === href;
              return <Link key={path} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? 'bg-[#0b2b5b] text-white' : 'text-slate-700 hover:bg-slate-100'}`}><Icon size={16} aria-hidden="true" />{label}</Link>;
            })}
            {groups.map((group) => <WorkspaceMenu key={group.label} eventId={eventId} label={group.label} icon={group.icon} links={group.links} pathname={pathname} />)}
          </nav>
        </div>
      </div>}
      {children}
    </EventWorkspaceContext.Provider>
  );
}
