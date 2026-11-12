'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  Download,
  HandCoins,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Settings,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { RegistrationsHeaderContext, type RegistrationHeaderActions, useRegistrationsHeader } from './registrations-header-context';

const navigationGroups: { label?: string; items: { label: string; href: string; icon: LucideIcon }[] }[] = [
  { items: [{ label: 'Dashboard', href: '/organizer/dashboard', icon: LayoutDashboard }] },
  { items: [{ label: 'Events', href: '/organizer/events', icon: CalendarDays }, { label: 'Registrations', href: '/organizer/registrations', icon: UsersRound }] },
  { label: 'Finance', items: [{ label: 'Payments', href: '/organizer/payments', icon: CreditCard }, { label: 'Payouts', href: '/organizer/payouts', icon: HandCoins }] },
  { label: 'Analytics', items: [{ label: 'Reports', href: '/organizer/reports', icon: BarChart3 }] },
];

const settingsItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Organization details', href: '/organizer/organization', icon: Building2 },
  { label: 'Payment profiles', href: '/organizer/payment-profiles', icon: CreditCard },
  { label: 'Staff', href: '/organizer/team-members', icon: UsersRound },
  { label: 'Verification', href: '/organizer/verification', icon: BadgeCheck },
];

const settingsSoonItems = ['Integrations', 'Validation lists'] as const;

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard', events: 'Events', registrations: 'Registrations', payments: 'Payments', payouts: 'Payouts',
  'payment-profiles': 'Payment profiles', reports: 'Reports', 'team-members': 'Team Members', organization: 'Organization details',
  settings: 'Settings', create: 'Create Event', preview: 'Preview', results: 'Results', announcements: 'Announcements',
  'promo-codes': 'Promo Codes', 'race-kit-claiming': 'Race Kit Claiming', 'bib-management': 'Bib Management',
  'registration-form': 'Registration Form', waiver: 'Waiver', 'categories-pricing': 'Categories & Pricing',
  'race-kit-config': 'Race Kit Configuration', details: 'Event Details', 'email-reminders': 'Email & Reminders',
  'certificate-settings': 'Certificate Settings',
};

function pageTitle(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const organizerIndex = segments.indexOf('organizer');
  const routeSegments = organizerIndex >= 0 ? segments.slice(organizerIndex + 1) : segments;
  if (routeSegments[0] === 'events' && routeSegments[1] && routeSegments[1] !== 'create') {
    if (routeSegments[2] === 'preview') return 'Preview';
    if (routeSegments[2] === 'registrations') return 'Registrations';
    return 'Event Workspace';
  }
  const segment = routeSegments.at(-1) ?? 'dashboard';
  return routeLabels[segment] ?? segment.replaceAll('-', ' ');
}

