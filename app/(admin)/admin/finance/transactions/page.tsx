import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { AdminPage, AdminPagination, DataTable, Money, StatusBadge } from '@/components/admin/admin-ui';
import { adminDateRange, adminPageNumber, adminSearch } from '@/lib/admin/list-query';
import { createAdminClient } from '@/lib/supabase/admin';
import TransactionFilters from './transaction-filters';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['all', 'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded', 'expired'] as const;
const shortenName = (value: string) => {
  const characters = Array.from(value);
  return characters.length > 20 ? `${characters.slice(0, 20).join('')}...` : value;
};

export default async function AdminTransactionsPage({ searchParams }: { searchParams?: { q?: string; status?: string; from?: string; to?: string; page?: string } }) {
  const db = createAdminClient();
  const search = adminSearch(searchParams?.q);
  const status = STATUSES.find((value) => value === searchParams?.status) ?? 'all';
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const range = adminDateRange(from, to);
  const page = adminPageNumber(searchParams?.page);
  let query = db.from('payments').select('id,registration_id,amount_due,currency,status,gateway_payment_id,created_at,registrations(first_name,middle_name,last_name,email,registration_number),events(name),organizations(name)', { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  if (search) query = UUID.test(search) ? query.or(`id.eq.${search},registration_id.eq.${search},gateway_payment_id.ilike.%${search}%`) : query.ilike('gateway_payment_id', `%${search}%`);
  if (range.from) query = query.gte('created_at', range.from);
  if (range.toExclusive) query = query.lt('created_at', range.toExclusive);
  const [listing] = await Promise.all([
    range.error ? Promise.resolve({ data: null, count: null, error: null }) : query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);
  const rows = listing.data ?? [];
  const total = listing.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const urlFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (nextPage > 1) params.set('page', String(nextPage));
    return `/admin/finance/transactions${params.size ? `?${params}` : ''}`;
  };
  if (!listing.error && !range.error && total > 0 && page > totalPages) redirect(urlFor(totalPages));
  return <AdminPage eyebrow="Finance" title="Transactions" description="" compactTop compactSections>
    <TransactionFilters search={search} status={status} from={from} to={to} />
    {range.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{range.error}</p> : listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Payment records could not be loaded. Refresh to try again.</p> : <section><DataTable headers={['#', 'Payment / registration', 'Participant', 'Event / organizer', 'Due', 'Payment', 'Created', 'Action']} footer={<AdminPagination page={page} total={total} pageSize={PAGE_SIZE} urlFor={urlFor} label="payments" ariaLabel="Payment pages" />}>
      {rows.length ? rows.map((row, index) => <tr key={row.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">{(page - 1) * PAGE_SIZE + index + 1}</td><td className="w-[220px] max-w-[220px] px-4 py-3"><p className="max-w-[220px] truncate font-mono text-xs font-bold" title={row.id}>{row.id}</p><p className="mt-1 truncate text-xs text-slate-500" title={row.registrations?.registration_number ?? row.registration_id}>{row.registrations?.registration_number ?? row.registration_id}</p></td><td className="px-4 py-3">{row.registrations ? <><p className="font-semibold">{row.registrations.first_name} {row.registrations.middle_name ? `${row.registrations.middle_name} ` : ''}{row.registrations.last_name}</p><p className="mt-1 text-xs text-slate-500">{row.registrations.email}</p></> : 'Participant unavailable'}</td><td className="px-4 py-3"><p className="font-semibold" title={row.events?.name ?? 'Event unavailable'}>{shortenName(row.events?.name ?? 'Event unavailable')}</p><p className="text-xs text-slate-500" title={row.organizations?.name ?? 'Organizer unavailable'}>{shortenName(row.organizations?.name ?? 'Organizer unavailable')}</p></td><td className="whitespace-nowrap px-4 py-3 text-sm font-semibold"><Money value={Number(row.amount_due)} currency={row.currency} /></td><td className="px-4 py-3"><StatusBadge value={row.status} /></td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(row.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td><td className="px-4 py-3"><Link href={`/admin/finance/transactions/${row.id}`} className="font-bold text-orange-600 hover:underline">View details →</Link></td></tr>) : <tr><td colSpan={8} className="px-4 py-10 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><CreditCard size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">No payment records found</p><p className="mt-1 text-sm text-slate-500">{search || status !== 'all' || from || to ? 'Try adjusting the filters.' : 'Payments will appear here when checkouts begin.'}</p>{(search || status !== 'all' || from || to) && <Link href="/admin/finance/transactions" className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div></td></tr>}
    </DataTable></section>}
  </AdminPage>;
}
