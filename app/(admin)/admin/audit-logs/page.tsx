import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileClock, TriangleAlert } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, AdminPagination, DataTable, StatCard } from '@/components/admin/admin-ui';
import { adminDateRange, adminPageNumber, adminSearch } from '@/lib/admin/list-query';
import AuditLogFilters from './audit-log-filters';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;
const modules = ['organization', 'event', 'registration', 'payment', 'refund', 'payout', 'role_permission', 'communication', 'support_case', 'content_block'] as const;
const dateTime = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const abbreviate = (value: string | null) => value ? `${value.slice(0, 8)}…` : '—';

export default async function AdminAuditLogsPage({ searchParams }: { searchParams?: { q?: string; module?: string; from?: string; to?: string; page?: string } }) {
  const db = createAdminClient();
  const search = adminSearch(searchParams?.q);
  const resourceType = modules.find((value) => value === searchParams?.module);
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const dateRange = adminDateRange(from, to);
  const page = adminPageNumber(searchParams?.page);
  if (dateRange.error) return <AdminPage title="Audit Logs" description="" compactTop compactSections><AuditLogFilters search={search} resourceType={resourceType ?? ''} from={from} to={to} /><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{dateRange.error}</p></AdminPage>;

  let query = db.from('audit_logs').select('id,actor_user_id,actor_role_context,action,resource_type,resource_id,organization_id,event_id,occurred_at,metadata', { count: 'exact' }).order('occurred_at', { ascending: false });
  if (resourceType) query = query.eq('resource_type', resourceType);
  if (dateRange.from) query = query.gte('occurred_at', dateRange.from);
  if (dateRange.toExclusive) query = query.lt('occurred_at', dateRange.toExclusive);
  if (search) {
    const conditions = [`action.ilike.%${search}%`, `resource_type.ilike.%${search}%`, `actor_role_context.ilike.%${search}%`];
    if (/^[0-9a-f-]{36}$/i.test(search)) conditions.push(`resource_id.eq.${search}`, `actor_user_id.eq.${search}`);
    query = query.or(conditions.join(','));
  }
  const [{ data, error, count }, { count: totalCount, error: totalError }] = await Promise.all([
    query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('audit_logs').select('id', { count: 'exact', head: true }),
  ]);
  const rows = data ?? [];
  const total = count ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageUrl = (target: number) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (resourceType) params.set('module', resourceType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', String(target));
    return `/admin/audit-logs?${params}`;
  };
  const pagination = !error ? <AdminPagination page={page} total={total} pageSize={PAGE_SIZE} urlFor={pageUrl} label="audit records" ariaLabel="Audit log pages" /> : null;
  if (!error && total && page > maxPage) redirect(pageUrl(maxPage));

  return <AdminPage title="Audit Logs" description="" compactTop compactSections>
    <AuditLogFilters search={search} resourceType={resourceType ?? ''} from={from} to={to} />
    {(error || totalError) && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><TriangleAlert size={18} /> Audit activity could not be fully loaded. Refresh after checking the database connection.</p>}
    <section className="grid gap-2 sm:grid-cols-2"><StatCard label="Total recorded actions" value={totalError ? '—' : totalCount ?? 0} detail="Audit records are append-only" /><StatCard label="Matching this filter" value={error ? '—' : total} /></section>
    <DataTable footer={pagination} headers={['Timestamp', 'Actor', 'Action', 'Resource', 'Reference', 'Scope']}>
      {error ? <tr><td colSpan={6} className="px-4 py-10 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><TriangleAlert size={23} className="text-amber-600" aria-hidden="true" /><p className="mt-3 font-bold text-[#071b41]">Audit records could not be loaded</p><p className="mt-1 text-sm text-slate-500">Refresh after checking the database connection.</p></div></td></tr> : rows.length ? rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateTime(row.occurred_at)}</td>
        <td className="px-4 py-3"><p className="font-semibold">{row.actor_role_context ?? 'System'}</p><p className="font-mono text-xs text-slate-500">{abbreviate(row.actor_user_id)}</p></td>
        <td className="px-4 py-3 font-semibold capitalize">{row.action.replaceAll('_', ' ')}</td>
        <td className="px-4 py-3 capitalize">{row.resource_type.replaceAll('_', ' ')}</td>
        <td className="px-4 py-3 font-mono text-xs"><Link href={`/admin/audit-logs/${row.id}`} className="text-orange-700 hover:underline">{abbreviate(row.resource_id)}</Link></td>
        <td className="px-4 py-3 text-xs text-slate-500">{row.organization_id ? `Organization ${abbreviate(row.organization_id)}` : row.event_id ? `Event ${abbreviate(row.event_id)}` : 'Platform'}</td>
      </tr>) : <tr><td colSpan={6} className="px-4 py-10 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><FileClock size={23} className="text-slate-400" aria-hidden="true" /><p className="mt-3 font-bold text-[#071b41]">No audit activity matches these filters.</p><p className="mt-1 text-sm text-slate-500">Audit records will appear here as platform activity is recorded.</p></div></td></tr>}
    </DataTable>
  </AdminPage>;
}
