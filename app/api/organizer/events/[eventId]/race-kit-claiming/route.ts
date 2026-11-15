import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyRegistrationToken } from '@/lib/qr/qr.service';
import { raceKitEligibility } from '@/lib/race-kit/claiming';

const lookupInput = z.object({ action: z.literal('lookup'), registration_id: z.string().uuid().optional(), registration_number: z.string().trim().min(2).max(120).optional(), qr_value: z.string().trim().min(1).max(2000).optional(), participant_query: z.string().trim().min(2).max(120).optional() }).refine(value => Boolean(value.registration_id || value.registration_number || value.qr_value || value.participant_query), 'Provide a registration ID, registration number, QR value, or participant search.');
const claimInput = z.object({ action: z.literal('claim'), registration_id: z.string().uuid(), claim_method: z.enum(['qr_scan', 'manual_lookup']), qr_value: z.string().trim().max(2000).optional() }).refine(value => value.claim_method !== 'qr_scan' || Boolean(value.qr_value), 'Scan a valid registration QR before confirming a QR claim.');
const input = z.discriminatedUnion('action', [lookupInput, claimInput]);
const normalizeSearch = (value: string) => value.replace(/[(),.%_*:]/g, ' ').replace(/\s+/g, ' ').trim();

async function authorize(eventId: string) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  const internalAdmin = context.internalRoles.includes('admin') || context.internalRoles.includes('super_admin');
  let membership = context.memberships[0];
  if (!membership) for (const item of context.memberships) if (await hasPermission(item.organization_id, 'scan_race_kits', eventId)) { membership = item; break; }
  if (!internalAdmin && (!membership || !(await hasPermission(membership.organization_id, 'scan_race_kits', eventId)))) return { response: NextResponse.json({ error: 'Race-kit claiming permission required' }, { status: 403 }) } as const;
  const admin = createAdminClient();
  let query = admin.from('events').select('id,organization_id,name,event_date').eq('id', eventId);
  if (membership && !internalAdmin) query = query.eq('organization_id', membership.organization_id);
  const { data: event, error } = await query.maybeSingle();
  if (error || !event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;
  return { context, event, admin } as const;
}

function parseQr(value: string) {
  try {
    const parsed = JSON.parse(value) as { registration_id?: string; token?: string };
    if (parsed.registration_id && parsed.token && verifyRegistrationToken(parsed.registration_id, parsed.token)) return parsed;
  } catch { /* Invalid JSON is an invalid QR credential. */ }
  return null;
}

