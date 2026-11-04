import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireInternalAccess } from '@/lib/auth/rbac';
import { requestPayMongoRefund } from '@/lib/payments/refund.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminDateRange, adminPageNumber, adminSearch } from '@/lib/admin/list-query';

const statuses = ['pending', 'processing', 'succeeded', 'failed', 'cancelled'] as const;
const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  await requireInternalAccess();
  const params = new URL(request.url).searchParams;
  const status = params.get('status') ?? '';
  if (status && !(statuses as readonly string[]).includes(status)) return NextResponse.json({ error: 'Choose a valid refund status.' }, { status: 400 });
  const search = adminSearch(params.get('q') ?? '');
  const range = adminDateRange(params.get('from') ?? '', params.get('to') ?? '');
  if (range.error) return NextResponse.json({ error: range.error }, { status: 400 });
  const page = adminPageNumber(params.get('page') ?? '');
  const admin = createAdminClient();
  let query = admin.from('refunds').select('id,organization_id,event_id,registration_id,payment_id,gateway,gateway_refund_id,amount,currency,reason,status,failure_code,failure_message,processed_at,created_at,organizations(name),events(name)', { count: 'exact' });
  if (status) query = query.eq('status', status as (typeof statuses)[number]);
  if (search) query = UUID.test(search) ? query.or(`id.eq.${search},payment_id.eq.${search},registration_id.eq.${search},gateway_refund_id.ilike.%${search}%`) : query.ilike('gateway_refund_id', `%${search}%`);
  if (range.from) query = query.gte('created_at', range.from);
  if (range.toExclusive) query = query.lt('created_at', range.toExclusive);
  const [listing, pending, succeeded, failed] = await Promise.all([
    query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    admin.from('refunds').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
    admin.from('refunds').select('id', { count: 'exact', head: true }).eq('status', 'succeeded'),
    admin.from('refunds').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);
  if (listing.error || pending.error || succeeded.error || failed.error) return NextResponse.json({ error: 'Refund records could not be loaded' }, { status: 500 });
  const total = listing.count ?? 0;
  return NextResponse.json({
    refunds: (listing.data ?? []).map((row) => ({ ...row, organization_name: row.organizations?.name ?? row.organization_id, event_name: row.events?.name ?? row.event_id })),
    summary: { total, pending: pending.count ?? 0, succeeded: succeeded.count ?? 0, failed: failed.count ?? 0 },
    pagination: { page, page_size: PAGE_SIZE, total, page_count: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
  });
}

const refundInput = z.object({
  payment_id: z.string().uuid(),
  amount: z.number().positive().finite().refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Use no more than two decimal places.'),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer', 'others']),
  notes: z.string().trim().max(255).optional().default(''),
});

export async function POST(request: Request) {
  const context = await requireInternalAccess();
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255) return NextResponse.json({ error: 'A valid Idempotency-Key header is required' }, { status: 400 });
  const parsed = refundInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid refund request' }, { status: 400 });
  try {
    const refund = await requestPayMongoRefund({ paymentId: parsed.data.payment_id, amount: parsed.data.amount, reason: parsed.data.reason, notes: parsed.data.notes, idempotencyKey, requestedBy: context.user.id });
    const admin = createAdminClient();
    const { error: auditError } = await admin.from('audit_logs').insert({ actor_user_id: context.user.id, organization_id: refund.organization_id, event_id: refund.event_id, action: refund.status === 'succeeded' ? 'refund_processed' : 'refund_requested', resource_type: 'refund', resource_id: refund.id, new_values: { payment_id: refund.payment_id, amount: refund.amount, currency: refund.currency, reason: refund.reason, gateway_refund_id: refund.gateway_refund_id, status: refund.status }, metadata: { idempotency_key: idempotencyKey } });
    if (auditError) console.error('[Admin refunds] Audit log failed for refund', refund.id, auditError);
    if (refund.status === 'failed' || refund.status === 'cancelled') return NextResponse.json({ error: `This refund request is ${refund.status}. Review its record before creating another request.`, refund }, { status: 409 });
    return NextResponse.json({ refund }, { status: refund.status === 'succeeded' ? 201 : 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/Payment was not found/i.test(message)) return NextResponse.json({ error: 'Payment was not found.' }, { status: 404 });
    if (/remaining refundable|exceeds|Only successful|idempotency key conflicts|Verified gateway payment reference|gateway does not support refunds/i.test(message)) return NextResponse.json({ error: message }, { status: 409 });
    console.error('[Admin refunds] Refund request failed', error);
    return NextResponse.json({ error: 'Refund could not be completed. Check refund records before retrying with the same request.' }, { status: 502 });
  }
}
