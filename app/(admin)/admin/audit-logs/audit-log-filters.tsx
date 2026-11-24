'use client';

import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const RESOURCE_TYPES = ['organization', 'event', 'registration', 'payment', 'refund', 'payout', 'role_permission', 'communication', 'support_case', 'content_block'] as const;

export default function AuditLogFilters({ search, resourceType, from, to }: { search: string; resourceType: string; from: string; to: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [searchValue, setSearchValue] = useState(search);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setTarget(document.getElementById('admin-audit-log-filters')), []);
  useEffect(() => {
    if (searchValue === search) return;
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, search]);

  if (!target) return null;

  return createPortal(
    <form ref={formRef} method="get" action="/admin/audit-logs" className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Audit log filters">
      <label className="relative min-w-[220px] flex-1 lg:w-[340px] lg:flex-none">
        <span className="sr-only">Search action or resource ID</span>
        <Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" />
        <input name="q" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} maxLength={100} placeholder="Search action or resource ID" className="h-10 w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
      </label>
      <label className="sr-only" htmlFor="audit-resource-type">Audit resource type</label>
      <select id="audit-resource-type" name="module" defaultValue={resourceType} onChange={() => window.requestAnimationFrame(() => formRef.current?.requestSubmit())} className="h-10 min-w-44 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
        <option value="">All resource types</option>{RESOURCE_TYPES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
      </select>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-500">From<input type="date" name="from" defaultValue={from} onChange={() => window.requestAnimationFrame(() => formRef.current?.requestSubmit())} className="min-w-0 bg-transparent text-sm font-medium text-slate-800 outline-none" /></label>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-500">To<input type="date" name="to" defaultValue={to} onChange={() => window.requestAnimationFrame(() => formRef.current?.requestSubmit())} className="min-w-0 bg-transparent text-sm font-medium text-slate-800 outline-none" /></label>
      {(search || resourceType || from || to) && <Link href="/admin/audit-logs" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}
    </form>,
    target,
  );
}
