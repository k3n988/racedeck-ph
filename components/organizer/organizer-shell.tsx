'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const groups = [
  { label: '', items: [['Dashboard', '/organizer/dashboard', '▦']] },
  { label: '', items: [['Events', '/organizer/events', '▤'], ['Registrations', '/organizer/registrations', '◎']] },
  { label: 'Finance', items: [['Payments', '/organizer/payments', '▭'], ['Payouts', '/organizer/payouts', '▣']] },
  { label: 'Analytics', items: [['Reports', '/organizer/reports', '▥']] },
  { label: 'Organization', items: [['Team Members', '/organizer/team-members', '♙'], ['Organization', '/organizer/organization', '◇'], ['Settings', '/organizer/settings', '⚙']] },
] as const;

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard', events: 'Events', registrations: 'Registrations', payments: 'Payments', payouts: 'Payouts', reports: 'Reports', 'team-members': 'Team Members', organization: 'Organization', settings: 'Settings', create: 'Create Event', preview: 'Preview', results: 'Results', announcements: 'Announcements', 'promo-codes': 'Promo Codes', 'race-kit-claiming': 'Race Kit Claiming', 'bib-management': 'Bib Management', 'registration-form': 'Registration Form', waiver: 'Waiver', 'categories-pricing': 'Categories & Pricing', 'race-kit-config': 'Race Kit Configuration', details: 'Event Details', 'email-reminders': 'Email & Reminders', 'certificate-settings': 'Certificate Settings',
};

function pageTitle(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const organizerIndex = segments.indexOf('organizer');
  const routeSegments = organizerIndex >= 0 ? segments.slice(organizerIndex + 1) : segments;
  if (routeSegments[0] === 'events' && routeSegments[1] && routeSegments[1] !== 'create') return routeLabels[routeSegments[2]] ?? 'Event Workspace';
  const segment = routeSegments.at(-1) ?? 'dashboard';
  return routeLabels[segment] ?? segment.replaceAll('-', ' ');
}

export default function OrganizerShell({ children, email }: { children: React.ReactNode; email?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const initials = (email ?? 'OR').slice(0, 2).toUpperCase();
  const updateEventFilters = (key: string, value: string) => { const next = new URLSearchParams(searchParams.toString()); if (value) next.set(key, value); else next.delete(key); router.replace(`/organizer/events${next.toString() ? `?${next.toString()}` : ''}`); };
  const eventList = pathname === '/organizer/events';
  return <div className="min-h-screen bg-[#f5f7fa] lg:flex"><div className={`fixed inset-0 z-40 bg-slate-950/50 transition lg:hidden ${open ? 'visible opacity-100' : 'invisible opacity-0'}`} onClick={() => setOpen(false)} aria-hidden="true" /><aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#101827] text-white shadow-xl transition-transform lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}><div className="flex items-center justify-between border-b border-white/10 px-6 py-6"><Link href="/organizer/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 font-black">R</span><span className="font-black tracking-tight">RACE<span className="text-orange-400">DECK</span></span></Link><button onClick={() => setOpen(false)} className="text-xl text-white/60 lg:hidden" aria-label="Close menu">×</button></div><div className="px-6 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">Organizer Portal</p><p className="mt-1 text-xs text-white/45">Race operations workspace</p></div><nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-6" aria-label="Organizer navigation">{groups.map((group, index) => <div key={`${group.label}-${index}`}>{group.label && <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{group.label}</p>}<div className="space-y-1">{group.items.map(([label, href, icon]) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><span className="w-5 text-center text-lg text-white/65">{icon}</span>{label}</Link>; })}</div></div>)}</nav><div className="border-t border-white/10 p-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700">{initials}</span><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{email ?? 'Organizer'}</p><p className="text-[11px] text-white/45">Account settings</p></div></div><Link href="/auth/logout" className="mt-4 block text-xs font-semibold text-white/55 hover:text-white">Sign out</Link></div></aside><div className="min-w-0 flex-1"><header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 sm:px-6"><button onClick={() => setOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-lg lg:hidden" aria-label="Open menu">☰</button><h1 className="text-lg font-bold text-slate-800">{pageTitle(pathname)}</h1>{eventList && <><input defaultValue={searchParams.get('search') ?? ''} onChange={(event) => updateEventFilters('search', event.target.value)} placeholder="Search event name..." aria-label="Search event name" className="ml-auto min-w-40 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm md:max-w-md" /><select value={searchParams.get('lifecycle_status') ?? ''} onChange={(event) => updateEventFilters('lifecycle_status', event.target.value)} aria-label="Lifecycle status" className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All lifecycle statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><Link href="/organizer/events/create" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white">+ Create event</Link></>}</div></header>{children}</div></div>;
}
