import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, MailX } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, AdminPagination, DataTable, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import EmailDeliveryFilters from './email-delivery-filters';

export const dynamic = 'force-dynamic';
const statuses = ['queued', 'sending', 'delivered', 'failed', 'bounced', 'suppressed'] as const;
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default async function AdminEmailPage({ searchParams }: { searchParams?: { q?: string; status?: string; page?: string } }) {
  const db = createAdminClient();
  const search = searchParams?.q?.replace(/[^a-zA-Z0-9\s@._-]/g, ' ').trim().slice(0, 100) ?? '';
  const status = statuses.find((item) => item === searchParams?.status);
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  const pageSize = 25;
  let query = db.from('email_messages').select('id,recipient_email,email_type,subject,status,retry_count,provider_message_id,queued_at,updated_at,events(name),organizations(name),registrations(registration_number)', { count: 'exact' }).order('updated_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`recipient_email.ilike.%${search.replace(/[,%()]/g, ' ')}%,subject.ilike.%${search.replace(/[,%()]/g, ' ')}%,email_type.ilike.%${search.replace(/[,%()]/g, ' ')}%`);
  const [{ data, error, count }, deliveredResult, failedResult, queuedResult] = await Promise.all([
    query.range((page - 1) * pageSize, page * pageSize - 1),
    db.from('email_messages').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
    db.from('email_messages').select('id', { count: 'exact', head: true }).in('status', ['failed', 'bounced', 'suppressed']),
    db.from('email_messages').select('id', { count: 'exact', head: true }).in('status', ['queued', 'sending']),
  ]);
  const rows = data ?? [];
  const total = count ?? 0;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const link = (target: number) => { const params = new URLSearchParams(); if (search) params.set('q', search); if (status) params.set('status', status); params.set('page', String(target)); return `/admin/email-delivery?${params.toString()}`; };
  const pagination = !error ? <AdminPagination page={page} total={total} pageSize={pageSize} urlFor={link} label="messages" ariaLabel="Email message pages" /> : null;
  if (!error && page > maxPage) redirect(link(maxPage));
  return <AdminPage title="Email Delivery" description="" compactTop compactSections>
    {[error, deliveredResult.error, failedResult.error, queuedResult.error].some(Boolean) && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} /> Some email data could not be loaded. Retry or refresh after checking the service connection.</p>}
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Delivered" value={deliveredResult.error ? '—' : deliveredResult.count ?? 0} detail="Provider confirmed delivery" tone="green" /><StatCard label="Failed / bounced" value={failedResult.error ? '—' : failedResult.count ?? 0} tone="orange" /><StatCard label="Queued / sending" value={queuedResult.error ? '—' : queuedResult.count ?? 0} tone="amber" /><StatCard label="Matching messages" value={error ? '—' : count ?? 0} /></section>
    <EmailDeliveryFilters search={search} status={status ?? ''} statuses={statuses} />
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Email messages could not be loaded. Refresh to try again.</p> : <DataTable footer={pagination} headers={['Recipient / message','Event / registration','Status','Retries','Provider ID','Updated','Details']}>
      {rows.length ? rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
        <td className="px-4 py-3"><p className="font-semibold">{row.recipient_email}</p><p className="mt-1 text-xs text-slate-500">{row.email_type.replaceAll('_', ' ')} ? {row.subject}</p></td>
        <td className="px-4 py-3"><p>{row.events?.name ?? '?'}</p><p className="text-xs text-slate-500">{row.registrations?.registration_number ?? '?'}</p></td>
        <td className="px-4 py-3"><StatusBadge value={row.status} /></td>
        <td className="px-4 py-3">{row.retry_count}</td>
        <td className="max-w-40 truncate px-4 py-3 font-mono text-xs text-slate-500">{row.provider_message_id ?? '?'}</td>
        <td className="px-4 py-3 text-xs text-slate-500">{dateTime(row.updated_at)}</td>
        <td className="px-4 py-3"><Link href={`/admin/email-delivery/${row.id}`} className="font-bold text-orange-600">Inspect</Link></td>
      </tr>) : <tr><td colSpan={7} className="px-4 py-10 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><MailX size={23} className="text-slate-400" aria-hidden="true" /><p className="mt-3 font-bold text-[#071b41]">No email messages match these filters.</p><p className="mt-1 text-sm text-slate-500">{search || status ? 'Try another search or clear the filters.' : 'Email messages will appear here when the system sends them.'}</p></div></td></tr>}
    </DataTable>}

  </AdminPage>;
}