async function loadClaimView(admin: ReturnType<typeof createAdminClient>, eventId: string, registrationId: string, qrValue?: string) {
  if (qrValue) { const payload = parseQr(qrValue); if (!payload || payload.registration_id !== registrationId) return { error: 'Invalid registration QR' } as const; }
  const { data: registration, error } = await admin.from('registrations').select('id,registration_number,event_id,category_id,user_id,status,first_name,middle_name,last_name,email,mobile,shirt_size,bib_id,race_categories(id,name,distance_km),payments(status,paid_at),bibs!registrations_bib_id_fkey(id,bib_number,bib_code,status)').eq('id', registrationId).eq('event_id', eventId).maybeSingle();
  if (error || !registration) return { error: 'Registration was not found for this event' } as const;
  const db = admin as unknown as SupabaseClient;
  const { data: merchandise, error: merchandiseError } = await db.from('registration_merchandise').select('id,item_name,variant,quantity').eq('registration_id', registrationId).eq('event_id', eventId).order('created_at');
  if (merchandiseError) return { error: 'Participant merchandise could not be loaded' } as const;
  const { data: activity } = await admin.from('registration_activity').select('metadata').eq('registration_id', registrationId).eq('action', 'created').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const metadata = activity?.metadata && typeof activity.metadata === 'object' && !Array.isArray(activity.metadata) ? activity.metadata as Record<string, unknown> : {};
  const kitSelections = Array.isArray(metadata.race_kit_selections) ? metadata.race_kit_selections.flatMap(selection => {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return [];
    const item = selection as Record<string, unknown>;
    if (typeof item.item_id !== 'string' || typeof item.variant !== 'string') return [];
    return [{ item_id: item.item_id, item_name: typeof item.item_name === 'string' ? item.item_name : null, variant: item.variant }];
  }) : [];
  const category = Array.isArray(registration.race_categories) ? registration.race_categories[0] : registration.race_categories;
  const bibRelation = registration.bibs;
  const bib = Array.isArray(bibRelation) ? bibRelation.find(item => item.status === 'active') : bibRelation?.status === 'active' ? bibRelation : null;
  const paymentRelation = registration.payments;
  const payment = Array.isArray(paymentRelation) ? paymentRelation[0] ?? null : paymentRelation;
  const { data: specific } = category ? await admin.from('race_kit_configs').select('id,name,description,status,category_id,race_kit_items(id,item_code,item_name,quantity,details,is_required,is_active,display_order)').eq('event_id', eventId).eq('category_id', category.id).eq('status', 'active').maybeSingle() : { data: null };
  const { data: fallback } = !specific ? await admin.from('race_kit_configs').select('id,name,description,status,category_id,race_kit_items(id,item_code,item_name,quantity,details,is_required,is_active,display_order)').eq('event_id', eventId).is('category_id', null).eq('status', 'active').maybeSingle() : { data: null };
  const kit = specific ?? fallback;
  const { data: claim } = await admin.from('race_kit_claims').select('id,claimed_at,claimed_by,claim_method,config_id').eq('registration_id', registrationId).maybeSingle();
  let staff = null;
  if (claim?.claimed_by) { const { data } = await admin.from('user_profiles').select('first_name,last_name').eq('id', claim.claimed_by).maybeSingle(); staff = data ? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || 'Event staff' : 'Event staff'; }
  return { registration, category, bib, payment, kit, kit_selections: kitSelections, merchandise: merchandise ?? [], claim: claim ? { ...claim, staff_name: staff } : null } as const;
}

