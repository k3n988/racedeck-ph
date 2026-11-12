import { ToastFeedback } from '@/components/toast-feedback';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPage, DataTable, EmptyState, StatCard, StatusBadge } from '@/components/admin/admin-ui';
import { saveContentBlock } from './actions';

export const dynamic = 'force-dynamic';
const types = ['featured_race', 'homepage_banner', 'homepage_section', 'platform_announcement'] as const;

export default async function AdminContentPage({ searchParams }: { searchParams?: { q?: string; type?: string; state?: string; edit?: string; notice?: string } }) {
  const db = createAdminClient();
  const search = searchParams?.q?.replace(/[^a-zA-Z0-9\s@._-]/g, ' ').trim().slice(0, 100) ?? '';
  const type = types.find((candidate) => candidate === searchParams?.type);
  const state = ['published', 'draft', 'inactive'].includes(searchParams?.state ?? '') ? searchParams?.state : 'all';
  let query = db.from('content_blocks').select('id,content_key,content_type,title,body,media_reference,event_id,display_order,is_active,is_published,published_at,updated_at,events(name)').order('display_order').order('updated_at', { ascending: false }).limit(100);
  if (search) query = query.or(`title.ilike.%${search.replace(/[,%()]/g, ' ')}%,content_key.ilike.%${search.replace(/[,%()]/g, ' ')}%`);
  if (type) query = query.eq('content_type', type);
  if (state === 'published') query = query.eq('is_published', true);
  if (state === 'draft') query = query.eq('is_published', false).eq('is_active', true);
  if (state === 'inactive') query = query.eq('is_active', false);
  const [{ data, error }, { data: events }] = await Promise.all([
    query,
    db.from('events').select('id,name').eq('review_status', 'approved').eq('lifecycle_status', 'published').order('event_date', { ascending: true }),
  ]);
  const rows = data ?? [];
  const edit = rows.find((row) => row.id === searchParams?.edit);
  const [{ count: total }, { count: published }] = await Promise.all([
    db.from('content_blocks').select('id', { count: 'exact', head: true }),
    db.from('content_blocks').select('id', { count: 'exact', head: true }).eq('is_published', true),
  ]);

  const editor = (row?: (typeof rows)[number]) => <form action={saveContentBlock} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
    {row && <input type="hidden" name="id" value={row.id} />}
    <label className="grid gap-1 text-sm font-semibold text-slate-700">Content key<input name="content_key" required maxLength={80} pattern="[a-z0-9][a-z0-9_-]{1,79}" defaultValue={row?.content_key ?? ''} placeholder="homepage_summer_banner" className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>
    <label className="grid gap-1 text-sm font-semibold text-slate-700">Content type<select name="content_type" defaultValue={row?.content_type ?? 'homepage_section'} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">{types.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Title<input name="title" required maxLength={180} defaultValue={row?.title ?? ''} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>
    <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Body<textarea name="body" rows={4} defaultValue={row?.body ?? ''} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>
    <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">Media URL <span className="font-normal text-slate-500">Optional; use an HTTPS URL</span><input type="url" name="media_reference" defaultValue={row?.media_reference ?? ''} placeholder="https://…" className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>
    <label className="grid gap-1 text-sm font-semibold text-slate-700">Featured event <span className="font-normal text-slate-500">Required only for Featured race</span><select name="event_id" defaultValue={row?.event_id ?? ''} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">No linked event</option>{(events ?? []).map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-semibold text-slate-700">Display order<input type="number" name="display_order" min="0" max="10000" step="1" defaultValue={row?.display_order ?? 0} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>
    <div className="flex flex-wrap items-center gap-5 md:col-span-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={row?.is_active ?? false} /> Active</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_published" defaultChecked={row?.is_published ?? false} /> Published publicly</label></div>
    <div className="flex gap-3 md:col-span-2"><button className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white">{row ? 'Save changes' : 'Create content'}</button>{row && <Link href="/admin/content-management" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold">Cancel</Link>}</div>
  </form>;

  return <AdminPage eyebrow="Platform / Content" title="Content Management" description="" compactTop>
    {searchParams?.notice === 'saved' && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Content saved.</p>}
    {error && <ToastFeedback message={String(error)} tone="error"><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Content could not be loaded. Refresh the page to try again.</p></ToastFeedback>}
    <section className="grid gap-3 sm:grid-cols-3"><StatCard label="Content blocks" value={total ?? '—'} /><StatCard label="Published" value={published ?? '—'} tone="green" /><StatCard label="Needs publishing" value={Math.max(0, (total ?? 0) - (published ?? 0))} tone="amber" /></section>
    {edit && <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-bold text-[#071b41]">Edit content block</h2><p className="text-sm text-slate-500">Changes take effect on public pages after publishing.</p></div>{editor(edit)}</section>}
    <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" open={searchParams?.edit ? false : undefined}><summary className="cursor-pointer font-bold text-[#071b41]">Create content block</summary><p className="mb-4 mt-2 text-sm text-slate-500">Published content is immediately visible to public visitors. Preview and verify copy and links before publishing.</p>{editor()}</details>
    <form method="get" className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><input name="q" defaultValue={search} placeholder="Search title or key" aria-label="Search content" className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><select name="type" defaultValue={type ?? ''} aria-label="Content type" className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">All content types</option>{types.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select><select name="state" defaultValue={state} aria-label="Publication state" className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="all">All states</option><option value="published">Published</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select><button className="rounded-lg bg-[#071b41] px-4 py-2 text-sm font-bold text-white">Filter</button><Link href="/admin/content-management" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Clear</Link></form>
    {rows.length ? <DataTable headers={['Content','Type','Linked event','Status','Updated','Action']}>{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-bold">{row.title}</p><p className="font-mono text-xs text-slate-500">{row.content_key}</p></td><td className="px-4 py-4 capitalize">{row.content_type.replaceAll('_', ' ')}</td><td className="px-4 py-4">{row.events?.name ?? '—'}</td><td className="px-4 py-4"><StatusBadge value={row.is_published ? 'published' : row.is_active ? 'draft' : 'inactive'} /></td><td className="px-4 py-4 text-xs text-slate-500">{new Date(row.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td><td className="px-4 py-4"><Link href={`/admin/content-management?edit=${row.id}`} className="font-bold text-orange-600">Edit</Link></td></tr>)}</DataTable> : !error && <EmptyState message="No content blocks match these filters." />}
  </AdminPage>;
}
