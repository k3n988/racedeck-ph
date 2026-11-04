'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays, CreditCard, FileText, HandCoins, LayoutDashboard,
  LifeBuoy, Mail, Menu, Percent, RotateCcw, Scale, ScrollText, Settings,
  ShieldCheck, Users, X,
} from 'lucide-react';

const groups = [
  { label: 'Overview', items: [{ label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard }] },
  { label: 'Management', items: [
    { label: 'Organizers', href: '/admin/organizers', icon: Users },
    { label: 'Events', href: '/admin/events', icon: CalendarDays },
    { label: 'Participants', href: '/admin/participants', icon: Users },
  ] },
  { label: 'Finance', items: [
    { label: 'Transactions', href: '/admin/finance/transactions', icon: CreditCard },
    { label: 'Refunds', href: '/admin/finance/refunds', icon: RotateCcw },
    { label: 'Payouts', href: '/admin/finance/payouts', icon: HandCoins },
    { label: 'Platform Fees', href: '/admin/finance/platform-fees', icon: Percent },
    { label: 'Reconciliation', href: '/admin/finance/reconciliation', icon: Scale },
  ] },
  { label: 'Platform', items: [
    { label: 'Content Management', href: '/admin/content-management', icon: FileText },
    { label: 'Email Delivery', href: '/admin/email-delivery', icon: Mail },
    { label: 'Support / Issues', href: '/admin/support', icon: LifeBuoy },
    { label: 'Roles & Permissions', href: '/admin/roles-permissions', icon: ShieldCheck },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText },
    { label: 'Platform Settings', href: '/admin/platform-settings', icon: Settings },
  ] },
] as const;

export default function AdminShell({ children, email }: { children: React.ReactNode; email?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const initials = (email ?? 'AD').slice(0, 2).toUpperCase();
  const activeItem = groups.flatMap((group) => group.items.map(({ label, href }) => ({ label, href }))).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const isDetailPage = Boolean(activeItem && pathname !== activeItem.href);
  const detailLabel = pathname.startsWith('/admin/events/') ? 'Event review'
    : pathname.startsWith('/admin/organizers/') ? 'Organizer review'
      : pathname.startsWith('/admin/participants/') ? 'Registration details'
        : pathname.startsWith('/admin/finance/transactions/') ? 'Payment details'
          : pathname.startsWith('/admin/finance/payouts/') ? 'Payout details'
            : pathname.startsWith('/admin/email-delivery/') ? 'Email details'
              : pathname.startsWith('/admin/support/') ? 'Support case'
                : pathname.startsWith('/admin/audit-logs/') ? 'Audit record'
                  : activeItem?.label ?? 'Platform';

  useEffect(() => {
    setOpen(false);
    contentRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    if (desktopQuery.matches) {
      setOpen(false);
      return;
    }
    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = 'hidden';
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLButtonElement>('[aria-label="Close menu"]')?.focus();
    const closeOnDesktop = () => { if (desktopQuery.matches) setOpen(false); };
    desktopQuery.addEventListener('change', closeOnDesktop);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (!drawer.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      desktopQuery.removeEventListener('change', closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [open]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f4f6fa]">
      <div className={`fixed inset-0 z-40 bg-slate-950/50 transition motion-reduce:transition-none lg:hidden ${open ? 'visible opacity-100' : 'invisible opacity-0'}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="admin-sidebar" ref={drawerRef} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label="Platform navigation" className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-64 shrink-0 flex-col bg-[#101827] text-white shadow-xl transition-transform motion-reduce:transition-none lg:static lg:z-auto lg:visible lg:translate-x-0 lg:shadow-none ${open ? 'visible translate-x-0' : 'invisible -translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
          <Link href="/admin/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-500 font-black">R</span>
            <span className="font-black tracking-tight">RACE<span className="text-orange-400">DECK</span></span>
          </Link>
          <button type="button" className="rounded p-1 text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <div className="px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">Platform admin</p>
          <p className="mt-1 text-xs text-white/45">Platform control center</p>
        </div>
        <nav className="scrollbar-hidden min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pb-6" aria-label="Platform admin navigation">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{group.label}</p>
              <div className="space-y-1">
                {group.items.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 ${active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                      <Icon size={18} aria-hidden="true" /><span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700">{initials}</span>
            <p className="min-w-0 truncate text-xs font-bold text-white">Platform admin</p>
          </div>
          <Link href="/auth/logout" className="mt-4 flex w-full items-center justify-center rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/75 transition hover:bg-orange-500 hover:text-white">Sign out</Link>
        </div>
      </aside>
      <div ref={contentRef} aria-hidden={open} className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
            <button ref={menuButtonRef} type="button" onClick={() => setOpen(true)} className="rounded-lg border border-slate-200 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 lg:hidden" aria-label="Open menu" aria-expanded={open} aria-controls="admin-sidebar"><Menu size={20} /></button>
            <nav aria-label="Breadcrumb" className="min-w-0 truncate text-sm text-slate-500">
              <Link href="/admin/dashboard" className="hover:text-orange-600">Platform</Link><span className="mx-2">/</span>
              {isDetailPage && activeItem && <><Link href={activeItem.href} className="hover:text-orange-600">{activeItem.label}</Link><span className="mx-2">/</span></>}
              <span className="font-semibold text-slate-800">{isDetailPage ? detailLabel : activeItem?.label ?? (pathname.startsWith('/admin/payment-operations') ? 'Payment operations' : 'Dashboard')}</span>
            </nav>
            <span className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#071b41] text-xs font-bold text-white" aria-label="Platform administrator">{initials}</span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
