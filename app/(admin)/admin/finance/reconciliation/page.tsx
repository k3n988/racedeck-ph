import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { AdminPage, AdminPagination, DataTable, Money, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { adminPageNumber, adminSearch } from '@/lib/admin/list-query';
import { createAdminClient } from '@/lib/supabase/admin';
import ReconciliationFilters from './reconciliation-filters';

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
  const total = count ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageUrl = (target: number) => { const params = new URLSearchParams(); if (search) params.set('q', search); if (status) params.set('status', status); params.set('page', String(target)); return `/admin/finance/reconciliation?${params}`; };
  const pagination = !error ? <AdminPagination page={page} total={total} pageSize={PAGE_SIZE} urlFor={pageUrl} label="reconciliation batches" ariaLabel="Reconciliation pages" /> : null;
  if (!error && page > maxPage) redirect(pageUrl(maxPage));

  return <AdminPage title="Finance Reconciliation" description="" compactTop compactSections>
    <section aria-label="Reconciliation summary" className="grid gap-2 sm:grid-cols-3"><StatCard label="All batches" value={totalError ? '—' : totalCount ?? 0} detail="Imported reconciliation records" /><StatCard label="Open discrepancies" value={openError ? '—' : openCount ?? 0} detail="Require investigation" tone="orange" /><StatCard label="Reviewed" value={reviewedError ? '—' : reviewedCount ?? 0} detail="Review marked complete" tone="green" /></section>
    {(error || totalError || openError || reviewedError) && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} aria-hidden="true" /> Some reconciliation information could not be loaded. Refresh after checking the finance data connection.</p>}
    <ReconciliationFilters search={search} status={status ?? ''} />
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Reconciliation batches could not be loaded. Refresh to try again.</p> : <DataTable footer={pagination} headers={['#', 'Batch', 'Period', 'Gateway gross', 'Recorded gross', 'Net collected', 'Difference', 'Status', 'Action']}>
      {rows.length ? rows.map((row, index) => <tr key={row.id} className="hover:bg-slate-50">
        <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
        <td className="px-4 py-3"><p className="font-mono text-xs font-bold">{row.reconciliation_reference}</p><p className="mt-1 text-xs text-slate-500">{row.gateway_provider ?? 'Provider not set'}</p></td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{date(row.reconciliation_period_start)} ? {date(row.reconciliation_period_end)}</td>
        <td className="whitespace-nowrap px-4 py-3"><Money value={Number(row.gateway_reported_gross_amount)} /></td>
        <td className="whitespace-nowrap px-4 py-3"><Money value={Number(row.recorded_gross_payments)} /></td>
        <td className="whitespace-nowrap px-4 py-3 font-bold"><Money value={Number(row.net_collected_amount)} /></td>
        <td className={`whitespace-nowrap px-4 py-3 font-bold ${Number(row.discrepancy_amount) !== 0 ? 'text-red-700' : 'text-emerald-700'}`}><Money value={Number(row.discrepancy_amount)} /></td>
        <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><StatusBadge value={row.status} /><StatusBadge value={row.discrepancy_status === 'open' ? 'discrepancy open' : row.discrepancy_status} /></div></td>
        <td className="px-4 py-3"><Link href={`/admin/finance/reconciliation/${row.id}`} className="font-bold text-orange-600 hover:underline">Inspect ?</Link></td>
      </tr>) : <tr><td colSpan={9} className="px-4 py-10 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><AlertTriangle size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">No reconciliation batches found</p><p className="mt-1 text-sm text-slate-500">{search || status ? 'Try another reference or clear the filters.' : 'Reconciliation records will appear after finance data is imported.'}</p>{(search || status) && <Link href="/admin/finance/reconciliation" className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div></td></tr>}
    </DataTable>}

  </AdminPage>;
}
