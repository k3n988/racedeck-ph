import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireOrganizerPermission, errorResponse } from '@/lib/auth/organizer-access';

type ContentPageInput = {
  id: string;
  title: string;
  type: 'system' | 'custom';
  visible: boolean;
  content: string;
};

const PAGE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SYSTEM_PAGE_KEYS = new Set(['event-details', 'race-mechanics', 'faqs']);
function missingTableResponse(error: { code?: string; message?: string } | null) {
  if (!error || !(
    error.code === 'PGRST205' || error.code === '42P01' ||
    /event_content_pages.*(schema cache|does not exist|could not find)/i.test(error.message ?? '')
  )) return null;
  return NextResponse.json({ error: 'Event content storage is not installed in Supabase yet. Apply the pending event_content_pages migration, then retry.' }, { status: 503 });
}

function parsePages(rawPages: unknown): ContentPageInput[] | null {
  if (!Array.isArray(rawPages) || rawPages.length > 12) return null;
  const pages: ContentPageInput[] = [];
  const keys = new Set<string>();
  for (const rawPage of rawPages) {
    if (!rawPage || typeof rawPage !== 'object') return null;
    const page = rawPage as Record<string, unknown>;
    if (
      typeof page.id !== 'string' || !PAGE_KEY.test(page.id) || keys.has(page.id) ||
      typeof page.title !== 'string' || !page.title.trim() || page.title.trim().length > 80 ||
      !['system', 'custom'].includes(String(page.type)) ||
      typeof page.visible !== 'boolean' || typeof page.content !== 'string' || page.content.length > 50000
    ) return null;
    if (SYSTEM_PAGE_KEYS.has(page.id) !== (page.type === 'system')) return null;
    keys.add(page.id);
    pages.push({ id: page.id, title: page.title.trim(), type: page.type as ContentPageInput['type'], visible: page.visible, content: page.content });
  }
  return pages;
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('view_events', params.eventId);
  if ('response' in auth) return auth.response;
  const db = auth.admin as unknown as SupabaseClient;
  const { data, error } = await db.from('event_content_pages')
    .select('page_key,title,page_type,content,is_visible,display_order')
    .eq('event_id', params.eventId)
    .eq('organization_id', auth.membership.organization_id)
    .order('display_order').order('created_at');
  if (error) return missingTableResponse(error) ?? errorResponse(error, 'Loading event content pages');
  return NextResponse.json({ pages: (data ?? []).map((page) => ({ id: page.page_key, title: page.title, type: page.page_type, content: page.content, visible: page.is_visible })) });
}

export async function PUT(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await requireOrganizerPermission('edit_events', params.eventId);
  if ('response' in auth) return auth.response;
  const parsed = parsePages((await request.json().catch(() => null))?.pages);
  if (!parsed) return NextResponse.json({ error: 'Invalid event content. Use up to 12 uniquely named tabs; each title must be 1–80 characters and each page must be under 50,000 characters.' }, { status: 400 });
  const db = auth.admin as unknown as SupabaseClient;
  const { data: event, error: eventError } = await auth.admin.from('events')
    .select('id,lifecycle_status,review_status')
    .eq('id', params.eventId)
    .eq('organization_id', auth.membership.organization_id)
    .maybeSingle();
  if (eventError) return errorResponse(eventError, 'Checking event before saving content');
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.review_status === 'pending_review' || (event.lifecycle_status === 'draft' && event.review_status === 'approved')) {
    return NextResponse.json({ error: 'Event content cannot be edited while the event is under review.' }, { status: 409 });
  }

  const rows = parsed.map((page, display_order) => ({
    event_id: params.eventId,
    organization_id: auth.membership.organization_id,
    page_key: page.id,
    title: page.title,
    page_type: page.type,
    content: page.content,
    is_visible: page.visible,
    display_order,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length) {
    const { error } = await db.from('event_content_pages').upsert(rows, { onConflict: 'event_id,page_key' });
    if (error) return missingTableResponse(error) ?? errorResponse(error, 'Saving event content pages');
  }
  const keepKeys = parsed.map((page) => page.id);
  let remove = db.from('event_content_pages').delete().eq('event_id', params.eventId).eq('organization_id', auth.membership.organization_id);
  if (keepKeys.length) remove = remove.not('page_key', 'in', `(${keepKeys.join(',')})`);
  const { error: deleteError } = await remove;
  if (deleteError) return missingTableResponse(deleteError) ?? errorResponse(deleteError, 'Removing deleted event content pages');
  return NextResponse.json({ pages: parsed.length });
}
