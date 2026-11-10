import { NextResponse } from 'next/server';
import { hasPermission, loadAuthContext } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const REGISTRATION_STATUSES = new Set(['pending_payment', 'confirmed', 'cancelled', 'transferred', 'refunded', 'expired']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CSV_BATCH_SIZE = 1000;
const CSV_MAX_ROWS = 100_000;

type ExportRelation<T> = T | T[] | null;
type ExportRow = {
  id: string;
  registration_number: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  status: string;
  created_at: string;
  race_categories: ExportRelation<{ name: string }>;
  payments: ExportRelation<{ status: string }>;
  bibs: ExportRelation<{ bib_number: number | null; bib_code: string | null; prefix: string | null; status?: string }>;
  race_kit_claims: Array<{ claimed_at: string | null }> | null;
};

type RegistrationPaymentRow = {
  id: string;
  checkout_group_id?: string | null;
  payments?: ExportRelation<{ status: string; amount_paid?: number | null; created_at?: string }>;
};

async function attachCheckoutGroupPayments(eventId: string, rows: RegistrationPaymentRow[]) {
  const admin = createAdminClient();
  const groupIds = Array.from(new Set(rows.map((row) => row.checkout_group_id).filter((id): id is string => Boolean(id))));
  const { data: groupRows, error: groupError } = groupIds.length
    ? await admin.from('registrations').select('id,checkout_group_id').eq('event_id', eventId).in('checkout_group_id', groupIds)
    : { data: [], error: null };
  if (groupError) return { rows: null, error: groupError };

  const registrationIds = Array.from(new Set([...rows.map((row) => row.id), ...(groupRows ?? []).map((row) => row.id)]));
  const { data: paymentRows, error: paymentError } = registrationIds.length
    ? await admin.from('payments').select('registration_id,status,amount_paid,created_at').in('registration_id', registrationIds).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (paymentError) return { rows: null, error: paymentError };

  const groupByRegistration = new Map((groupRows ?? []).map((row) => [row.id, row.checkout_group_id]));
  const latestByRegistration = new Map<string, { status: string; amount_paid: number | null; created_at: string }>();
  const latestByGroup = new Map<string, { status: string; amount_paid: number | null; created_at: string }>();
  for (const payment of paymentRows ?? []) {
    const normalized = { status: payment.status, amount_paid: payment.amount_paid, created_at: payment.created_at };
    if (!latestByRegistration.has(payment.registration_id)) latestByRegistration.set(payment.registration_id, normalized);
    const groupId = groupByRegistration.get(payment.registration_id);
    if (groupId && !latestByGroup.has(groupId)) latestByGroup.set(groupId, normalized);
  }

  return {
    rows: rows.map((row) => {
      const groupId = row.checkout_group_id;
      const payment = latestByRegistration.get(row.id) ?? (groupId ? latestByGroup.get(groupId) : undefined);
      return { ...row, payments: payment ? [payment] : [] };
    }),
    error: null,
  };
}

async function authorize(eventId: string) {
  const context = await loadAuthContext();
  if (!context) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;

  const supabase = await createClient();
  const { data: event, error } = await supabase.from('events').select('id,organization_id').eq('id', eventId).maybeSingle();
  if (error) {
    console.error('Unable to verify event registration access', error);
    return { response: NextResponse.json({ error: 'Event access could not be verified' }, { status: 500 }) } as const;
  }
  if (!event) return { response: NextResponse.json({ error: 'Event not found' }, { status: 404 }) } as const;

  if (!(await hasPermission(event.organization_id, 'manage_registrations', eventId))) {
    return { response: NextResponse.json({ error: 'Registration management permission required' }, { status: 403 }) } as const;
  }
  const canViewPii = await hasPermission(event.organization_id, 'view_participants', eventId);

  return { event, canViewPii } as const;
}

function escapeCsvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  // Prevent spreadsheet formula execution when organizers open exported values.
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function relationOne<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export async function GET(request: Request, { params }: { params: { eventId: string } }) {
  const access = await authorize(params.eventId);
  if ('response' in access) return access.response;

  const url = new URL(request.url);
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, 120).replace(/[(),]/g, ' ').replace(/\s+/g, ' ');
  const status = url.searchParams.get('status') ?? '';
  const categoryId = url.searchParams.get('categoryId') ?? '';
  const isCsv = url.searchParams.get('export') === 'csv';
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? 1) || 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get('pageSize') ?? 25) || 25)));

  if (status && !REGISTRATION_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Choose a valid registration status.' }, { status: 400 });
  }
  if (categoryId && !UUID_PATTERN.test(categoryId)) {
    return NextResponse.json({ error: 'Choose a valid race category.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const categoriesQuery = admin.from('race_categories').select('id,name').eq('event_id', params.eventId).order('name');
  const { data: categories, error: categoriesError } = await categoriesQuery;
  if (categoriesError) {
    console.error('Unable to load registration categories', categoriesError);
    return NextResponse.json({ error: 'Race categories could not be loaded.' }, { status: 500 });
  }
  if (categoryId && !(categories ?? []).some((category) => category.id === categoryId)) {
    return NextResponse.json({ error: 'The selected category does not belong to this event.' }, { status: 400 });
  }

  // registrations.bib_id and bibs.registration_id both point at this relationship.
  // Name the FK explicitly so PostgREST does not fail with an ambiguous relationship error.
  const fields = `id,registration_number,event_id,category_id,checkout_group_id,status,${access.canViewPii ? 'first_name,middle_name,last_name,email,mobile,' : ''}created_at,race_categories!inner(id,name),payments(status,amount_paid,created_at),bibs!registrations_bib_id_fkey(bib_number,bib_code,prefix,status),race_kit_claims(claimed_at)`;
  const makeQuery = () => {
    let query = admin.from('registrations').select(fields, { count: 'exact' }).eq('event_id', params.eventId);
    if (status) query = query.eq('status', status as never);
    if (categoryId) query = query.eq('category_id', categoryId);
    if (search) {
      query = access.canViewPii
        ? query.or(`registration_number.ilike.%${search}%,first_name.ilike.%${search}%,middle_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
        : query.ilike('registration_number', `%${search}%`);
    }
    return query.order('created_at', { ascending: false });
  };

  if (isCsv) {
    const rows: Array<Record<string, unknown>> = [];
    for (let offset = 0; offset < CSV_MAX_ROWS; offset += CSV_BATCH_SIZE) {
      const { data, error } = await makeQuery().range(offset, offset + CSV_BATCH_SIZE - 1);
      if (error) {
        console.error('Unable to export event registrations', error);
        return NextResponse.json({ error: 'Registration CSV could not be prepared.' }, { status: 500 });
      }
      rows.push(...((data ?? []) as unknown as ExportRow[]));
      if (!data || data.length < CSV_BATCH_SIZE) break;
    }

    const paymentResult = await attachCheckoutGroupPayments(params.eventId, rows as unknown as RegistrationPaymentRow[]);
    if (paymentResult.error) {
      console.error('Unable to load grouped registration payments for export', paymentResult.error);
      return NextResponse.json({ error: 'Registration payment statuses could not be loaded.' }, { status: 500 });
    }
    const header = ['Registration number', ...(access.canViewPii ? ['Participant name', 'Email'] : []), 'Category', 'Registration status', 'Payment status', 'Bib', 'Race kit status', 'Registered at'];
    const lines = [header, ...((paymentResult.rows ?? []) as unknown as ExportRow[]).map((raw) => {
      const row = raw as ExportRow;
      const category = relationOne(row.race_categories);
      const payment = relationOne(row.payments);
      const bib = relationOne(row.bibs);
      const claimed = row.race_kit_claims?.some((claim) => claim.claimed_at) ?? false;
      return [
        row.registration_number ?? row.id,
        ...(access.canViewPii ? [[row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' '), row.email ?? ''] : []),
        category?.name ?? '',
        row.status,
        payment?.status ?? 'no_payment',
        bib?.status === 'active' ? (bib.bib_code ?? (bib.bib_number == null ? '' : `${bib.prefix ?? ''}${bib.bib_number}`)) : '',
        claimed ? 'claimed' : 'not_claimed',
        row.created_at,
      ];
    })].map((line) => line.map(escapeCsvCell).join(','));

    const response = new NextResponse(`\uFEFF${lines.join('\r\n')}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="event-registrations-${params.eventId}.csv"`,
        'Cache-Control': 'private, no-store',
        ...(rows.length >= CSV_MAX_ROWS ? { 'X-Export-Truncated': 'true' } : {}),
      },
    });
    return response;
  }

  const { data, error, count } = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    console.error('Unable to load registrations', error);
    return NextResponse.json({ error: 'Registrations could not be loaded.' }, { status: 500 });
  }

  const paymentResult = await attachCheckoutGroupPayments(params.eventId, (data ?? []) as unknown as RegistrationPaymentRow[]);
  if (paymentResult.error) {
    console.error('Unable to load grouped registration payments', paymentResult.error);
    return NextResponse.json({ error: 'Registration payment statuses could not be loaded.' }, { status: 500 });
  }

  return NextResponse.json({ registrations: paymentResult.rows ?? [], categories: categories ?? [], page, pageSize, total: count ?? 0, canViewPii: access.canViewPii }, { headers: { 'Cache-Control': 'private, no-store' } });
}
