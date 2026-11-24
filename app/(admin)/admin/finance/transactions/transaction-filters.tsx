'use client';

import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const STATUSES = ['all', 'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded', 'expired'] as const;

export default function TransactionFilters({ search, status, from, to }: { search: string; status: string; from: string; to: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [searchValue, setSearchValue] = useState(search);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setTarget(document.getElementById('admin-transaction-filters'));
  }, []);

  useEffect(() => {
    if (searchValue === search) return;
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, search]);

  if (!target) return null;

  return createPortal(
    <form ref={formRef} method="get" className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Transaction filters">
      <label className="sr-only" htmlFor="transaction-status">Payment status</label>
      <select id="transaction-status" name="status" defaultValue={status} onChange={() => window.requestAnimationFrame(() => formRef.current?.requestSubmit())} className="h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">
        {STATUSES.map((value) => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value.replaceAll('_', ' ')}</option>)}
      </select>
      <label className="relative min-w-[220px] flex-1 lg:w-[340px] lg:flex-none">
        <span className="sr-only">Search payment, registration, or gateway reference</span>
        <Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" />
        <input name="q" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} maxLength={100} placeholder="Search reference" className="h-10 w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
      </label>
      <label className="sr-only" htmlFor="transaction-from">Created from</label>
      <input id="transaction-from" name="from" aria-label="Created from" type="date" defaultValue={from} onChange={() => window.requestAnimationFrame(() => formRef.current?.requestSubmit())} className="h-10 w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
      <label className="sr-only" htmlFor="transaction-to">Created to</label>
      <input id="transaction-to" name="to" aria-label="Created to" type="date" defaultValue={to} onChange={() => window.requestAnimationFrame(() => formRef.current?.requestSubmit())} className="h-10 w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" />
      {(search || status !== 'all' || from || to) && <Link href="/admin/finance/transactions" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}
    </form>,
    target,
  );
}
