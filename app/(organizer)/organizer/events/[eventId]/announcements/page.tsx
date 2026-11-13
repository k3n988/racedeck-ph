'use client';

import { ToastFeedback } from '@/components/toast-feedback';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type Announcement = {
  id: string;
  title: string;
  message: string;
  audience: 'all_confirmed' | 'category_confirmed';
  race_category_id: string | null;
  delivery_channels: Array<'in_app' | 'email'>;
  status: string;
  sent_at: string | null;
  created_at: string;
  race_categories: { id: string; name: string } | { id: string; name: string }[] | null;
};
type Category = { id: string; name: string };

const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

function categoryName(value: Announcement['race_categories']) {
  return Array.isArray(value) ? value[0]?.name : value?.name;
}

export default function AnnouncementsPage({ params }: { params: { eventId: string } }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all_confirmed' | 'category_confirmed'>('all_confirmed');
  const [categoryId, setCategoryId] = useState('');
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const submissionKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [announcementResponse, categoryResponse] = await Promise.all([
        fetch(`/api/organizer/events/${params.eventId}/announcements`, { cache: 'no-store' }),
        fetch(`/api/organizer/events/${params.eventId}/categories`, { cache: 'no-store' }),
      ]);
      const announcementData = await announcementResponse.json().catch(() => ({}));
      if (!announcementResponse.ok) throw new Error(announcementData.error ?? 'Announcements could not be loaded.');
      const categoryData = categoryResponse.ok ? await categoryResponse.json().catch(() => []) : [];
      setItems(Array.isArray(announcementData.announcements) ? announcementData.announcements : []);
      setCategories(Array.isArray(categoryData) ? categoryData.map((item: Category) => ({ id: item.id, name: item.name })) : []);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Announcements could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params.eventId]);

  useEffect(() => { void load(); }, [load]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inApp && !email) {
      setNotice('Choose at least one delivery channel.');
      return;
    }
    setBusy(true);
    setNotice('');
    const idempotencyKey = submissionKey.current ?? crypto.randomUUID();
    submissionKey.current = idempotencyKey;
    try {
      const response = await fetch(`/api/organizer/events/${params.eventId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: body.trim(),
          audience,
          race_category_id: audience === 'category_confirmed' ? categoryId : null,
          delivery_channels: [inApp ? 'in_app' : null, email ? 'email' : null].filter(Boolean),
          idempotency_key: idempotencyKey,
        }),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseBody.error ?? 'Announcement could not be sent.');
      submissionKey.current = null;
      setTitle('');
      setBody('');
      await load();
      setNotice(`Announcement queued for ${responseBody.recipient_count ?? 0} confirmed participant${responseBody.recipient_count === 1 ? '' : 's'}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Announcement could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  const noticeIsError = /could not|failed|error|choose at least/i.test(notice);

  return <main className="mx-auto max-w-6xl space-y-6 bg-[#f4f6fa] p-4 sm:p-6 lg:p-8">
    <header className="border-b border-slate-200 pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Event operations</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071b41] sm:text-3xl">Announcements</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Send an update to confirmed participants by in-app notification, email, or both.</p>
    </header>

    {notice && <ToastFeedback message={String(notice)} tone="auto">{noticeIsError && !loading ? <div className="flex flex-wrap items-center justify-between gap-3"><span>{notice}</span>{notice.toLowerCase().includes('could not') && <button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline underline-offset-2">Refresh announcements</button>}</div> : undefined}</ToastFeedback>}

    <form onSubmit={(event) => void send(event)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5"><h2 className="text-lg font-bold text-[#071b41]">Create announcement</h2><p className="mt-1 text-sm text-slate-600">Only confirmed participants in your selected audience will receive it.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700 lg:col-span-2">Title
          <input required maxLength={200} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} placeholder="Race-day schedule update" className={inputClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700 lg:col-span-2">Message
          <textarea required maxLength={10000} rows={6} value={body} disabled={busy} onChange={(event) => setBody(event.target.value)} placeholder="Write a clear update for participants…" className={`${inputClass} min-h-36 resize-y leading-6`} />
          <span className="mt-1 block text-right text-xs font-normal text-slate-500">{body.length.toLocaleString()}/10,000</span>
        </label>
        <label className="block text-sm font-semibold text-slate-700">Audience
          <select value={audience} disabled={busy} onChange={(event) => { const value = event.target.value as typeof audience; setAudience(value); if (value === 'all_confirmed') setCategoryId(''); }} className={inputClass}>
            <option value="all_confirmed">All confirmed participants</option>
            <option value="category_confirmed">One race category</option>
          </select>
        </label>
        {audience === 'category_confirmed' && <label className="block text-sm font-semibold text-slate-700">Race category
          <select required value={categoryId} disabled={busy || !categories.length} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}>
            <option value="">{categories.length ? 'Select a category' : 'No categories available'}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>}
      </div>
      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-slate-700">Delivery channels</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={inApp} disabled={busy} onChange={(event) => setInApp(event.target.checked)} className="h-4 w-4 accent-orange-600" />In-app notification</label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={email} disabled={busy} onChange={(event) => setEmail(event.target.checked)} className="h-4 w-4 accent-orange-600" />Email</label>
        </div>
      </fieldset>
      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
        <button disabled={busy || loading || !title.trim() || !body.trim() || (!inApp && !email) || (audience === 'category_confirmed' && !categoryId)} className="min-h-11 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Sending…' : 'Send announcement'}</button>
      </div>
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div><h2 className="text-lg font-bold text-[#071b41]">Announcement history</h2><p className="mt-1 text-sm text-slate-600">Recent updates sent for this event.</p></div>
        {!loading && <span className="text-xs font-semibold text-slate-500">{items.length} announcement{items.length === 1 ? '' : 's'}</span>}
      </div>
      {loading ? <div role="status" className="space-y-3 p-5"><span className="sr-only">Loading announcements…</span><div className="h-12 animate-pulse rounded-lg bg-slate-100" /><div className="h-12 animate-pulse rounded-lg bg-slate-100" /></div> : items.length === 0 ? <p className="m-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">No announcements yet. Sent updates will appear here.</p> : <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Title</th><th className="px-5 py-3 font-semibold">Audience</th><th className="px-5 py-3 font-semibold">Channels</th><th className="px-5 py-3 font-semibold">Created</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className="text-slate-700 hover:bg-slate-50/70"><td className="max-w-xs px-5 py-3.5 font-semibold text-[#071b41]">{item.title}</td><td className="px-5 py-3.5">{item.audience === 'all_confirmed' ? 'All confirmed' : categoryName(item.race_categories) ?? 'Selected category'}</td><td className="px-5 py-3.5">{item.delivery_channels.map((channel) => channel === 'in_app' ? 'In-app' : 'Email').join(', ')}</td><td className="whitespace-nowrap px-5 py-3.5">{new Date(item.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</td><td className="px-5 py-3.5"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">{item.status.replaceAll('_', ' ')}</span></td></tr>)}</tbody>
        </table>
      </div>}
    </section>
  </main>;
}
