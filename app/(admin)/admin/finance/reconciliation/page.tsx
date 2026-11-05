import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Search } from 'lucide-react';
import { AdminPage, DataTable, Money, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { adminPageNumber, adminSearch } from '@/lib/admin/list-query';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;
const statuses = ['pending', 'matched', 'discrepancy', 'reviewed'] as const;
const date = (value: string) => new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' });

export default async function AdminReconciliationPage({ searchParams }: { searchParams?: { q?: string; status?: string; page?: string } }) {
  const db = createAdminClient();
  const search = adminSearch(searchParams?.q);
  const status = statuses.find((item) => item === searchParams?.status);
  const page = adminPageNumber(searchParams?.page);
  let query = db.from('finance_reconciliation_records').select('id,reconciliation_reference,reconciliation_period_start,reconciliation_period_end,gateway_provider,gateway_reported_gross_amount,recorded_gross_payments,net_collected_amount,discrepancy_amount,discrepancy_status,status', { count: 'exact' }).order('reconciliation_period_end', { ascending: false });
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`reconciliation_reference.ilike.%${search}%,gateway_provider.ilike.%${search}%`);
  const [{ data, error, count }, { count: totalCount, error: totalError }, { count: openCount, error: openError }, { count: reviewedCount, error: reviewedError }] = await Promise.all([
    query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('finance_reconciliation_records').select('id', { count: 'exact', head: true }),
    db.from('finance_reconciliation_records').select('id', { count: 'exact', head: true }).eq('discrepancy_status', 'open'),
    db.from('finance_reconciliation_records').select('id', { count: 'exact', head: true }).eq('status', 'reviewed'),
  ]);
  const rows = data ?? [];
  const maxPage = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const pageUrl = (target: number) => { const params = new URLSearchParams(); if (search) params.set('q', search); if (status) params.set('status', status); params.set('page', String(target)); return `/admin/finance/reconciliation?${params}`; };
  if (!error && count && page > maxPage) redirect(pageUrl(maxPage));

  return <AdminPage title="Finance Reconciliation" description="" compactTop>
    <section aria-label="Reconciliation summary" className="grid gap-3 sm:grid-cols-3"><StatCard label="All batches" value={totalError ? '—' : totalCount ?? 0} detail="Imported reconciliation records" /><StatCard label="Open discrepancies" value={openError ? '—' : openCount ?? 0} detail="Require investigation" tone="orange" /><StatCard label="Reviewed" value={reviewedError ? '—' : reviewedCount ?? 0} detail="Review marked complete" tone="green" /></section>
    {(error || totalError || openError || reviewedError) && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} aria-hidden="true" /> Some reconciliation information could not be loaded. Refresh after checking the finance data connection.</p>}
    <form method="get" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(220px,1fr)_minmax(180px,0.5fr)_auto_auto] sm:items-end">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Batch reference or gateway<span className="relative mt-1 block"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input name="q" defaultValue={search} maxLength={100} placeholder="Search reference or provider" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm font-normal normal-case focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></span></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Review status<select name="status" defaultValue={status ?? ''} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal normal-case focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <button className="rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102b58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Apply</button>
      {(search || status) && <Link href="/admin/finance/reconciliation" className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:border-orange-400">Clear</Link>}
    </form>
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Reconciliation batches could not be loaded. Refresh to try again.</p> : rows.length ? <><DataTable headers={['Batch', 'Period', 'Gateway gross', 'Recorded gross', 'Net collected', 'Difference', 'Status', 'Action']}>
      {rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-mono text-xs font-bold">{row.reconciliation_reference}</p><p className="mt-1 text-xs text-slate-500">{row.gateway_provider ?? 'Provider not set'}</p></td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{date(row.reconciliation_period_start)} – {date(row.reconciliation_period_end)}</td><td className="whitespace-nowrap px-4 py-4"><Money value={Number(row.gateway_reported_gross_amount)} /></td><td className="whitespace-nowrap px-4 py-4"><Money value={Number(row.recorded_gross_payments)} /></td><td className="whitespace-nowrap px-4 py-4 font-bold"><Money value={Number(row.net_collected_amount)} /></td><td className={`whitespace-nowrap px-4 py-4 font-bold ${Number(row.discrepancy_amount) !== 0 ? 'text-red-700' : 'text-emerald-700'}`}><Money value={Number(row.discrepancy_amount)} /></td><td className="px-4 py-4"><div className="space-y-1"><StatusBadge value={row.status} /><StatusBadge value={row.discrepancy_status === 'open' ? 'discrepancy open' : row.discrepancy_status} /></div></td><td className="px-4 py-4"><Link href={`/admin/finance/reconciliation/${row.id}`} className="font-bold text-orange-600 hover:underline">Inspect →</Link></td></tr>)}
    </DataTable><div className="flex items-center justify-between text-sm text-slate-600"><span>Page {page} of {maxPage} · {count ?? 0} matching batches</span><div className="flex gap-2">{page > 1 && <Link href={pageUrl(page - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Previous</Link>}{page < maxPage && <Link href={pageUrl(page + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Next</Link>}</div></div></> : !error && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><AlertTriangle size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">No reconciliation batches found</p><p className="mt-1 text-sm text-slate-500">{search || status ? 'Try another reference or clear the filters.' : 'Reconciliation records will appear after finance data is imported.'}</p>{(search || status) && <Link href="/admin/finance/reconciliation" className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div>}
  </AdminPage>;
}