export async function GET(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await authorize(params.eventId); if ('response' in auth) return auth.response;
  const url = new URL(request.url); const rawSearch = (url.searchParams.get('search') ?? '').trim().slice(0, 120); const search = normalizeSearch(rawSearch); const categoryId = url.searchParams.get('category_id') ?? ''; const claimStatus = url.searchParams.get('claim_status') ?? 'all';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1); const pageSize = [20, 30, 50].includes(Number(url.searchParams.get('page_size'))) ? Number(url.searchParams.get('page_size')) : 20;
  const [{ count: confirmed, error: confirmedError }, { data: claims, error: claimsError }, { data: categories, error: categoriesError }] = await Promise.all([
    auth.admin.from('registrations').select('id', { count: 'exact', head: true }).eq('event_id', params.eventId).eq('status', 'confirmed'),
    auth.admin.from('race_kit_claims').select('registration_id,claimed_at,claimed_by,claim_method').eq('event_id', params.eventId),
    auth.admin.from('race_categories').select('id,name,distance_km').eq('event_id', params.eventId).order('name'),
  ]);
  if (confirmedError || claimsError || categoriesError) return NextResponse.json({ error: 'Race-kit dashboard could not be loaded' }, { status: 500 });
  const claimed = claims?.length ?? 0; const stats = { confirmed: confirmed ?? 0, claimed, unclaimed: Math.max((confirmed ?? 0) - claimed, 0), progress: confirmed ? Math.round((claimed / confirmed) * 100) : 0 };
  let bibRegistrationIds: string[] = [];
  if (rawSearch && !search) return NextResponse.json({ error: 'Enter letters or numbers to search.' }, { status: 400 });
  if (search) { const { data: bibRows } = await auth.admin.from('bibs').select('registration_id').eq('event_id', params.eventId).eq('status', 'active').ilike('bib_code', `%${search}%`).limit(100); bibRegistrationIds = (bibRows ?? []).map(row => row.registration_id).filter((id): id is string => Boolean(id)); }
  let query = auth.admin.from('registrations').select('id,registration_number,event_id,category_id,user_id,status,first_name,middle_name,last_name,email,shirt_size,created_at,race_categories(id,name,distance_km),payments(status,paid_at),bibs!registrations_bib_id_fkey(id,bib_number,bib_code,status)', { count: 'exact' }).eq('event_id', params.eventId).order('created_at', { ascending: false });
  if (categoryId) query = query.eq('category_id', categoryId);
  if (claimStatus === 'claimed') { const ids = (claims ?? []).map(row => row.registration_id); query = ids.length ? query.in('id', ids) : query.eq('id', '00000000-0000-0000-0000-000000000000'); }
  if (claimStatus === 'unclaimed') { const ids = (claims ?? []).map(row => row.registration_id); if (ids.length) query = query.not('id', 'in', `(${ids.join(',')})`); }
  if (search) { const safe = search.replace(/[(),%_*]/g, ' ').replace(/\s+/g, ' ').trim(); const clauses = [`registration_number.ilike.%${safe}%`,`first_name.ilike.%${safe}%`,`middle_name.ilike.%${safe}%`,`last_name.ilike.%${safe}%`,`email.ilike.%${safe}%`]; if (bibRegistrationIds.length) clauses.push(`id.in.(${bibRegistrationIds.join(',')})`); query = query.or(clauses.join(',')); }
  const from = (page - 1) * pageSize; const { data: rows, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return NextResponse.json({ error: 'Participant records could not be loaded' }, { status: 500 });
  const claimMap = new Map((claims ?? []).map(row => [row.registration_id, row])); const staffIds = Array.from(new Set((claims ?? []).map(row => row.claimed_by).filter(Boolean)));
  const { data: profiles } = staffIds.length ? await auth.admin.from('user_profiles').select('id,first_name,last_name').in('id', staffIds) : { data: [] };
  const staffMap = new Map((profiles ?? []).map(row => [row.id, `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()]));
  const participants = (rows ?? []).map(row => { const category = Array.isArray(row.race_categories) ? row.race_categories[0] : row.race_categories; const payment = Array.isArray(row.payments) ? row.payments[0] : row.payments; const bibRelation = row.bibs; const bib = Array.isArray(bibRelation) ? bibRelation.find(item => item.status === 'active') : bibRelation?.status === 'active' ? bibRelation : null; const claim = claimMap.get(row.id); return { ...row, race_categories: category, payments: payment, bib, claim: claim ? { ...claim, staff_name: staffMap.get(claim.claimed_by) || 'Event staff' } : null }; });
  return NextResponse.json({ event: auth.event, stats, categories: categories ?? [], participants, pagination: { page, page_size: pageSize, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / pageSize) } });
}

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const auth = await authorize(params.eventId); if ('response' in auth) return auth.response;
  const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid race-kit request' }, { status: 400 });
  if (parsed.data.action === 'lookup') {
    let registrationId = parsed.data.registration_id; let qrValue: string | undefined;
    if (parsed.data.qr_value) { const payload = parseQr(parsed.data.qr_value); if (!payload) return NextResponse.json({ error: 'Invalid registration QR' }, { status: 400 }); registrationId = payload.registration_id; qrValue = parsed.data.qr_value; }
    if (!registrationId && parsed.data.registration_number) { const { data, error } = await auth.admin.from('registrations').select('id').eq('event_id', params.eventId).eq('registration_number', parsed.data.registration_number).maybeSingle(); if (error) return NextResponse.json({ error: 'Registration number could not be checked' }, { status: 500 }); registrationId = data?.id; if (!registrationId) return NextResponse.json({ error: 'No registration matches that number for this event' }, { status: 404 }); }
    if (!registrationId && parsed.data.participant_query) { const term = normalizeSearch(parsed.data.participant_query); if (!term) return NextResponse.json({ error: 'Enter letters or numbers to search.' }, { status: 400 }); const { data: bibRows } = await auth.admin.from('bibs').select('registration_id').eq('event_id', params.eventId).eq('status', 'active').ilike('bib_code', `%${term}%`).limit(100); const bibIds = (bibRows ?? []).map(row => row.registration_id).filter((id): id is string => Boolean(id)); let query = auth.admin.from('registrations').select('id,registration_number,first_name,middle_name,last_name,status,category_id,race_categories(name)').eq('event_id', params.eventId).or(`registration_number.ilike.%${term}%,first_name.ilike.%${term}%,middle_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`); if (bibIds.length) query = query.or(`registration_number.ilike.%${term}%,first_name.ilike.%${term}%,middle_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,id.in.(${bibIds.join(',')})`); const { data, error } = await query.order('registration_number').limit(20); if (error) return NextResponse.json({ error: 'Participant search failed' }, { status: 500 }); return NextResponse.json({ matches: data ?? [] }); }
    if (!registrationId) return NextResponse.json({ error: 'Registration could not be resolved' }, { status: 400 });
    const view = await loadClaimView(auth.admin, params.eventId, registrationId, qrValue); if ('error' in view) return NextResponse.json({ error: view.error }, { status: 404 });
    const eligibility = raceKitEligibility({ registrationStatus: view.registration.status, paymentStatus: view.payment?.status, hasActiveKit: Boolean(view.kit), alreadyClaimed: Boolean(view.claim) });
    return NextResponse.json({ ...view, event: auth.event, claim_allowed: eligibility.eligible, eligibility_message: eligibility.message });
  }
  const qrValue = parsed.data.qr_value; const view = await loadClaimView(auth.admin, params.eventId, parsed.data.registration_id, qrValue); if ('error' in view) return NextResponse.json({ error: view.error }, { status: 400 }); const { registration, category, bib, payment, kit, claim } = view;
  if (claim) return NextResponse.json({ error: 'Race kit has already been claimed', claim }, { status: 409 });
  if (registration.status !== 'confirmed') return NextResponse.json({ error: 'Only confirmed registrations may claim race kits' }, { status: 409 });
  if (payment?.status !== 'succeeded') return NextResponse.json({ error: 'A successful payment is required before claiming' }, { status: 409 });
  if (!category || !kit) return NextResponse.json({ error: 'An active race-kit configuration is required before claiming' }, { status: 409 });
  const safeReference = parsed.data.claim_method === 'qr_scan' ? `qr:${registration.registration_number}` : registration.registration_number;
  const { data: created, error } = await auth.admin.from('race_kit_claims').insert({ registration_id: registration.id, event_id: params.eventId, category_id: category.id, bib_id: bib?.id ?? null, config_id: kit.id, claimed_by: auth.context.user.id, claim_method: parsed.data.claim_method, scan_reference: safeReference, metadata: { source: 'race_kit_claiming' } }).select('id,claimed_at,claimed_by,claim_method,config_id').single();
  if (error || !created) { if (error?.code === '23505') { const { data: original } = await auth.admin.from('race_kit_claims').select('id,claimed_at,claimed_by,claim_method').eq('registration_id', registration.id).maybeSingle(); let staffName = 'Event staff'; if (original?.claimed_by) { const { data: staff } = await auth.admin.from('user_profiles').select('first_name,last_name').eq('id', original.claimed_by).maybeSingle(); if (staff) staffName = `${staff.first_name} ${staff.last_name}`.trim(); } return NextResponse.json({ error: 'Race kit has already been claimed', claim: original ? { ...original, staff_name: staffName } : null }, { status: 409 }); } return NextResponse.json({ error: 'Race kit could not be claimed' }, { status: 500 }); }
  const { data: releasingStaff } = await auth.admin.from('user_profiles').select('first_name,last_name').eq('id', auth.context.user.id).maybeSingle();
  const claimWithStaff = { ...created, staff_name: releasingStaff ? `${releasingStaff.first_name} ${releasingStaff.last_name}`.trim() : 'Event staff' };
  await Promise.all([auth.admin.from('registration_activity').insert({ registration_id: registration.id, action: 'kit_claimed', actor: auth.context.user.id, metadata: { claim_id: created.id, bib_id: bib?.id ?? null, config_id: kit.id } }), auth.admin.from('audit_logs').insert({ actor_user_id: auth.context.user.id, organization_id: auth.event.organization_id, event_id: params.eventId, action: 'race_kit_claimed', resource_type: 'race_kit_claim', resource_id: created.id, new_values: { registration_id: registration.id, bib_id: bib?.id ?? null, config_id: kit.id, claim_method: parsed.data.claim_method } })]);
  return NextResponse.json({ claim: claimWithStaff, registration, category, bib, payment, kit, event: auth.event, claim_allowed: false }, { status: 201 });
}