function OrganizerShellContent({ children, email }: { children: React.ReactNode; email?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fromDate, toDate, setFromDate, setToDate, actions, dashboardControls } = useRegistrationsHeader();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const initials = (email ?? 'OR').slice(0, 2).toUpperCase();
  const eventList = pathname === '/organizer/events';
  const eventIdForPreview = pathname.match(/^\/organizer\/events\/([^/]+)/)?.[1];
  const previewHref = eventIdForPreview && eventIdForPreview !== 'create' && !pathname.endsWith('/preview')
    ? `/organizer/events/${eventIdForPreview}/preview`
    : null;
  const settingsActive = settingsItems.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const updateEventFilters = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/organizer/events${next.toString() ? `?${next.toString()}` : ''}`);
  }, [router, searchParams]);

  useEffect(() => { closeMobileNav(); }, [pathname, closeMobileNav]);
  useEffect(() => { if (settingsActive) setSettingsOpen(true); }, [settingsActive]);
  useEffect(() => {
    const desktopLayout = window.matchMedia('(min-width: 1024px)');
    const closeDrawerOnDesktop = () => { if (desktopLayout.matches) closeMobileNav(); };
    desktopLayout.addEventListener('change', closeDrawerOnDesktop);
    return () => desktopLayout.removeEventListener('change', closeDrawerOnDesktop);
  }, [closeMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileNav();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (!window.matchMedia('(min-width: 1024px)').matches) menuButtonRef.current?.focus();
    };
  }, [closeMobileNav, mobileNavOpen]);

  return (
    <div className="min-h-screen bg-[#f5f7fa] lg:flex">
      <button
        type="button"
        tabIndex={mobileNavOpen ? 0 : -1}
        aria-label="Close organizer navigation"
        onClick={closeMobileNav}
        className={`fixed inset-0 z-40 bg-slate-950/55 transition-opacity duration-200 lg:hidden ${mobileNavOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
      />

      <aside
        id="organizer-sidebar"
        ref={sidebarRef}
        role={mobileNavOpen ? 'dialog' : undefined}
        aria-modal={mobileNavOpen ? true : undefined}
        aria-label="Organizer navigation"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col bg-[#101827] text-white shadow-xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${mobileNavOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible'}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
          <Link href="/organizer/dashboard" onClick={closeMobileNav} className="flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 font-black">R</span>
            <span className="font-black tracking-tight">RACE<span className="text-orange-400">DECK</span></span>
          </Link>
          <button ref={closeButtonRef} type="button" onClick={closeMobileNav} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 lg:hidden" aria-label="Close menu">
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <nav className="scrollbar-hidden min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-5 pt-4" aria-label="Main menu">
          {navigationGroups.map((group, index) => (
            <div key={`${group.label ?? 'main'}-${index}`}>
              {group.label && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{group.label}</p>}
              <div className="space-y-1">
                {group.items.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={closeMobileNav}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${active ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                    >
                      <Icon aria-hidden="true" size={18} className={active ? 'text-orange-300' : 'text-white/60'} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <button
              type="button"
              aria-expanded={settingsOpen}
              aria-controls="organizer-settings-links"
              onClick={() => setSettingsOpen((value) => !value)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${settingsActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <Settings aria-hidden="true" size={18} className="text-white/60" />
              <span className="flex-1">Settings</span>
              <ChevronRight aria-hidden="true" size={16} className={`transition-transform ${settingsOpen ? 'rotate-90' : ''}`} />
            </button>
            {settingsOpen && (
              <div id="organizer-settings-links" className="ml-4 mt-1 space-y-1 border-l border-white/15 pl-3">
                {settingsItems.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link key={href} href={href} onClick={closeMobileNav} aria-current={active ? 'page' : undefined} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${active ? 'bg-orange-500/15 font-semibold text-orange-200' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>
                      <Icon aria-hidden="true" size={16} className="shrink-0" />{label}
                    </Link>
                  );
                })}
                <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                  {settingsSoonItems.map((label) => <div key={label} aria-disabled="true" className="flex min-h-9 items-center justify-between rounded-lg px-3 text-xs text-white/40"><span>{label}</span><span className="text-[9px] font-bold uppercase tracking-wide">Soon</span></div>)}
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700">{initials}</span>
            <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{email ?? 'Organizer'}</p><p className="text-[11px] text-white/50">Organizer account</p></div>
          </div>
          <Link href="/auth/logout" onClick={closeMobileNav} className="mt-3 inline-flex min-h-9 items-center text-xs font-semibold text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400">Sign out</Link>
        </div>
      </aside>

      <div className="min-h-screen min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
          <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open organizer navigation"
              aria-controls="organizer-sidebar"
              aria-expanded={mobileNavOpen}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 lg:hidden"
            >
              <Menu aria-hidden="true" size={19} />
            </button>
            <h1 className="shrink-0 text-lg font-bold capitalize text-slate-800">{pageTitle(pathname)}</h1>

            {previewHref && <Link href={previewHref} className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">Preview <ArrowUpRight aria-hidden="true" size={15} /></Link>}

            {pathname === '/organizer/dashboard' && dashboardControls}

            {eventList && <>
              <input defaultValue={searchParams.get('search') ?? ''} onChange={(event) => updateEventFilters('search', event.target.value)} placeholder="Search event name..." aria-label="Search event name" className="ml-auto min-w-40 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 md:max-w-md" />
              <select value={searchParams.get('lifecycle_status') ?? ''} onChange={(event) => updateEventFilters('lifecycle_status', event.target.value)} aria-label="Lifecycle status" className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
                <option value="">All lifecycle statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
              </select>
              <Link href="/organizer/events/create" className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700">+ Create event</Link>
            </>}

            {pathname === '/organizer/registrations' && <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-600"><span className="whitespace-nowrap">Registered from</span><CalendarDays aria-hidden="true" size={15} /><input aria-label="Registered from" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="w-[132px] bg-transparent text-sm font-medium text-slate-800 outline-none" /></label>
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-600"><span className="whitespace-nowrap">Registered to</span><CalendarDays aria-hidden="true" size={15} /><input aria-label="Registered to" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="w-[132px] bg-transparent text-sm font-medium text-slate-800 outline-none" /></label>
              <button type="button" onClick={() => actions?.onExport()} disabled={!actions || actions.exportDisabled} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0b2b5b] px-3.5 text-sm font-bold text-white hover:bg-[#123b78] disabled:cursor-not-allowed disabled:opacity-50"><Download aria-hidden="true" size={16} />Export CSV</button>
              <button type="button" onClick={() => actions ? actions.onRefresh() : router.refresh()} disabled={actions?.refreshing ?? false} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw aria-hidden="true" size={15} className={actions?.refreshing ? 'animate-spin' : ''} />{actions?.refreshing ? 'Refreshing…' : 'Refresh'}</button>
            </div>}

            {pathname === '/organizer/payments' && <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <button type="button" onClick={() => actions?.onExport()} disabled={!actions || actions.exportDisabled} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0b2b5b] px-3.5 text-sm font-bold text-white hover:bg-[#123b78] disabled:cursor-not-allowed disabled:opacity-50"><Download aria-hidden="true" size={16} />Export CSV</button>
              <button type="button" onClick={() => actions ? actions.onRefresh() : router.refresh()} disabled={actions?.refreshing ?? false} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw aria-hidden="true" size={15} className={actions?.refreshing ? 'animate-spin' : ''} />{actions?.refreshing ? 'Refreshing…' : 'Refresh'}</button>
            </div>}

            {pathname === '/organizer/payouts' && <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <button type="button" onClick={() => actions?.onExport()} disabled={!actions || actions.exportDisabled} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0b2b5b] px-3.5 text-sm font-bold text-white hover:bg-[#123b78] disabled:cursor-not-allowed disabled:opacity-50"><Download aria-hidden="true" size={16} />Export CSV</button>
              <button type="button" onClick={() => actions ? actions.onRefresh() : router.refresh()} disabled={actions?.refreshing ?? false} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw aria-hidden="true" size={15} className={actions?.refreshing ? 'animate-spin' : ''} />{actions?.refreshing ? 'Refreshing…' : 'Refresh'}</button>
            </div>}

            {pathname === '/organizer/reports' && <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <button type="button" onClick={() => actions?.onExport()} disabled={!actions || actions.exportDisabled} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0b2b5b] px-3.5 text-sm font-bold text-white hover:bg-[#123b78] disabled:cursor-not-allowed disabled:opacity-50"><Download aria-hidden="true" size={16} />Export CSV</button>
              <button type="button" onClick={() => actions ? actions.onRefresh() : router.refresh()} disabled={actions?.refreshing ?? true} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw aria-hidden="true" size={15} className={actions?.refreshing ? 'animate-spin' : ''} />{actions?.refreshing ? 'Refreshing…' : 'Refresh'}</button>
            </div>}
          </div>
        </header>
        <div id="organizer-main-content" className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export default function OrganizerShell({ children, email }: { children: React.ReactNode; email?: string }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actions, setActions] = useState<RegistrationHeaderActions | null>(null);
  const [dashboardControls, setDashboardControls] = useState<React.ReactNode | null>(null);
  return (
    <RegistrationsHeaderContext.Provider value={{ fromDate, toDate, setFromDate, setToDate, actions, setActions, dashboardControls, setDashboardControls }}>
      <OrganizerShellContent email={email}>{children}</OrganizerShellContent>
    </RegistrationsHeaderContext.Provider>
  );
}
