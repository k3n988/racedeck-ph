'use client';

import { useCallback, useEffect, useState } from 'react';

type WebhookEvent = { id: string; gateway: string; gateway_event_id: string; event_type: string; status: string; processing_attempts: number; next_retry_at: string | null; error_message: string | null; received_at: string; processed_at: string | null; payment_id: string | null; transaction_id: string | null; registration_id: string | null; event_id: string | null; organization_id: string | null };

const display = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
const retryable = (status: string) => status === 'failed' || status === 'processing' || status === 'received';

export default function PaymentOperationsPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('Loading payment operations...');
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/payment-webhooks${filter ? `?status=${encodeURIComponent(filter)}` : ''}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? 'Payment operations could not be loaded');
    setEvents(body.events ?? []); setMessage('');
  }, [filter]);

  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : 'Payment operations could not be loaded')); }, [load]);

  async function retry(id: string) {
    setRetrying(id); setMessage('');
    try { const response = await fetch(`/api/admin/payment-webhooks/${id}`, { method: 'POST' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? 'Webhook retry failed'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Webhook retry failed'); }
    finally { setRetrying(null); }
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Internal operations</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Payment Operations</h1><p className="mt-2 text-sm text-slate-600">Monitor verified PayMongo webhook processing and retry recoverable failures.</p></header>
    <div className="flex flex-wrap items-center gap-3"><label className="text-sm font-semibold text-slate-700">Status <select value={filter} onChange={event => setFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="">All</option><option value="received">Received</option><option value="processing">Processing</option><option value="failed">Failed</option><option value="processed">Processed</option><option value="ignored">Ignored</option></select></label><button onClick={() => void load().catch(error => setMessage(error instanceof Error ? error.message : 'Refresh failed'))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Refresh</button></div>
    {message && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{message}</p>}
    {!message && <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">References</th><th className="px-4 py-3">Next retry / error</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map(event => <tr key={event.id} className="align-top"><td className="px-4 py-4"><p className="font-semibold text-slate-900">{event.event_type}</p><p className="mt-1 max-w-xs break-all text-xs text-slate-500">{event.gateway_event_id}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.received_at).toLocaleString()}</p></td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${event.status === 'processed' ? 'bg-emerald-100 text-emerald-800' : event.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{display(event.status)}</span></td><td className="px-4 py-4 text-slate-700">{event.processing_attempts}</td><td className="px-4 py-4 text-xs text-slate-600"><p>Payment: {event.payment_id ?? '—'}</p><p>Registration: {event.registration_id ?? '—'}</p><p>Event: {event.event_id ?? '—'}</p></td><td className="max-w-xs px-4 py-4 text-xs text-slate-600">{event.next_retry_at && <p>{new Date(event.next_retry_at).toLocaleString()}</p>}{event.error_message && <p className="mt-1 text-red-700">{event.error_message}</p>}</td><td className="px-4 py-4">{retryable(event.status) && <button disabled={retrying === event.id} onClick={() => void retry(event.id)} className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{retrying === event.id ? 'Retrying...' : 'Retry now'}</button>}</td></tr>)}</tbody></table>{!events.length && <p className="p-8 text-center text-sm text-slate-500">No webhook events found.</p>}</section>}
  </main>;
}
