import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPage, StatusBadge } from '@/components/admin/admin-ui';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const timestamp = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'medium' });
const shortId = (value: string | null) => value ? `${value.slice(0, 8)}…` : '—';
function redact(value: unknown, key = ''): unknown {
  if (/(email|phone|mobile|address|token|secret|password|account_number|birthdate)/i.test(key)) return '[redacted]';
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]));
  return value;
}

export default async function AuditLogDetailPage({ params }: { params: { logId: string } }) {
  const db = createAdminClient();
  const { data: log, error } = await db.from('audit_logs').select('id,actor_user_id,actor_role_context,action,resource_type,resource_id,organization_id,event_id,previous_values,new_values,metadata,ip_address,user_agent,occurred_at').eq('id', params.logId).maybeSingle();
  if (error) return <AdminPage showHeading title="Audit record" description="Inspect an immutable platform audit entry."><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Audit record could not be loaded.</p></AdminPage>;
  if (!log) notFound();
  const snapshots = [
    { title: 'Previous values', value: redact(log.previous_values) },
    { title: 'New values', value: redact(log.new_values) },
    { title: 'Metadata', value: redact(log.metadata) },
  ];
  return <AdminPage showHeading title="Audit record" description={`${log.action.replaceAll('_', ' ')} · ${timestamp(log.occurred_at)}`} action={<Link href="/admin/audit-logs" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold">← Audit logs</Link>}>
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-3"><div><p className="text-xs font-bold uppercase text-slate-500">Action</p><p className="mt-1 font-semibold capitalize">{log.action.replaceAll('_', ' ')}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Resource</p><div className="mt-1"><StatusBadge value={log.resource_type} /></div></div><div><p className="text-xs font-bold uppercase text-slate-500">Timestamp</p><p className="mt-1">{timestamp(log.occurred_at)}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Actor / role</p><p className="mt-1">{shortId(log.actor_user_id)} · {log.actor_role_context ?? 'System'}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Resource ID</p><p className="mt-1 font-mono text-xs">{log.resource_id ?? '—'}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Organization / event</p><p className="mt-1 font-mono text-xs">{shortId(log.organization_id)} / {shortId(log.event_id)}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Request source</p><p className="mt-1 text-sm">{typeof log.ip_address === 'string' ? log.ip_address : 'Not recorded'}</p><p className="mt-1 break-all text-xs text-slate-500">{log.user_agent ?? ''}</p></div></section>
    <section className="grid gap-4 xl:grid-cols-3">{snapshots.map((snapshot) => <article key={snapshot.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><h2 className="border-b border-slate-100 px-4 py-3 font-bold text-[#071b41]">{snapshot.title}</h2><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-5 text-slate-700">{snapshot.value == null ? 'No values recorded.' : JSON.stringify(snapshot.value, null, 2)}</pre></article>)}</section>
  </AdminPage>;
}

