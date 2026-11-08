import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreditCard, Search } from 'lucide-react';
import { AdminPage, DataTable, Money, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { adminPageNumber, adminSearch } from '@/lib/admin/list-query';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;
const statuses = ['pending', 'accrued', 'collected', 'reversed', 'waived'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' }) : '—';

export default async function AdminPlatformFeesPage({ searchParams }: { searchParams?: { q?: string; status?: string; page?: string } }) {
  const db = createAdminClient();
  const search = adminSearch(searchParams?.q);
  const status = statuses.find((item) => item === searchParams?.status);
  const page = adminPageNumber(searchParams?.page);
  let query = db.from('platform_fees').select('id,payment_id,event_id,organization_id,fee_type,amount,currency,status,collected_at,created_at,organizations(name),events(name)', { count: 'exact' }).order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (search) query = UUID.test(search) ? query.or(`id.eq.${search},payment_id.eq.${search}`) : query.ilike('fee_type', `%${search}%`);
  const [{ data, error, count }, { count: allCount, error: allError }, { count: collectedCount, error: collectedError }, { count: accruedCount, error: accruedError }] = await Promise.all([
    query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('platform_fees').select('id', { count: 'exact', head: true }),
    db.from('platform_fees').select('id', { count: 'exact', head: true }).eq('status', 'collected'),
    db.from('platform_fees').select('id', { count: 'exact', head: true }).in('status', ['pending', 'accrued']),
  ]);
  const rows = data ?? [];
  const maxPage = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageUrl = (target: number) => { const params = new URLSearchParams(); if (search) params.set('q', search); if (status) params.set('status', status); params.set('page', String(target)); return `/admin/finance/platform-fees?${params}`; };
  if (!error && count && page > maxPage) redirect(pageUrl(maxPage));

  return <AdminPage title="Platform Fees" description="" compactTop>
    <section aria-label="Platform fee summary" className="grid gap-3 sm:grid-cols-3"><StatCard label="Pending / accrued" value={accruedError ? '—' : accruedCount ?? 0} detail="Fees not yet collected" tone="amber" /><StatCard label="Collected records" value={collectedError ? '—' : collectedCount ?? 0} detail="Successfully collected" tone="green" /><StatCard label="All fee records" value={allError ? '—' : allCount ?? 0} detail="Across all statuses" /></section>
    {(error || allError || collectedError || accruedError) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Some fee information could not be loaded. Check the finance data connection and refresh.</p>}
    <form method="get" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(220px,1fr)_minmax(180px,0.5fr)_auto_auto] sm:items-end">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Fee reference or type<span className="relative mt-1 block"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input name="q" defaultValue={search} maxLength={100} placeholder="Fee ID, payment ID, or fee type" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm font-normal normal-case focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></span></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Fee status<select name="status" defaultValue={status ?? ''} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal normal-case focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
      <button className="rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102b58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Apply</button>
      {(search || status) && <Link href="/admin/finance/platform-fees" className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:border-orange-400">Clear</Link>}
    </form>
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Platform fees could not be loaded. Refresh to try again.</p> : rows.length ? <><DataTable headers={['Fee / payment', 'Event / organizer', 'Type', 'Amount', 'Status', 'Collected', 'Created']}>
      {rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4"><Link href={`/admin/finance/transactions/${row.payment_id}`} className="font-mono text-xs font-bold text-orange-700 hover:underline">{row.id.slice(0, 8)}…</Link><p className="mt-1 font-mono text-xs text-slate-500">Payment {row.payment_id.slice(0, 8)}…</p></td><td className="px-4 py-4"><Link href={`/admin/events/${row.event_id}`} className="font-semibold text-[#071b41] hover:text-orange-700">{row.events?.name ?? 'Event unavailable'}</Link><p className="text-xs text-slate-500">{row.organizations?.name ?? 'Organizer unavailable'}</p></td><td className="px-4 py-4 capitalize">{row.fee_type.replaceAll('_', ' ')}</td><td className="whitespace-nowrap px-4 py-4 font-bold"><Money value={Number(row.amount)} currency={row.currency} /></td><td className="px-4 py-4"><StatusBadge value={row.status} /></td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{date(row.collected_at)}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{date(row.created_at)}</td></tr>)}
    </DataTable><div className="flex items-center justify-between text-sm text-slate-600"><span>Page {page} of {maxPage} · {count ?? 0} matching fee records</span><div className="flex gap-2">{page > 1 && <Link href={pageUrl(page - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Previous</Link>}{page < maxPage && <Link href={pageUrl(page + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Next</Link>}</div></div></> : !error && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><CreditCard size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">No platform fees found</p><p className="mt-1 text-sm text-slate-500">{search || status ? 'Try another reference or clear the filters.' : 'Fee records will appear when eligible payments are recorded.'}</p>{(search || status) && <Link href="/admin/finance/platform-fees" className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div>}
  </AdminPage>;
}
