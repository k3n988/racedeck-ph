import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLocalFixture, seedLocalFixture } from './helpers/supabase';

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
};

describe('RaceDeck refund processing contracts', () => {
  let fixture: Awaited<ReturnType<typeof seedLocalFixture>>;
  let paymentId: string;
  let originalTransactionId: string;
  let idempotentRefundId: string;
  const refundIds: string[] = [];

  beforeAll(async () => {
    fixture = await seedLocalFixture();

    const { data: payment, error: paymentError } = await fixture.admin
      .from('payments')
      .insert({
        registration_id: fixture.registration.id,
        event_id: fixture.event.id,
        organization_id: fixture.organization.id,
        gateway: 'paymongo',
        gateway_payment_id: `pay-refund-${crypto.randomUUID()}`,
        amount_due: 1000,
        amount_paid: 1000,
        currency: 'PHP',
        status: 'succeeded',
        paid_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    expect(paymentError).toBeNull();
    expect(payment).toBeTruthy();
    paymentId = payment!.id;

    const { data: transaction, error: transactionError } = await fixture.admin
      .from('payment_transactions')
      .insert({
        payment_id: paymentId,
        registration_id: fixture.registration.id,
        event_id: fixture.event.id,
        organization_id: fixture.organization.id,
        attempt_number: 1,
        gateway: 'paymongo',
        gateway_transaction_id: `txn-refund-${crypto.randomUUID()}`,
        idempotency_key: `refund-test-payment-${crypto.randomUUID()}`,
        transaction_type: 'payment',
        status: 'succeeded',
        amount: 1000,
        currency: 'PHP',
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    expect(transactionError).toBeNull();
    expect(transaction).toBeTruthy();
    originalTransactionId = transaction!.id;
  });

  afterAll(async () => {
    if (!fixture) return;
    if (refundIds.length) await fixture.admin.from('refunds').delete().in('id', refundIds);
    if (paymentId) await fixture.admin.from('payment_transactions').delete().eq('payment_id', paymentId);
    if (paymentId) await fixture.admin.from('payments').delete().eq('id', paymentId);
    await cleanupLocalFixture(fixture);
  });

  it('reuses the same refund for a repeated idempotency key', async () => {
    const client = fixture.admin as unknown as RpcClient;
    const key = `refund-idempotent-${crypto.randomUUID()}`;
    const first = await client.rpc('create_refund_request', {
      p_payment_id: paymentId,
      p_amount: 400,
      p_reason: 'requested_by_customer',
      p_idempotency_key: key,
      p_requested_by: fixture.organizer.id,
    });
    expect(first.error).toBeNull();
    expect(first.data?.id).toBeTruthy();
    idempotentRefundId = first.data.id;
    refundIds.push(first.data.id);

    const repeated = await client.rpc('create_refund_request', {
      p_payment_id: paymentId,
      p_amount: 400,
      p_reason: 'requested_by_customer',
      p_idempotency_key: key,
      p_requested_by: fixture.organizer.id,
    });
    expect(repeated.error).toBeNull();
    expect(repeated.data.id).toBe(first.data.id);
  });

  it('allows only one of concurrent requests that would exceed the refundable balance', async () => {
    const client = fixture.admin as unknown as RpcClient;
    const [first, second] = await Promise.all([
      client.rpc('create_refund_request', {
        p_payment_id: paymentId,
        p_amount: 600,
        p_reason: 'duplicate',
        p_idempotency_key: `refund-concurrent-a-${crypto.randomUUID()}`,
        p_requested_by: fixture.organizer.id,
      }),
      client.rpc('create_refund_request', {
        p_payment_id: paymentId,
        p_amount: 600,
        p_reason: 'duplicate',
        p_idempotency_key: `refund-concurrent-b-${crypto.randomUUID()}`,
        p_requested_by: fixture.organizer.id,
      }),
    ]);
    const successful = [first, second].filter(result => !result.error && result.data?.id);
    const rejected = [first, second].filter(result => result.error);
    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    refundIds.push(successful[0].data.id);
  });

  it('settles a refund once and does not double-count duplicate gateway results', async () => {
    const client = fixture.admin as unknown as RpcClient;
    const gatewayRefundId = `re_${crypto.randomUUID()}`;
    const settled = await client.rpc('apply_refund_gateway_result', {
      p_refund_id: idempotentRefundId,
      p_gateway_refund_id: gatewayRefundId,
      p_status: 'succeeded',
      p_failure_code: null,
      p_failure_message: null,
    });
    expect(settled.error).toBeNull();
    expect(settled.data.status).toBe('succeeded');

    const duplicate = await client.rpc('apply_refund_gateway_result', {
      p_refund_id: idempotentRefundId,
      p_gateway_refund_id: gatewayRefundId,
      p_status: 'succeeded',
      p_failure_code: null,
      p_failure_message: null,
    });
    expect(duplicate.error).toBeNull();
    expect(duplicate.data.id).toBe(idempotentRefundId);

    const { data: payment, error } = await fixture.admin
      .from('payments')
      .select('amount_refunded,status')
      .eq('id', paymentId)
      .single();
    expect(error).toBeNull();
    expect(payment).toMatchObject({ amount_refunded: 400, status: 'partially_refunded' });

    const { data: refundTransactions, error: transactionError } = await fixture.admin
      .from('payment_transactions')
      .select('id')
      .eq('payment_id', paymentId)
      .eq('transaction_type', 'refund');
    expect(transactionError).toBeNull();
    expect(refundTransactions).toHaveLength(1);
    expect(originalTransactionId).toBeTruthy();
  });
});
