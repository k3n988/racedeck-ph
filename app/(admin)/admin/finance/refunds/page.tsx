import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RotateCcw, Search } from 'lucide-react';
import { AdminPage, DataTable, Money, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { adminDateRange, adminPageNumber, adminSearch } from '@/lib/admin/list-query';
import { createAdminClient } from '@/lib/supabase/admin';
import RefundRequestForm from './refund-request-form';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['all', 'pending', 'processing', 'succeeded', 'failed', 'cancelled'] as const;
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default async function AdminRefundsPage({ searchParams }: { searchParams?: { q?: string; status?: string; from?: string; to?: string; page?: string; payment?: string } }) {
  const db = createAdminClient();
  const search = adminSearch(searchParams?.q);
  const status = STATUSES.find((value) => value === searchParams?.status) ?? 'all';
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const range = adminDateRange(from, to);
  const page = adminPageNumber(searchParams?.page);
  const paymentId = (searchParams?.payment ?? '').trim();
  let query = db.from('refunds').select('id,organization_id,event_id,registration_id,payment_id,gateway_refund_id,amount,currency,reason,status,failure_code,failure_message,processed_at,created_at,organizations(name),events(name),registrations(first_name,last_name,registration_number)', { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  if (search) query = UUID.test(search) ? query.or(`id.eq.${search},payment_id.eq.${search},registration_id.eq.${search},gateway_refund_id.ilike.%${search}%`) : query.ilike('gateway_refund_id', `%${search}%`);
  if (range.from) query = query.gte('created_at', range.from);
  if (range.toExclusive) query = query.lt('created_at', range.toExclusive);
  const [listing, totalCount, pendingCount, succeededCount, failedCount, paymentResult] = await Promise.all([
    range.error ? Promise.resolve({ data: null, count: null, error: null }) : query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('refunds').select('id', { count: 'exact', head: true }),
    db.from('refunds').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
    db.from('refunds').select('id', { count: 'exact', head: true }).eq('status', 'succeeded'),
    db.from('refunds').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    UUID.test(paymentId) ? db.from('payments').select('id,registration_id,status,amount_paid,amount_refunded,currency,gateway,registrations(first_name,last_name,registration_number),events(name),organizations(name)').eq('id', paymentId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const rows = listing.data ?? [];
  const total = listing.count ?? 0;
  const urlFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (nextPage > 1) params.set('page', String(nextPage));
    return `/admin/finance/refunds${params.size ? `?${params}` : ''}`;
  };
  if (!listing.error && !range.error && total > 0 && page > Math.ceil(total / PAGE_SIZE)) redirect(urlFor(Math.ceil(total / PAGE_SIZE)));
  const metric = (result: { count: number | null; error: unknown }) => result.error ? '—' : (result.count ?? 0).toLocaleString();
  const payment = paymentResult.data;
  let reserved = 0;
  let reservationError = false;
  if (payment) {
    for (let offset = 0; ; offset += 1000) {
      const result = await db.from('refunds').select('amount').eq('payment_id', payment.id).in('status', ['pending', 'processing', 'succeeded']).range(offset, offset + 999);
      if (result.error) { reservationError = true; break; }
      reserved += (result.data ?? []).reduce((sum, refund) => sum + Math.round(Number(refund.amount) * 100), 0);
      if ((result.data ?? []).length < 1000) break;
    }
  }
  const available = payment && !reservationError ? Math.max(0, (Math.round(Number(payment.amount_paid) * 100) - reserved) / 100) : 0;

  return <AdminPage eyebrow="Finance" title="Refunds" description="Review refund requests and issue verified PayMongo refunds.">
    <section aria-label="Refund totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="All refunds" value={metric(totalCount)} /><StatCard label="Pending / processing" value={metric(pendingCount)} tone="amber" /><StatCard label="Succeeded" value={metric(succeededCount)} tone="green" /><StatCard label="Failed" value={metric(failedCount)} tone="orange" /></section>
    {[totalCount, pendingCount, succeededCount, failedCount].some((result) => result.error) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Some totals could not be loaded. Refresh to try again.</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-[#071b41]">Find a payment to refund</h2><p className="mt-1 text-sm text-slate-500">Enter its full RaceDeck payment ID, then review the participant, event, and available balance.</p><form method="get" className="mt-3 flex flex-wrap gap-2"><input required name="payment" defaultValue={paymentId} pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" placeholder="Payment UUID" aria-label="Payment ID" className="min-w-60 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><button className="rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white">Review payment</button></form></section>
    {paymentId && !UUID.test(paymentId) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Enter a valid payment ID.</p>}
    {paymentResult.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Payment could not be loaded. Refresh to try again.</p>}
    {UUID.test(paymentId) && !paymentResult.error && !payment && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Payment not found.</p>}
    {reservationError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Refund balance could not be checked. A new refund request is unavailable until this loads.</p>}
    {payment && !reservationError && <RefundRequestForm key={payment.id} payment={{ id: payment.id, participant: payment.registrations ? `${payment.registrations.first_name} ${payment.registrations.last_name}` : 'Participant unavailable', registration: payment.registrations?.registration_number ?? payment.registration_id, event: payment.events?.name ?? 'Event unavailable', organizer: payment.organizations?.name ?? 'Organizer unavailable', status: payment.status, gateway: payment.gateway, currency: payment.currency, paid: Number(payment.amount_paid), reserved: reserved / 100, available }} />}
    <form method="get" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(150px,1fr)_minmax(240px,1.5fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto] xl:items-end">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Status<select name="status" defaultValue={status} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal normal-case text-slate-800"><option value="all">All statuses</option>{STATUSES.filter((value) => value !== 'all').map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Reference<span className="relative mt-1 block"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input name="q" defaultValue={search} maxLength={100} placeholder="Refund, payment, or gateway ID" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm font-normal normal-case" /></span></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">From<input name="from" type="date" defaultValue={from} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal" /></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">To<input name="to" type="date" defaultValue={to} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal" /></label>
      <div className="flex gap-2"><button type="submit" className="rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white">Apply</button>{(search || status !== 'all' || from || to) && <Link href="/admin/finance/refunds" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Clear</Link>}</div>
    </form>
    <p className="text-xs text-slate-500">Dates use Philippine time. Totals cover all refund records; the list follows your filters. Search accepts full RaceDeck IDs or a gateway refund reference.</p>
    {range.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{range.error}</p> : listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Refund records could not be loaded. Refresh to try again.</p> : <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-extrabold text-[#071b41]">Refund records</h2><span className="text-sm text-slate-500">{total.toLocaleString()} record{total === 1 ? '' : 's'}</span></div>{rows.length ? <DataTable headers={['Refund / reason', 'Participant', 'Event / organizer', 'Amount', 'Status', 'Gateway reference', 'Requested / processed', 'Payment']}>{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-mono text-xs font-bold">{row.id.slice(0, 12)}…</p><p className="mt-1 text-xs text-slate-500">{row.reason?.replaceAll('_', ' ') ?? 'No reason'}</p>{row.failure_message && <p className="mt-1 max-w-56 text-xs text-red-700">{row.failure_code && `${row.failure_code}: `}{row.failure_message}</p>}</td><td className="px-4 py-4"><p className="font-semibold">{row.registrations ? `${row.registrations.first_name} ${row.registrations.last_name}` : 'Participant unavailable'}</p><p className="text-xs text-slate-500">{row.registrations?.registration_number ?? row.registration_id.slice(0, 12)}</p></td><td className="px-4 py-4"><p className="font-semibold">{row.events?.name ?? 'Event unavailable'}</p><p className="text-xs text-slate-500">{row.organizations?.name ?? 'Organizer unavailable'}</p></td><td className="whitespace-nowrap px-4 py-4 font-bold"><Money value={Number(row.amount)} currency={row.currency} /></td><td className="px-4 py-4"><StatusBadge value={row.status} /></td><td className="break-all px-4 py-4 font-mono text-xs">{row.gateway_refund_id || '—'}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{dateTime(row.created_at)}<span className="block">Processed: {dateTime(row.processed_at)}</span></td><td className="px-4 py-4"><Link href={`/admin/finance/transactions/${row.payment_id}`} className="font-bold text-orange-600 hover:underline">View payment →</Link></td></tr>)}</DataTable> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><RotateCcw size={28} className="mx-auto text-slate-400" aria-hidden="true" /><p className="mt-3 font-bold text-[#071b41]">No refund records found</p><p className="mt-1 text-sm text-slate-500">{search || status !== 'all' || from || to ? 'Try adjusting the filters.' : 'Refund requests will appear here when they are submitted.'}</p></div>}</section>}
    {!range.error && !listing.error && total > PAGE_SIZE && <nav aria-label="Refund pages" className="flex items-center justify-between text-sm"><span className="text-slate-500">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span><div className="flex gap-2">{page > 1 && <Link href={urlFor(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Previous</Link>}{page * PAGE_SIZE < total && <Link href={urlFor(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Next</Link>}</div></nav>}
  </AdminPage>;
}
