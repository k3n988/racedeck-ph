import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

const pageRequest = z.object({
  action: z.literal('page'), search: z.string().trim().max(120).default(''),
  category_id: z.string().uuid().optional(), registration_type: z.enum(['all', 'account', 'guest']).default('all'),
  payment_status: z.enum(['all', 'succeeded', 'pending', 'processing', 'failed', 'expired', 'cancelled', 'partially_refunded', 'refunded']).default('all'),
  assignment_status: z.enum(['all', 'assigned', 'unassigned', 'automatic', 'manual']).default('all'),
  page: z.number().int().positive().default(1), page_size: z.union([z.literal(20), z.literal(30), z.literal(50)]).default(20),
});
const mutation = z.discriminatedUnion('action', [
  z.object({ action: z.literal('manual'), registration_id: z.string().uuid(), bib_number: z.number().int().positive().max(99999) }),
  z.object({ action: z.literal('reassign'), bib_id: z.string().uuid(), bib_number: z.number().int().positive().max(99999), confirm_claimed_correction: z.boolean().default(false) }),
  z.object({ action: z.literal('bulk') }),
]);

type RpcAdmin = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string; message: string } | null }> };
const rpc = (admin: ReturnType<typeof createAdminClient>) => admin as unknown as RpcAdmin;

async function authorize(eventId: string, requireParticipantView = false) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const internalAdmin = context.internalRoles.includes('admin') || context.internalRoles.includes('super_admin');
  let membership = context.memberships[0];
  for (const item of context.memberships) if (await hasPermission(item.organization_id, 'assign_bibs', eventId)) { membership = item; break; }
  if (!internalAdmin && (!membership || !(await hasPermission(membership.organization_id, 'assign_bibs', eventId)))) return { response: NextResponse.json({ error: 'Bib-management permission required' }, { status: 403 }) } as const;
  const canViewParticipantInfo = internalAdmin || Boolean(membership && await hasPermission(membership.organization_id, 'view_participants', eventId));
  if (requireParticipantView && !canViewParticipantInfo) return { response: NextResponse.json({ error: 'Participant-view permission required' }, { status: 403 }) } as const;
  const admin = createAdminClient();
  let eventQuery = admin.from('events').select('id,organization_id,name').eq('id', eventId);
  if (membership && !internalAdmin) eventQuery = eventQuery.eq('organization_id', membership.organization_id);
  const { data: event } = await eventQuery.maybeSingle();
  if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;
  return { context, event, canViewParticipantInfo } as const;
}

function sanitizeSearch(value: string) { return value.replace(/[(),.%_*:\\]/g, ' ').replace(/\s+/g, ' ').trim(); }

export async function GET(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await authorize(params.eventId, true);
  if ('response' in auth) return auth.response;
  const url = new URL(request.url);
  const raw = {
    action: 'page', search: url.searchParams.get('search') ?? '', category_id: url.searchParams.get('category_id') || undefined,
    registration_type: url.searchParams.get('registration_type') ?? 'all', payment_status: url.searchParams.get('payment_status') ?? 'all',
    assignment_status: url.searchParams.get('assignment_status') ?? 'all', page: Number(url.searchParams.get('page') ?? 1),
    page_size: Number(url.searchParams.get('page_size') ?? 20),
  };
  const parsed = pageRequest.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid bib-management filters' }, { status: 400 });
  const search = sanitizeSearch(parsed.data.search);
  if (parsed.data.search && !search) return NextResponse.json({ error: 'Enter letters or numbers to search.' }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: categories, error: categoriesError }, { data, error }] = await Promise.all([
    admin.from('race_categories').select('id,name,distance_km').eq('event_id', params.eventId).order('name'),
    rpc(admin).rpc('bib_management_page', {
      p_event_id: params.eventId, p_search: search, p_category_id: parsed.data.category_id ?? null,
      p_registration_type: parsed.data.registration_type, p_payment_status: parsed.data.payment_status,
      p_assignment_status: parsed.data.assignment_status, p_page: parsed.data.page, p_page_size: parsed.data.page_size,
    }),
  ]);
  if (categoriesError || error) return NextResponse.json({ error: 'Bib assignments could not be loaded' }, { status: 500 });
  return NextResponse.json({ event: auth.event, categories: categories ?? [], ...(data as Record<string, unknown>), can_view_participant_info: auth.canViewParticipantInfo });
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await authorize(params.eventId);
  if ('response' in auth) return auth.response;
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid bib assignment request' }, { status: 400 });
  const admin = createAdminClient();
  try {
    if (parsed.data.action === 'bulk') {
      const { data, error } = await rpc(admin).rpc('assign_missing_event_bibs', { p_event_id: params.eventId, p_assigned_by: auth.context.user.id });
      if (error) return NextResponse.json({ error: 'Missing bibs could not be assigned' }, { status: 409 });
      return NextResponse.json(data);
    }
    const call = parsed.data.action === 'manual'
      ? await rpc(admin).rpc('assign_manual_bib', { p_event_id: params.eventId, p_registration_id: parsed.data.registration_id, p_bib_number: parsed.data.bib_number, p_assigned_by: auth.context.user.id })
      : await rpc(admin).rpc('reassign_event_bib', { p_event_id: params.eventId, p_bib_id: parsed.data.bib_id, p_bib_number: parsed.data.bib_number, p_changed_by: auth.context.user.id, p_confirm_claimed_correction: parsed.data.confirm_claimed_correction });
    if (call.error) {
      const duplicate = call.error.code === '23505';
      return NextResponse.json({ error: duplicate ? 'That bib number has already been used for this event. Choose another number.' : call.error.message }, { status: 409 });
    }
    return NextResponse.json({ bib: call.data });
  } catch (error) {
    console.error('Bib operation failed', error);
    return NextResponse.json({ error: 'Bib operation could not be completed' }, { status: 500 });
  }
}
