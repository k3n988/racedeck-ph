'use client';

import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;

export default function SupportFilters({ search, status, priority }: { search: string; status: string; priority: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [searchValue, setSearchValue] = useState(search);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setTarget(document.getElementById('admin-support-filters')), []);
  useEffect(() => {
    if (searchValue === search) return;
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, search]);

  if (!target) return null;

  return createPortal(
    <form ref={formRef} method="get" action="/admin/support" className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Support case filters">
      <label className="relative min-w-[220px] flex-1 lg:w-[340px] lg:flex-none">
        <span className="sr-only">Search reference, subject, or issue type</span>
        <Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" />
        <input name="q" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} maxLength={100} placeholder="Search reference, subject, or issue type" className="h-10 w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
      </label>
      <label className="sr-only" htmlFor="support-status">Support status</label>
      <select id="support-status" name="status" defaultValue={status} onChange={() => window.requestAnimationFrame(() => formRef.current?.requestSubmit())} className="h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
        <option value="">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
      </select>
      <label className="sr-only" htmlFor="support-priority">Support priority</label>
      <select id="support-priority" name="priority" defaultValue={priority} onChange={() => window.requestAnimationFrame(() => formRef.current?.requestSubmit())} className="h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
        <option value="">All priorities</option>{PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      {(search || status || priority) && <Link href="/admin/support" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}
    </form>,
    target,
  );
}
