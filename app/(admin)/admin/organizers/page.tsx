import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clock3, Search, UsersRound } from 'lucide-react';
import { AdminPage, DataTable, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { createAdminClient } from '@/lib/supabase/admin';
import OrganizerFilters from './organizer-filters';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const PAGE_SIZES = [20, 50, 100] as const;
const STATUSES = ['all', 'pending_review', 'needs_changes', 'approved', 'rejected', 'draft'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminOrganizersPage({ searchParams }: { searchParams?: { status?: string; q?: string; event?: string; page?: string; rows?: string } }) {
  const db = createAdminClient();
  const status = STATUSES.find((value) => value === searchParams?.status) ?? 'all';
  const eventId = UUID.test(searchParams?.event ?? '') ? searchParams!.event! : '';
  const eventOptions = await db.from('events').select('id,name,organization_id').order('event_date', { ascending: false });
  const selectedEvent = eventOptions.data?.find((event) => event.id === eventId);
  const search = (searchParams?.q ?? '').trim().slice(0, 100);
  const safeSearch = search.replace(/[,%().]/g, ' ');
  const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
  const requestedPageSize = Number(searchParams?.rows);
  const pageSize = PAGE_SIZES.includes(requestedPageSize as typeof PAGE_SIZES[number]) ? requestedPageSize : PAGE_SIZE;
  let query = db.from('organizations').select('id,name,contact_email,account_status,verification_status,created_at,updated_at,organizer_verifications(status,submitted_at)', { count: 'exact' });
  if (eventId) query = query.eq('id', selectedEvent?.organization_id ?? '00000000-0000-0000-0000-000000000000');
  if (status !== 'all') query = query.eq('verification_status', status);
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,contact_email.ilike.%${safeSearch}%`);
  const [listing, totalCount, pendingCount, approvedCount, needsChangesCount] = await Promise.all([
    query.order('updated_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    db.from('organizations').select('id', { count: 'exact', head: true }),
    db.from('organizations').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending_review'),
    db.from('organizations').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved').eq('account_status', 'active'),
    db.from('organizations').select('id', { count: 'exact', head: true }).eq('verification_status', 'needs_changes'),
  ]);
  const rows = listing.data ?? [];
  const total = listing.count ?? 0;
  const urlFor = (nextPage: number) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (eventId) params.set('event', eventId);
    if (search) params.set('q', search);
    if (pageSize !== PAGE_SIZE) params.set('rows', String(pageSize));
    if (nextPage > 1) params.set('page', String(nextPage));
    return `/admin/organizers${params.size ? `?${params}` : ''}`;
  };
  if (!listing.error && total > 0 && page > Math.ceil(total / pageSize)) redirect(urlFor(Math.ceil(total / pageSize)));
  const pagination = !listing.error && total > 0 ? <nav aria-label="Organization pages" className="flex flex-wrap items-center justify-between gap-3 text-sm"><div className="flex flex-wrap items-center gap-4"><span className="text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}</span><form method="get" className="flex items-center gap-2"><input type="hidden" name="status" value={status} />{eventId && <input type="hidden" name="event" value={eventId} />}{search && <input type="hidden" name="q" value={search} />}<label htmlFor="organizer-page-size" className="text-slate-600">Rows</label><select id="organizer-page-size" name="rows" defaultValue={pageSize} className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select><button type="submit" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-orange-400">Apply</button></form></div><div className="flex items-center gap-2"><span className="px-2 text-slate-600">Page {page} of {Math.ceil(total / pageSize)}</span>{page > 1 && <Link href={urlFor(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Previous</Link>}{page * pageSize < total && <Link href={urlFor(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">Next</Link>}</div></nav> : null;

  return <AdminPage eyebrow="Platform / Management" title="Organizers" description="" compactTop compactSections>
    <OrganizerFilters status={status} search={search} events={eventOptions.data ?? []} eventId={eventId} />
    <section aria-label="Organization summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="All organizations" value={totalCount.error ? '—' : (totalCount.count ?? 0).toLocaleString()} detail="Organization accounts" />
      <StatCard label="Awaiting review" value={pendingCount.error ? '—' : (pendingCount.count ?? 0).toLocaleString()} detail="Applications to review" tone="amber" />
      <StatCard label="Approved and active" value={approvedCount.error ? '—' : (approvedCount.count ?? 0).toLocaleString()} detail="Ready to manage events" tone="green" />
      <StatCard label="Needs changes" value={needsChangesCount.error ? '—' : (needsChangesCount.count ?? 0).toLocaleString()} detail="Waiting on organizer" tone="orange" />
    </section>
    {listing.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Organizations could not be loaded. Refresh this page to try again.</p> : rows.length ? <section aria-label="Organization records" className="space-y-2">
      <DataTable headers={['#', 'Organization', 'Contact email', 'Verification', 'Account status', 'Created', 'Last updated', 'Action']} footer={pagination}>
        {rows.map((organization, index) => <tr key={organization.id} className="align-middle hover:bg-slate-50">
          <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">{(page - 1) * pageSize + index + 1}</td>
          <td className="px-4 py-3"><Link href={`/admin/organizers/${organization.id}`} className="font-bold text-[#071b41] hover:text-orange-700">{organization.name || 'Unnamed organization'}</Link></td>
          <td className="max-w-64 break-all px-4 py-3 text-slate-600">{organization.contact_email || '—'}</td>
          <td className="px-4 py-3"><StatusBadge value={organization.organizer_verifications?.status ?? organization.verification_status} /></td>
          <td className="px-4 py-3"><StatusBadge value={organization.account_status} /></td>
          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{new Date(organization.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{new Date(organization.updated_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</td>
          <td className="whitespace-nowrap px-4 py-3"><Link href={`/admin/organizers/${organization.id}`} className="font-bold text-orange-600 hover:underline">{organization.verification_status === 'pending_review' ? 'Review' : 'View'} →</Link></td>
        </tr>)}
      </DataTable>
    </section> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">{status === 'pending_review' ? <Clock3 size={23} aria-hidden="true" /> : search ? <Search size={23} aria-hidden="true" /> : <UsersRound size={23} aria-hidden="true" />}</span><p className="mt-3 font-bold text-[#071b41]">{search ? 'No organizations match this search' : status === 'pending_review' ? 'Review queue is clear' : 'No organizations found'}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try a different organization name or contact email.' : status === 'pending_review' ? 'New applications will appear here when organizers submit them.' : 'Organization accounts will appear here once they are created.'}</p>{(search || status !== 'all') && <Link href="/admin/organizers" className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:border-orange-400">Clear filters</Link>}</div>}
  </AdminPage>;
}
