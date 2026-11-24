import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { AdminPage, AdminPagination, DataTable, StatCard, StatusBadge, Money } from '@/components/admin/admin-ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminDateRange, adminPageNumber, adminSearch } from '@/lib/admin/list-query';
import ParticipantFilters from './participant-filters';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const PAGE_SIZES = [20, 50, 100] as const;
const STATUSES = ['all', 'pending_payment', 'confirmed', 'cancelled', 'transferred', 'refunded', 'expired'] as const;
const PAYMENT_STATUSES = ['all', 'succeeded', 'pending', 'processing', 'failed', 'cancelled', 'partially_refunded', 'refunded'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminParticipantsPage({ searchParams }: { searchParams?: { q?: string; status?: string; from?: string; to?: string; organizer?: string; event?: string; payment_status?: string; page?: string; rows?: string } }) {
  const db = createAdminClient();
  const search = adminSearch(searchParams?.q);
  const status = STATUSES.find((value) => value === searchParams?.status) ?? 'all';
  const from = searchParams?.from ?? '';
  const to = searchParams?.to ?? '';
  const organizer = UUID.test(searchParams?.organizer ?? '') ? searchParams!.organizer! : '';
  const event = UUID.test(searchParams?.event ?? '') ? searchParams!.event! : '';
  const paymentStatus = PAYMENT_STATUSES.find((value) => value === searchParams?.payment_status) ?? 'all';
  const range = adminDateRange(from, to);
  const page = adminPageNumber(searchParams?.page);
  const requestedPageSize = Number(searchParams?.rows);
  const pageSize = PAGE_SIZES.includes(requestedPageSize as typeof PAGE_SIZES[number]) ? requestedPageSize : PAGE_SIZE;
  const safeSearch = search.replace(/[,.%()]/g, ' ').trim();
  let query = db.from('registrations').select(`id,registration_number,user_id,first_name,middle_name,last_name,email,mobile,status,created_at,events${organizer ? '!inner' : ''}(id,name,organization_id),race_categories(name),payments${paymentStatus !== 'all' ? '!inner' : ''}(status,amount_paid,currency),bibs!registrations_bib_id_fkey(bib_code)`, { count: 'exact' });
  if (status !== 'all') query = query.eq('status', status);
  if (safeSearch) query = query.or(`first_name.ilike.%${safeSearch}%,middle_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,registration_number.ilike.%${safeSearch}%${UUID.test(search) ? `,id.eq.${search}` : ''}`);
  if (range.from) query = query.gte('created_at', range.from);
  if (range.toExclusive) query = query.lt('created_at', range.toExclusive);
  if (event) query = query.eq('event_id', event);
  if (organizer) query = query.eq('events.organization_id', organizer);
  if (paymentStatus !== 'all') query = query.eq('payments.status', paymentStatus);
  const [listing, allCount, confirmedCount, awaitingCount, cancelledCount, organizerOptions, eventOptions] = await Promise.all([
    range.error ? Promise.resolve({ data: null, count: null, error: null }) : query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    db.from('registrations').select('id', { count: 'exact', head: true }),
    db.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    db.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'pending_payment'),
    db.from('registrations').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
    db.from('organizations').select('id,name').order('name'),
    db.from('events').select('id,name').order('event_date', { ascending: false }),
  ]);
  const rows = listing.data ?? [];
  const total = listing.count ?? 0;
  const urlFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (organizer) params.set('organizer', organizer);
    if (event) params.set('event', event);
    if (paymentStatus !== 'all') params.set('payment_status', paymentStatus);
    if (pageSize !== PAGE_SIZE) params.set('rows', String(pageSize));
    if (nextPage > 1) params.set('page', String(nextPage));
    return `/admin/participants${params.size ? `?${params}` : ''}`;
  };
  if (!listing.error && !range.error && total > 0 && page > Math.ceil(total / pageSize)) redirect(urlFor(Math.ceil(total / pageSize)));
  if (!listing.error && !range.error && total === 0 && page > 1) redirect(urlFor(1));
  const metric = (result: { count: number | null; error: unknown }) => result.error ? '—' : (result.count ?? 0).toLocaleString();
  const pageSizeControl = <form method="get" className="flex items-center gap-2">{search && <input type="hidden" name="q" value={search} />}<input type="hidden" name="status" value={status} />{from && <input type="hidden" name="from" value={from} />}{to && <input type="hidden" name="to" value={to} />}{organizer && <input type="hidden" name="organizer" value={organizer} />}{event && <input type="hidden" name="event" value={event} />}{paymentStatus !== 'all' && <input type="hidden" name="payment_status" value={paymentStatus} />}<label htmlFor="participant-page-size" className="text-slate-600">Rows</label><select id="participant-page-size" name="rows" defaultValue={pageSize} className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select><button type="submit" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-orange-400">Apply</button></form>;
  const pagination = !range.error && !listing.error ? <AdminPagination page={page} total={total} pageSize={pageSize} urlFor={urlFor} label="participants" ariaLabel="Participant pages" pageSizeControl={pageSizeControl} /> : null;

  return <AdminPage eyebrow="Platform / Management" title="Participants" description="" compactTop compactSections>
    <ParticipantFilters status={status} search={search} from={from} to={to} organizer={organizer} event={event} paymentStatus={paymentStatus} organizers={organizerOptions.data ?? []} events={eventOptions.data ?? []} />
    {[allCount, confirmedCount, awaitingCount, cancelledCount].some((result) => result.error) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Some totals could not be loaded. Refresh to try again.</p>}
    {(organizerOptions.error || eventOptions.error) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Some organizer or event filter options could not be loaded.</p>}
    <section aria-label="Registration totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="All registrations" value={metric(allCount)} /><StatCard label="Confirmed" value={metric(confirmedCount)} tone="green" /><StatCard label="Awaiting payment" value={metric(awaitingCount)} tone="amber" /><StatCard label="Cancelled" value={metric(cancelledCount)} /></section>
    {range.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{range.error}</p> : listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Participant registrations could not be loaded. Refresh to try again.</p> : <section>
      <DataTable footer={pagination} headers={['#', 'Participant', 'Event / category', 'Registration', 'Payment', 'Registered', 'Action']}>
        {rows.length ? rows.map((row, index) => <tr key={row.id} className="hover:bg-slate-50">
          <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-slate-500">{(page - 1) * pageSize + index + 1}</td>
          <td className="px-4 py-4"><p className="font-bold text-[#071b41]">{row.first_name} {row.middle_name ? `${row.middle_name} ` : ''}{row.last_name}</p><p className="text-xs text-slate-500">{row.email}</p></td>
          <td className="px-4 py-4"><p className="font-semibold">{row.events?.name ?? 'Event unavailable'}</p><p className="text-xs text-slate-500">{row.race_categories?.name ?? 'Category unavailable'}</p></td>
          <td className="px-4 py-4"><p className="whitespace-nowrap font-mono text-xs">{row.registration_number}</p><StatusBadge value={row.status} />{row.bibs?.bib_code && <p className="mt-1 text-xs text-slate-500">Bib {row.bibs.bib_code}</p>}</td>
          <td className="px-4 py-4">{row.payments ? <><StatusBadge value={row.payments.status} />{Number(row.payments.amount_paid) > 0 && <p className="mt-1 text-xs text-slate-500"><Money value={Number(row.payments.amount_paid)} currency={row.payments.currency} /> paid</p>}</> : <span className="text-xs text-slate-500">No payment record</span>}</td>
          <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{new Date(row.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
          <td className="px-4 py-4"><Link href={`/admin/participants/${row.id}`} className="font-bold text-orange-600 hover:underline">View details ?</Link></td>
        </tr>) : <tr><td colSpan={7} className="px-4 py-10 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><Users size={23} aria-hidden="true" /></span><p className="mt-3 font-bold text-[#071b41]">No registrations found</p><p className="mt-1 text-sm text-slate-500">{search || status !== 'all' || from || to || organizer || event || paymentStatus !== 'all' ? 'Try adjusting the filters.' : 'Registrations will appear here when participants sign up.'}</p>{(search || status !== 'all' || from || to || organizer || event || paymentStatus !== 'all') && <Link href="/admin/participants" className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div></td></tr>}
      </DataTable>
    </section>}

  </AdminPage>;
}
