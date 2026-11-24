'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const STATUSES = ['all', 'pending', 'processing', 'succeeded', 'failed', 'cancelled'] as const;

export default function RefundFilters({ status, search, from, to }: { status: string; search: string; from: string; to: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [searchValue, setSearchValue] = useState(search);

  useEffect(() => {
    setTarget(document.getElementById('admin-refund-filters'));
  }, []);

  useEffect(() => {
    if (searchValue === search) return;
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, search]);

  const submitFilters = () => window.requestAnimationFrame(() => formRef.current?.requestSubmit());
  const hasFilters = Boolean(search || status !== 'all' || from || to);

  if (!target) return null;

  return createPortal(
    <form ref={formRef} method="get" action="/admin/finance/refunds" className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Refund filters">
      <label className="sr-only" htmlFor="refund-status">Refund status</label>
      <select id="refund-status" name="status" defaultValue={status} onChange={submitFilters} className="h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="all">All statuses</option>{STATUSES.filter((value) => value !== 'all').map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <label className="relative min-w-[220px] flex-1 lg:w-[320px] lg:flex-none"><span className="sr-only">Search refund, payment, or gateway reference</span><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input name="q" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} maxLength={100} placeholder="Refund, payment, or gateway ID" className="h-10 w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
      <label className="sr-only" htmlFor="refund-from">From date</label><input id="refund-from" name="from" type="date" aria-label="From date" defaultValue={from} onChange={submitFilters} className="h-10 w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
      <label className="sr-only" htmlFor="refund-to">To date</label><input id="refund-to" name="to" type="date" aria-label="To date" defaultValue={to} onChange={submitFilters} className="h-10 w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
      {hasFilters && <Link href="/admin/finance/refunds" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}
    </form>,
    target,
  );
}
