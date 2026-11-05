import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { AdminPage, DataTable, StatCard, StatusBadge, Money } from '@/components/admin/admin-ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminDateRange, adminPageNumber, adminSearch } from '@/lib/admin/list-query';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const STATUSES = ['all', 'pending_payment', 'confirmed', 'cancelled', 'transferred', 'refunded', 'expired'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminParticipantsPage({ searchParams }: { searchParams?: { q?: string; status?: string; from?: string; to?: string; page?: string } }) {
  const db = createAdminClient();
  const search = adminSearch(searchParams?.q);
  const status = STATUSES.find((value) => value === searchParams?.status) ?? 'all';
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const range = adminDateRange(from, to);
  const page = adminPageNumber(searchParams?.page);
  let query = db.from('registrations').select('id,registration_number,user_id,first_name,last_name,email,mobile,status,created_at,events(id,name),race_categories(name),payments(status,amount_paid,currency),bibs!registrations_bib_id_fkey(bib_code)', { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,registration_number.ilike.%${search}%${UUID.test(search) ? `,id.eq.${search}` : ''}`);
  if (range.from) query = query.gte('created_at', range.from);
  if (range.toExclusive) query = query.lt('created_at', range.toExclusive);
  const [listing, allCount, confirmedCount, awaitingCount] = await Promise.all([
    range.error ? Promise.resolve({ data: null, count: null, error: null }) : query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('registrations').select('id', { count: 'exact', head: true }),
    db.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    db.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending_payment'),
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
    return `/admin/participants${params.size ? `?${params}` : ''}`;
  };
  if (!listing.error && !range.error && total > 0 && page > Math.ceil(total / PAGE_SIZE)) redirect(urlFor(Math.ceil(total / PAGE_SIZE)));
  const metric = (result: { count: number | null; error: unknown }) => result.error ? '—' : (result.count ?? 0).toLocaleString();

  return <AdminPage eyebrow="Platform / Management" title="Participants" description="" compactTop>
    <section aria-label="Registration totals" className="grid gap-3 sm:grid-cols-3"><StatCard label="All registrations" value={metric(allCount)} /><StatCard label="Confirmed" value={metric(confirmedCount)} tone="green" /><StatCard label="Awaiting payment" value={metric(awaitingCount)} tone="amber" /></section>
    {[allCount, confirmedCount, awaitingCount].some((result) => result.error) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Some totals could not be loaded. Refresh to try again.</p>}
    <form method="get" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(260px,1.5fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto] xl:items-end">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Registration status<select name="status" defaultValue={status} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal normal-case text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"><option value="all">All statuses</option>{STATUSES.filter((value) => value !== 'all').map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Search<span className="relative mt-1 block"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input name="q" defaultValue={search} maxLength={100} placeholder="Name, email, or registration no." className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm font-normal normal-case focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></span></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Registered from<input name="from" type="date" defaultValue={from} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Registered to<input name="to" type="date" defaultValue={to} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
      <div className="flex gap-2"><button type="submit" className="rounded-lg bg-[#071b41] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102b58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">Apply</button>{(search || status !== 'all' || from || to) && <Link href="/admin/participants" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-orange-400">Clear</Link>}</div>
    </form>
    <p className="text-xs text-slate-500">Dates use Philippine time. Totals above cover all registrations; the list below follows your filters.</p>
    {range.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{range.error}</p> : listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Participant registrations could not be loaded. Refresh to try again.</p> : <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-extrabold text-[#071b41]">Participant registrations</h2><span className="text-sm text-slate-500">{total.toLocaleString()} record{total === 1 ? '' : 's'}</span></div>{rows.length ? <DataTable headers={['Participant', 'Event / category', 'Registration', 'Payment', 'Registered', 'Action']}>{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-bold text-[#071b41]">{row.first_name} {row.last_name}</p><p className="text-xs text-slate-500">{row.email}</p></td><td className="px-4 py-4"><p className="font-semibold">{row.events?.name ?? 'Event unavailable'}</p><p className="text-xs text-slate-500">{row.race_categories?.name ?? 'Category unavailable'}</p></td><td className="px-4 py-4"><p className="font-mono text-xs">{row.registration_number}</p><StatusBadge value={row.status} />{row.bibs?.bib_code && <p className="mt-1 text-xs text-slate-500">Bib {row.bibs.bib_code}</p>}</td><td className="px-4 py-4">{row.payments ? <><StatusBadge value={row.payments.status} />{Number(row.payments.amount_paid) > 0 && <p className="mt-1 text-xs text-slate-500"><Money value={Number(row.payments.amount_paid)} currency={row.payments.currency} /> paid</p>}</> : <span className="text-xs text-slate-500">No payment record</span>}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{new Date(row.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td><td className="px-4 py-4"><Link href={`/admin/participants/${row.id}`} className="font-bold text-orange-600 hover:underline">View details →</Link></td></tr>)}</DataTable> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><Users size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">No registrations found</p><p className="mt-1 text-sm text-slate-500">{search || status !== 'all' || from || to ? 'Try adjusting the filters.' : 'Registrations will appear here when participants sign up.'}</p>{(search || status !== 'all' || from || to) && <Link href="/admin/participants" className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div>}</section>}
    {!range.error && !listing.error && total > PAGE_SIZE && <nav aria-label="Participant pages" className="flex items-center justify-between text-sm"><span className="text-slate-500">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span><div className="flex gap-2">{page > 1 && <Link href={urlFor(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Previous</Link>}{page * PAGE_SIZE < total && <Link href={urlFor(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Next</Link>}</div></nav>}
  </AdminPage>;
}
