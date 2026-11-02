'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BarChart3, CalendarDays, ChevronDown, ClipboardList, FileText, Settings2, Users } from 'lucide-react';

export type EventWorkspaceEvent = {
  id: string;
  name: string;
  event_date: string;
  start_time: string | null;
  venue: string | null;
  lifecycle_status: string;
  review_status: string;
  registration_availability: string;
  overall_capacity: number | null;
  review_feedback: string | null;
};

export type EventWorkspaceOverview = {
  total_registrations: number;
  confirmed_registrations: number;
  gross_sales: number;
  recent_registrations: Array<{ id: string; status: string }>;
  recent_payments: Array<{ amount_paid: number; status: string }>;
};

type EventWorkspaceContextValue = {
  event: EventWorkspaceEvent | null;
};

const EventWorkspaceContext = createContext<EventWorkspaceContextValue>({ event: null });
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

function localDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(date);
}

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
    <details className="group relative shrink-0">
      <summary aria-current={isActive ? 'page' : undefined} className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 [&::-webkit-details-marker]:hidden ${isActive ? 'bg-[#0b2b5b] text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
        <Icon size={16} aria-hidden="true" />
        <span>{activeItem?.[0] ?? label}</span>
        <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <div className={`absolute ${label === 'Results & Reports' ? 'right-0' : 'left-0'} top-full z-50 mt-2 max-h-[min(70vh,30rem)] min-w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl`}>
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
  const [loadMessage, setLoadMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/organizer/events/${eventId}/summary`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? 'Event workspace could not be loaded.');
    setEvent(body.event as EventWorkspaceEvent);
  }, [eventId]);

  useEffect(() => {
    if (isPreview) return;
    let active = true;
    setEvent(null);
    setLoadMessage('');
    void load().catch((error) => { if (active) setLoadMessage(error instanceof Error ? error.message : 'Event workspace could not be loaded.'); });
    return () => { active = false; };
  }, [isPreview, load]);

  async function runWorkflow(action: 'submit' | 'publish') {
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
  const statusColor = event?.lifecycle_status === 'published' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : event?.lifecycle_status === 'cancelled' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-amber-50 text-amber-900 ring-amber-200';
  const context = useMemo(() => ({ event }), [event]);

  if (isPreview) return <>{children}</>;

  return (
    <EventWorkspaceContext.Provider value={context}>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href="/organizer/events" className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 hover:text-orange-800"><ArrowLeft size={14} aria-hidden="true" /> All events</Link>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="truncate text-lg font-extrabold text-[#071b41] sm:text-xl">{event?.name ?? (loadMessage ? 'Event workspace' : 'Loading event…')}</h2>
                {event && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ring-1 ${statusColor}`}>{titleCase(event.lifecycle_status)} <span className="mx-1 opacity-50">·</span> {titleCase(event.review_status)}</span>}
              </div>
              {event && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={14} aria-hidden="true" />{localDate(event.event_date)}{event.venue && <><span aria-hidden="true">·</span><span className="max-w-xs truncate">{event.venue}</span></>}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link href={`/organizer/events/${eventId}/preview`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">Preview <ArrowUpRight size={15} aria-hidden="true" /></Link>
              {canSubmit && <button type="button" disabled={busy} onClick={() => void runWorkflow('submit')} className="min-h-10 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Submitting…' : 'Submit for review'}</button>}
              {canPublish && <button type="button" disabled={busy} onClick={() => void runWorkflow('publish')} className="min-h-10 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Publishing…' : 'Publish event'}</button>}
            </div>
          </div>
          {(notice || loadMessage) && <p role={notice ? 'status' : 'alert'} className={`mt-3 rounded-lg border px-3 py-2 text-sm ${notice ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{notice || loadMessage}</p>}
          <nav aria-label="Event workspace" className="mt-4 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-3">
            {directLinks.map(({ label, path, icon: Icon }) => {
              const href = `/organizer/events/${eventId}${path ? `/${path}` : ''}`;
              const active = pathname === href;
              return <Link key={path} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? 'bg-[#0b2b5b] text-white' : 'text-slate-700 hover:bg-slate-100'}`}><Icon size={16} aria-hidden="true" />{label}</Link>;
            })}
            {groups.map((group) => <WorkspaceMenu key={group.label} eventId={eventId} label={group.label} icon={group.icon} links={group.links} pathname={pathname} />)}
          </nav>
        </div>
      </div>
      {children}
    </EventWorkspaceContext.Provider>
  );
}
