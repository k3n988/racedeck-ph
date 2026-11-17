import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileClock, TriangleAlert } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, DataTable, StatCard } from '@/components/admin/admin-ui';
import { adminDateRange } from '@/lib/admin/list-query';

export const dynamic = 'force-dynamic';
const modules = ['organization', 'event', 'registration', 'payment', 'refund', 'payout', 'role_permission', 'communication', 'support_case', 'content_block'] as const;
const dateTime = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const abbreviate = (value: string | null) => value ? `${value.slice(0, 8)}…` : '—';

export default async function AdminAuditLogsPage({ searchParams }: { searchParams?: { q?: string; module?: string; from?: string; to?: string; page?: string } }) {
  const db = createAdminClient();
  const search = searchParams?.q?.replace(/[^a-zA-Z0-9\s@._-]/g, ' ').trim().slice(0, 100) ?? '';
  const resourceType = modules.find((value) => value === searchParams?.module);
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const dateRange = adminDateRange(from, to);
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  if (dateRange.error) return <AdminPage title="Audit Logs" description="" compactTop compactSections><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{dateRange.error}</p><Link href="/admin/audit-logs" className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Clear date filters</Link></AdminPage>;
  const pageSize = 50;
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
    query.range((page - 1) * pageSize, page * pageSize - 1),
    db.from('audit_logs').select('id', { count: 'exact', head: true }),
  ]);
  const rows = data ?? [];
  const maxPage = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const pageUrl = (target: number) => { const params = new URLSearchParams(); if (search) params.set('q', search); if (resourceType) params.set('module', resourceType); if (from) params.set('from', from); if (to) params.set('to', to); params.set('page', String(target)); return `/admin/audit-logs?${params}`; };
  const pagination = <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>Page {page} of {maxPage} · {count ?? 0} matching records</span><div className="flex gap-2">{page > 1 && <Link href={pageUrl(page - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold hover:border-orange-400">Previous</Link>}{page < maxPage && <Link href={pageUrl(page + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold hover:border-orange-400">Next</Link>}</div></div>;
  if (!error && count && page > maxPage) redirect(pageUrl(maxPage));
  return <AdminPage title="Audit Logs" description="" compactTop compactSections>
    {(error || totalError) && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><TriangleAlert size={18} /> Audit activity could not be fully loaded. Refresh after checking the database connection.</p>}
    <section className="grid gap-2 sm:grid-cols-2"><StatCard label="Total recorded actions" value={totalError ? '—' : totalCount ?? 0} detail="Audit records are append-only" /><StatCard label="Matching this filter" value={error ? '—' : count ?? 0} /></section>
    <form method="get" className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(180px,0.7fr)_minmax(150px,0.5fr)_minmax(150px,0.5fr)_auto_auto]"><input name="q" defaultValue={search} placeholder="Search action or resource ID" aria-label="Search audit logs" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /><select name="module" defaultValue={resourceType ?? ''} aria-label="Audit resource type" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All resource types</option>{modules.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select><label className="flex items-center gap-2 text-xs text-slate-500">From<input type="date" name="from" defaultValue={from} className="min-w-0 rounded-lg border border-slate-300 px-2 py-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label><label className="flex items-center gap-2 text-xs text-slate-500">To<input type="date" name="to" defaultValue={to} className="min-w-0 rounded-lg border border-slate-300 px-2 py-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label><button className="rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102b58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Apply</button>{(search || resourceType || from || to) && <Link href="/admin/audit-logs" className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold hover:border-orange-400">Clear</Link>}</form>
    {rows.length ? <DataTable footer={pagination} headers={['Timestamp','Actor','Action','Resource','Reference','Scope']}>{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateTime(row.occurred_at)}</td><td className="px-4 py-3"><p className="font-semibold">{row.actor_role_context ?? 'System'}</p><p className="font-mono text-xs text-slate-500">{abbreviate(row.actor_user_id)}</p></td><td className="px-4 py-3 font-semibold capitalize">{row.action.replaceAll('_', ' ')}</td><td className="px-4 py-3 capitalize">{row.resource_type.replaceAll('_', ' ')}</td><td className="px-4 py-3 font-mono text-xs"><Link href={`/admin/audit-logs/${row.id}`} className="text-orange-700 hover:underline">{abbreviate(row.resource_id)}</Link></td><td className="px-4 py-3 text-xs text-slate-500">{row.organization_id ? `Organization ${abbreviate(row.organization_id)}` : row.event_id ? `Event ${abbreviate(row.event_id)}` : 'Platform'}</td></tr>)}</DataTable> : !error && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><FileClock size={23} className="mx-auto text-slate-400" aria-hidden="true" /><p className="mt-3 font-bold text-[#071b41]">No audit activity matches these filters.</p></div>}
  </AdminPage>;
}
