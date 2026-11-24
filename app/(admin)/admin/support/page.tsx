import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, AdminPagination, DataTable, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { adminPageNumber, adminSearch } from '@/lib/admin/list-query';
import SupportFilters from './support-filters';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;
const statuses = ['open', 'in_progress', 'resolved', 'closed'] as const;
const priorities = ['urgent', 'high', 'normal', 'low'] as const;
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default async function AdminSupportPage({ searchParams }: { searchParams?: { q?: string; status?: string; priority?: string; page?: string } }) {
  const db = createAdminClient();
  const search = adminSearch(searchParams?.q);
  const status = statuses.find((item) => item === searchParams?.status);
  const priority = priorities.find((item) => item === searchParams?.priority);
  const page = adminPageNumber(searchParams?.page);
  let query = db.from('support_cases').select('id,case_reference,requester_organization_id,subject,case_type,priority,status,opened_at,updated_at,organization_id,event_id,registrations(registration_number,email),organizations!support_cases_organization_id_fkey(name)', { count: 'exact' }).order('updated_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (search) query = query.or(`case_reference.ilike.%${search.replace(/[,%()]/g, ' ')}%,subject.ilike.%${search.replace(/[,%()]/g, ' ')}%,case_type.ilike.%${search.replace(/[,%()]/g, ' ')}%`);
  const [{ data, error, count }, ...counts] = await Promise.all([
    query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    ...statuses.map((item) => db.from('support_cases').select('id', { count: 'exact', head: true }).eq('status', item)),
  ]);
  const rows = data ?? [];
  const allStatusCountErrors = counts.some((item) => item.error);
  const totalOpen = counts[0].count;
  const totalProgress = counts[1].count;
  const totalResolved = (counts[2].count ?? 0) + (counts[3].count ?? 0);
  const total = count ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageUrl = (target: number) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    params.set('page', String(target));
    return `/admin/support?${params}`;
  };
  const pagination = <AdminPagination page={page} total={total} pageSize={PAGE_SIZE} urlFor={pageUrl} label="support cases" ariaLabel="Support case pages" />;
  if (!error && total && page > maxPage) redirect(pageUrl(maxPage));

  return <AdminPage title="Support / Issues" description="" compactTop compactSections>
    <SupportFilters search={search} status={status ?? ''} priority={priority ?? ''} />
    {(error || allStatusCountErrors) && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} /> Support information could not be fully loaded. Refresh after checking the connection.</p>}
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Open" value={counts[0].error ? '—' : totalOpen ?? 0} tone="orange" /><StatCard label="In progress" value={counts[1].error ? '—' : totalProgress ?? 0} tone="amber" /><StatCard label="Resolved" value={counts[2].error || counts[3].error ? '—' : totalResolved} tone="green" /><StatCard label="Matching cases" value={error ? '—' : total} /></section>
    <DataTable footer={pagination} headers={['Case', 'Requester context', 'Category', 'Priority', 'Status', 'Updated', 'Action']}>
      {error ? <tr><td colSpan={7} className="px-4 py-10 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">Support reports could not be loaded</p><p className="mt-1 text-sm text-slate-500">Check the support case database connection, then refresh.</p></div></td></tr> : rows.length ? rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
        <td className="px-4 py-3"><p className="font-bold">{row.case_reference}</p><p className="mt-1 text-slate-700">{row.subject}</p></td>
        <td className="px-4 py-3"><p>{row.requester_organization_id ? row.organizations?.name ?? 'Organizer' : 'Participant'}</p><p className="text-xs text-slate-500">{row.registrations?.email ?? 'No linked registration email'}</p><p className="text-xs text-slate-500">{row.registrations?.registration_number ?? 'No registration linked'}</p></td>
        <td className="px-4 py-3 capitalize">{row.case_type.replaceAll('_', ' ')}</td>
        <td className="px-4 py-3"><StatusBadge value={row.priority} tone={row.priority === 'urgent' || row.priority === 'high' ? 'red' : undefined} /></td>
        <td className="px-4 py-3"><StatusBadge value={row.status} /></td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateTime(row.updated_at)}</td>
        <td className="px-4 py-3"><Link href={`/admin/support/${row.id}`} className="font-bold text-orange-600">Review</Link></td>
      </tr>) : <tr><td colSpan={7} className="px-4 py-10 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><LifeBuoy size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">{search || status || priority ? 'No support cases match these filters.' : 'No reports yet'}</p><p className="mt-1 text-sm text-slate-500">{search || status || priority ? 'Try adjusting the search or filters.' : 'Participant and organizer reports will appear here when submitted.'}</p>{(search || status || priority) && <Link href="/admin/support" className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div></td></tr>}
    </DataTable>
  </AdminPage>;
}
