import Link from 'next/link';
import { AlertTriangle, MailX } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, DataTable, EmptyState, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import ProcessQueueButton from './process-queue-button';

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
  const maxPage = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const link = (target: number) => { const params = new URLSearchParams(); if (search) params.set('q', search); if (status) params.set('status', status); params.set('page', String(target)); return `/admin/email-delivery?${params.toString()}`; };
  return <AdminPage title="Email Delivery" description="Track transactional email delivery, inspect provider responses, and retry eligible messages.">
    <div className="flex justify-end"><ProcessQueueButton /></div>
    {[error, deliveredResult.error, failedResult.error, queuedResult.error].some(Boolean) && <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} /> Some email data could not be loaded. Retry or refresh after checking the service connection.</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Delivered" value={deliveredResult.error ? '—' : deliveredResult.count ?? 0} detail="Provider confirmed delivery" tone="green" /><StatCard label="Failed / bounced" value={failedResult.error ? '—' : failedResult.count ?? 0} tone="orange" /><StatCard label="Queued / sending" value={queuedResult.error ? '—' : queuedResult.count ?? 0} tone="amber" /><StatCard label="Matching messages" value={error ? '—' : count ?? 0} /></section>
    <form method="get" className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><input name="q" defaultValue={search} placeholder="Search recipient, subject, or type" aria-label="Search email messages" className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><select name="status" defaultValue={status ?? ''} aria-label="Delivery status" className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select><button className="rounded-lg bg-[#071b41] px-4 py-2 text-sm font-bold text-white">Apply</button><Link href="/admin/email-delivery" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Clear</Link></form>
    {rows.length ? <><DataTable headers={['Recipient / message','Event / registration','Status','Retries','Provider ID','Updated','Details']}>{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-semibold">{row.recipient_email}</p><p className="mt-1 text-xs text-slate-500">{row.email_type.replaceAll('_', ' ')} · {row.subject}</p></td><td className="px-4 py-4"><p>{row.events?.name ?? '—'}</p><p className="text-xs text-slate-500">{row.registrations?.registration_number ?? '—'}</p></td><td className="px-4 py-4"><StatusBadge value={row.status} /></td><td className="px-4 py-4">{row.retry_count}</td><td className="max-w-40 truncate px-4 py-4 font-mono text-xs text-slate-500">{row.provider_message_id ?? '—'}</td><td className="px-4 py-4 text-xs text-slate-500">{dateTime(row.updated_at)}</td><td className="px-4 py-4"><Link href={`/admin/email-delivery/${row.id}`} className="font-bold text-orange-600">Inspect</Link></td></tr>)}</DataTable><div className="flex items-center justify-between text-sm text-slate-600"><span>Page {page} of {maxPage} · {count ?? 0} messages</span><div className="flex gap-2">{page > 1 && <Link href={link(page - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Previous</Link>}{page < maxPage && <Link href={link(page + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">Next</Link>}</div></div></> : !error ? <EmptyState message="No email messages match these filters." icon={MailX} /> : null}
  </AdminPage>;
}
