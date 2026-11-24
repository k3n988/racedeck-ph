'use client';

import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function EmailDeliveryFilters({ search, status, statuses }: { search: string; status: string; statuses: readonly string[] }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [searchValue, setSearchValue] = useState(search);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setTarget(document.getElementById('admin-email-delivery-filters'));
  }, []);

  useEffect(() => {
    if (searchValue === search) return;
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, search]);

  if (!target) return null;

  return createPortal(
    <form ref={formRef} method="get" action="/admin/email-delivery" className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Email delivery filters">
      <label className="sr-only" htmlFor="email-delivery-status">Delivery status</label>
      <select id="email-delivery-status" name="status" defaultValue={status} onChange={() => window.requestAnimationFrame(() => formRef.current?.requestSubmit())} className="h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select>
      <label className="relative min-w-[220px] flex-1 lg:w-[340px] lg:flex-none"><span className="sr-only">Search recipient, subject, or email type</span><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input name="q" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} maxLength={100} placeholder="Search recipient, subject, or type" className="h-10 w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
      {(search || status) && <Link href="/admin/email-delivery" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}
    </form>,
    target,
  );
}
