import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireInternalAccess } from '@/lib/auth/rbac';
import { requestPayMongoRefund } from '@/lib/payments/refund.service';
import { createAdminClient } from '@/lib/supabase/admin';

const statuses = ['pending', 'processing', 'succeeded', 'failed', 'cancelled'] as const;

export async function GET(request: Request) {
  await requireInternalAccess();
  const status = new URL(request.url).searchParams.get('status');
  const admin = createAdminClient();
  let query = admin
    .from('refunds')
    .select('id,organization_id,event_id,registration_id,payment_id,gateway,gateway_refund_id,amount,currency,reason,status,failure_code,failure_message,processed_at,created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (status && (statuses as readonly string[]).includes(status)) query = query.eq('status', status as (typeof statuses)[number]);

  const { data: refunds, error } = await query;
  if (error) return NextResponse.json({ error: 'Refund records could not be loaded' }, { status: 500 });
  const rows = refunds ?? [];
  const organizationIds = Array.from(new Set(rows.map((row) => row.organization_id)));
  const eventIds = Array.from(new Set(rows.map((row) => row.event_id)));
  const [{ data: organizations }, { data: events }] = await Promise.all([
    organizationIds.length ? admin.from('organizations').select('id,name').in('id', organizationIds) : Promise.resolve({ data: [] }),
    eventIds.length ? admin.from('events').select('id,name').in('id', eventIds) : Promise.resolve({ data: [] }),
  ]);
  const organizationNames = new Map((organizations ?? []).map((organization) => [organization.id, organization.name]));
  const eventNames = new Map((events ?? []).map((event) => [event.id, event.name]));
  const summary = {
    total: rows.length,
    pending: rows.filter((row) => row.status === 'pending' || row.status === 'processing').length,
    succeeded: rows.filter((row) => row.status === 'succeeded').reduce((sum, row) => sum + Number(row.amount), 0),
    failed: rows.filter((row) => row.status === 'failed').length,
  };
  return NextResponse.json({ refunds: rows.map((row) => ({ ...row, organization_name: organizationNames.get(row.organization_id) ?? row.organization_id, event_name: eventNames.get(row.event_id) ?? row.event_id })), summary });
}

const refundInput = z.object({
  payment_id: z.string().uuid(),
  amount: z.number().positive().finite(),
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
    await admin.from('audit_logs').insert({ actor_user_id: context.user.id, organization_id: refund.organization_id, event_id: refund.event_id, action: refund.status === 'succeeded' ? 'refund_processed' : 'refund_requested', resource_type: 'refund', resource_id: refund.id, new_values: { payment_id: refund.payment_id, amount: refund.amount, currency: refund.currency, reason: refund.reason, gateway_refund_id: refund.gateway_refund_id, status: refund.status }, metadata: { idempotency_key: idempotencyKey } });
    return NextResponse.json({ refund }, { status: refund.status === 'succeeded' ? 201 : 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refund request could not be processed';
    const conflict = /remaining refundable|exceeds|Only successful|idempotency key conflicts/i.test(message);
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 502 });
  }
}
