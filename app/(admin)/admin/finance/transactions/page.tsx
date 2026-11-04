import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreditCard, Search } from 'lucide-react';
import { AdminPage, DataTable, Money, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { adminDateRange, adminPageNumber, adminSearch } from '@/lib/admin/list-query';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['all', 'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded', 'expired'] as const;

export default async function AdminTransactionsPage({ searchParams }: { searchParams?: { q?: string; status?: string; from?: string; to?: string; page?: string } }) {
  const db = createAdminClient();
  const search = adminSearch(searchParams?.q);
  const status = STATUSES.find((value) => value === searchParams?.status) ?? 'all';
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const range = adminDateRange(from, to);
  const page = adminPageNumber(searchParams?.page);
  let query = db.from('payments').select('id,registration_id,amount_due,amount_paid,amount_refunded,currency,status,gateway,gateway_payment_id,created_at,registrations(first_name,last_name,registration_number),events(name),organizations(name)', { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  if (search) query = UUID.test(search) ? query.or(`id.eq.${search},registration_id.eq.${search},gateway_payment_id.ilike.%${search}%`) : query.ilike('gateway_payment_id', `%${search}%`);
  if (range.from) query = query.gte('created_at', range.from);
  if (range.toExclusive) query = query.lt('created_at', range.toExclusive);
  const [listing, totalCount, successfulCount, pendingCount, refundedCount] = await Promise.all([
    range.error ? Promise.resolve({ data: null, count: null, error: null }) : query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('payments').select('id', { count: 'exact', head: true }),
    db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'succeeded'),
    db.from('payments').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
    db.from('payments').select('id', { count: 'exact', head: true }).in('status', ['partially_refunded', 'refunded']),
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
    return `/admin/finance/transactions${params.size ? `?${params}` : ''}`;
  };
  if (!listing.error && !range.error && total > 0 && page > Math.ceil(total / PAGE_SIZE)) redirect(urlFor(Math.ceil(total / PAGE_SIZE)));
  const metric = (result: { count: number | null; error: unknown }) => result.error ? '—' : (result.count ?? 0).toLocaleString();

  return <AdminPage eyebrow="Finance" title="Transactions" description="Review payment records, gateway attempts, and refunds.">
    <section aria-label="Payment totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="All payments" value={metric(totalCount)} /><StatCard label="Succeeded" value={metric(successfulCount)} tone="green" /><StatCard label="Pending / processing" value={metric(pendingCount)} tone="amber" /><StatCard label="Refunded / partial" value={metric(refundedCount)} /></section>
    {[totalCount, successfulCount, pendingCount, refundedCount].some((result) => result.error) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Some totals could not be loaded. Refresh to try again.</p>}
    <form method="get" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(160px,1fr)_minmax(240px,1.5fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto] xl:items-end">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Status<select name="status" defaultValue={status} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal normal-case text-slate-800"><option value="all">All statuses</option>{STATUSES.filter((value) => value !== 'all').map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Reference<span className="relative mt-1 block"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input name="q" defaultValue={search} maxLength={100} placeholder="Payment, registration, or gateway ID" className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm font-normal normal-case" /></span></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">From<input name="from" type="date" defaultValue={from} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal" /></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">To<input name="to" type="date" defaultValue={to} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal" /></label>
      <div className="flex gap-2"><button type="submit" className="rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white">Apply</button>{(search || status !== 'all' || from || to) && <Link href="/admin/finance/transactions" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Clear</Link>}</div>
    </form>
    <p className="text-xs text-slate-500">Dates use Philippine time. Totals cover all payment records; the list below follows your filters. Search accepts a full payment or registration ID, or a gateway reference.</p>
    {range.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{range.error}</p> : listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Payment records could not be loaded. Refresh to try again.</p> : <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-extrabold text-[#071b41]">Payment records</h2><span className="text-sm text-slate-500">{total.toLocaleString()} record{total === 1 ? '' : 's'}</span></div>{rows.length ? <DataTable headers={['Payment / registration', 'Participant', 'Event / organizer', 'Due / paid', 'Gateway', 'Status', 'Created', 'Action']}>{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-mono text-xs font-bold">{row.id.slice(0, 12)}…</p><p className="mt-1 text-xs text-slate-500">{row.registrations?.registration_number ?? row.registration_id.slice(0, 12)}</p></td><td className="px-4 py-4">{row.registrations ? `${row.registrations.first_name} ${row.registrations.last_name}` : 'Participant unavailable'}</td><td className="px-4 py-4"><p className="font-semibold">{row.events?.name ?? 'Event unavailable'}</p><p className="text-xs text-slate-500">{row.organizations?.name ?? 'Organizer unavailable'}</p></td><td className="whitespace-nowrap px-4 py-4 text-sm"><p><Money value={Number(row.amount_due)} currency={row.currency} /> due</p><p className="text-slate-500"><Money value={Number(row.amount_paid)} currency={row.currency} /> paid</p></td><td className="px-4 py-4 text-sm text-slate-600">{row.gateway || '—'}</td><td className="px-4 py-4"><StatusBadge value={row.status} /></td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{new Date(row.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td><td className="px-4 py-4"><Link href={`/admin/finance/transactions/${row.id}`} className="font-bold text-orange-600 hover:underline">View details →</Link></td></tr>)}</DataTable> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><CreditCard size={28} className="mx-auto text-slate-400" aria-hidden="true" /><p className="mt-3 font-bold text-[#071b41]">No payment records found</p><p className="mt-1 text-sm text-slate-500">{search || status !== 'all' || from || to ? 'Try adjusting the filters.' : 'Payments will appear here when checkouts begin.'}</p></div>}</section>}
    {!range.error && !listing.error && total > PAGE_SIZE && <nav aria-label="Payment pages" className="flex items-center justify-between text-sm"><span className="text-slate-500">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span><div className="flex gap-2">{page > 1 && <Link href={urlFor(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Previous</Link>}{page * PAGE_SIZE < total && <Link href={urlFor(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Next</Link>}</div></nav>}
  </AdminPage>;
}
