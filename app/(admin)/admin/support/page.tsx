import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, DataTable, EmptyState, StatCard, StatusBadge } from '@/components/admin/admin-ui';

export const dynamic = 'force-dynamic';
const statuses = ['open', 'in_progress', 'resolved', 'closed'] as const;
const priorities = ['urgent', 'high', 'normal', 'low'] as const;
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default async function AdminSupportPage({ searchParams }: { searchParams?: { q?: string; status?: string; priority?: string; page?: string } }) {
  const db = createAdminClient();
  const search = searchParams?.q?.replace(/[^a-zA-Z0-9\s@._-]/g, ' ').trim().slice(0, 100) ?? '';
  const status = statuses.find((item) => item === searchParams?.status);
  const priority = priorities.find((item) => item === searchParams?.priority);
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  const pageSize = 25;
  let query = db.from('support_cases').select('id,case_reference,subject,case_type,priority,status,opened_at,updated_at,organization_id,event_id,registrations(registration_number),organizations!support_cases_organization_id_fkey(name)', { count: 'exact' }).order('updated_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (search) query = query.or(`case_reference.ilike.%${search.replace(/[,%()]/g, ' ')}%,subject.ilike.%${search.replace(/[,%()]/g, ' ')}%,case_type.ilike.%${search.replace(/[,%()]/g, ' ')}%`);
  const [{ data, error, count }, ...counts] = await Promise.all([
    query.range((page - 1) * pageSize, page * pageSize - 1),
    ...statuses.map((item) => db.from('support_cases').select('id', { count: 'exact', head: true }).eq('status', item)),
  ]);
  const rows = data ?? [];
  const allStatusCountErrors = counts.some((item) => item.error);
  const totalOpen = counts[0].count;
  const totalProgress = counts[1].count;
  const totalResolved = (counts[2].count ?? 0) + (counts[3].count ?? 0);
  const maxPage = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const pageUrl = (target: number) => { const params = new URLSearchParams(); if (search) params.set('q', search); if (status) params.set('status', status); if (priority) params.set('priority', priority); params.set('page', String(target)); return `/admin/support?${params}`; };
  if (!error && count && page > maxPage) redirect(pageUrl(maxPage));
  return <AdminPage title="Support / Issues" description="" compactTop>
    {(error || allStatusCountErrors) && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} /> Support information could not be fully loaded. Refresh after checking the connection.</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Open" value={counts[0].error ? '—' : totalOpen ?? 0} tone="orange" /><StatCard label="In progress" value={counts[1].error ? '—' : totalProgress ?? 0} tone="amber" /><StatCard label="Resolved" value={counts[2].error || counts[3].error ? '—' : totalResolved} tone="green" /><StatCard label="Matching cases" value={error ? '—' : count ?? 0} /></section>
    <form method="get" className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><input name="q" defaultValue={search} placeholder="Search reference, subject, or issue type" aria-label="Search support cases" className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /><select name="status" defaultValue={status ?? ''} aria-label="Support status" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select><select name="priority" defaultValue={priority ?? ''} aria-label="Priority" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="">All priorities</option>{priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102b58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Apply</button>{(search || status || priority) && <Link href="/admin/support" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:border-orange-400">Clear</Link>}</form>
    {rows.length ? <><DataTable headers={['Case','Requester context','Category','Priority','Status','Updated','Action']}>{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-bold">{row.case_reference}</p><p className="mt-1 text-slate-700">{row.subject}</p></td><td className="px-4 py-4"><p>{row.organizations?.name ?? 'Participant'}</p><p className="text-xs text-slate-500">{row.registrations?.registration_number ?? 'No registration linked'}</p></td><td className="px-4 py-4 capitalize">{row.case_type.replaceAll('_', ' ')}</td><td className="px-4 py-4"><StatusBadge value={row.priority} tone={row.priority === 'urgent' || row.priority === 'high' ? 'red' : undefined} /></td><td className="px-4 py-4"><StatusBadge value={row.status} /></td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{dateTime(row.updated_at)}</td><td className="px-4 py-4"><Link href={`/admin/support/${row.id}`} className="font-bold text-orange-600">Review</Link></td></tr>)}</DataTable><div className="flex items-center justify-between text-sm text-slate-600"><span>Page {page} of {maxPage} · {count ?? 0} cases</span><div className="flex gap-2">{page > 1 && <Link href={pageUrl(page - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Previous</Link>}{page < maxPage && <Link href={pageUrl(page + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Next</Link>}</div></div></> : !error ? <EmptyState message="No support cases match these filters." icon={LifeBuoy} /> : null}
  </AdminPage>;
}
