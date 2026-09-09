import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedWebhook } from '@/lib/payments/gateway.interface';

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), createPostPaymentArtifacts: vi.fn(), verifyWebhook: vi.fn(), parseRefundWebhook: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/payments/payment.service', () => ({ createPostPaymentArtifacts: mocks.createPostPaymentArtifacts }));
vi.mock('@/lib/payments/paymongo.provider', () => ({ PayMongoProvider: class { verifyWebhook = mocks.verifyWebhook; }, parsePayMongoRefundWebhookPayload: mocks.parseRefundWebhook }));

import { POST } from '@/app/api/webhooks/paymongo/route';

type Operation = { table: string; kind: 'insert' | 'upsert' | 'update' | 'rpc'; value?: unknown };

function webhook(overrides: Partial<VerifiedWebhook> = {}): VerifiedWebhook {
  return { eventId: 'evt-test', eventType: 'checkout_session.payment.paid', paymentId: 'cs-test', status: 'succeeded', amount: 500, gatewayTransactionId: 'pay-test', raw: { data: {} }, ...overrides };
}

function fakeAdmin(options: { existing?: { id: string; status: string } | null; payment?: Record<string, unknown> | null; registration?: Record<string, unknown> | null; confirmed?: boolean }) {
  const operations: Operation[] = [];
  const admin = {
    from(table: string) {
      let mode = '';
      const chain = {
        select() { mode = 'select'; return chain; },
        eq() { return chain; },
        insert(value: unknown) { operations.push({ table, kind: 'insert', value }); return Promise.resolve({ error: null }); },
        upsert(value: unknown) { mode = 'upsert'; operations.push({ table, kind: 'upsert', value }); return chain; },
        update(value: unknown) { mode = 'update'; operations.push({ table, kind: 'update', value }); return chain; },
        maybeSingle: async () => {
          if (table === 'payment_webhook_events') return { data: options.existing ?? null, error: null };
          if (table === 'payments') return { data: options.payment ?? null, error: null };
          if (table === 'registrations') return { data: options.registration ?? null, error: null };
          return { data: null, error: null };
        },
        single: async () => ({ data: mode === 'upsert' ? { id: 'txn-test' } : null, error: null }),
        then<TResult1 = { data: null; error: null }, TResult2 = never>(onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
          return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
        },
      };
      return chain;
    },
    rpc(name: string, value: unknown) { operations.push({ table: name, kind: 'rpc', value }); return Promise.resolve({ data: name === 'confirm_registration' ? options.confirmed ?? true : null, error: null }); },
  };
  return { admin, operations };
}

function request() { return new Request('http://localhost/api/webhooks/paymongo', { method: 'POST', headers: { 'Paymongo-Signature': 'signed' }, body: JSON.stringify({ data: {} }) }); }

const payment = { id: 'payment-test', registration_id: 'registration-test', event_id: 'event-test', organization_id: 'organization-test', gateway: 'paymongo', gateway_payment_id: 'cs-test', amount_due: 500, amount_paid: 0, currency: 'PHP', status: 'pending', paid_at: null };
const registration = { id: 'registration-test', event_id: 'event-test' };

describe('PayMongo webhook route', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.createPostPaymentArtifacts.mockResolvedValue(undefined); mocks.parseRefundWebhook.mockReturnValue(null); });

  it('confirms and creates post-payment artifacts exactly once for a verified success', async () => {
    const fake = fakeAdmin({ payment, registration }); mocks.createAdminClient.mockReturnValue(fake.admin); mocks.verifyWebhook.mockReturnValue(webhook());
    const response = await POST(request());
    expect(response.status).toBe(200); expect(mocks.createPostPaymentArtifacts).toHaveBeenCalledTimes(1); expect(mocks.createPostPaymentArtifacts).toHaveBeenCalledWith('payment-test');
    expect(fake.operations.filter(operation => operation.kind === 'rpc' && operation.table === 'confirm_registration')).toHaveLength(1);
    expect(fake.operations.some(operation => operation.table === 'payments' && operation.kind === 'update' && (operation.value as { status: string }).status === 'succeeded')).toBe(true);
  });

  it('returns safely for a processed duplicate without reconfirming or regenerating artifacts', async () => {
    const fake = fakeAdmin({ existing: { id: 'webhook-test', status: 'processed' } }); mocks.createAdminClient.mockReturnValue(fake.admin); mocks.verifyWebhook.mockReturnValue(webhook());
    const response = await POST(request());
    expect(response.status).toBe(200); expect(fake.operations).toEqual([]); expect(mocks.createPostPaymentArtifacts).not.toHaveBeenCalled();
  });

  it('records a failed gateway result without confirming a registration or creating artifacts', async () => {
    const fake = fakeAdmin({ payment, registration }); mocks.createAdminClient.mockReturnValue(fake.admin); mocks.verifyWebhook.mockReturnValue(webhook({ eventId: 'evt-failed', eventType: 'payment.failed', status: 'failed', amount: undefined }));
    const response = await POST(request());
    expect(response.status).toBe(200); expect(mocks.createPostPaymentArtifacts).not.toHaveBeenCalled();
    expect(fake.operations.some(operation => operation.kind === 'rpc' && operation.table === 'confirm_registration')).toBe(false);
    expect(fake.operations.some(operation => operation.kind === 'rpc' && operation.table === 'reverse_promo_redemption')).toBe(true);
  });

  it('rejects a verified success whose gateway amount differs from the pending payment', async () => {
    const fake = fakeAdmin({ payment, registration }); mocks.createAdminClient.mockReturnValue(fake.admin); mocks.verifyWebhook.mockReturnValue(webhook({ amount: 499 }));
    const response = await POST(request());
    expect(response.status).toBe(400); expect(mocks.createPostPaymentArtifacts).not.toHaveBeenCalled();
    expect(fake.operations.some(operation => operation.table === 'payments' && operation.kind === 'update')).toBe(false);
  });

  it('does not downgrade an already successful payment when a later failure arrives', async () => {
    const fake = fakeAdmin({ payment: { ...payment, status: 'succeeded', amount_paid: 500 }, registration }); mocks.createAdminClient.mockReturnValue(fake.admin); mocks.verifyWebhook.mockReturnValue(webhook({ eventId: 'evt-late-failure', eventType: 'payment.failed', status: 'failed', amount: undefined }));
    const response = await POST(request());
    expect(response.status).toBe(200); expect(mocks.createPostPaymentArtifacts).not.toHaveBeenCalled();
    expect(fake.operations.some(operation => operation.kind === 'rpc')).toBe(false);
    expect(fake.operations.some(operation => operation.table === 'payments' && operation.kind === 'update')).toBe(false);
  });

  it('marks a transient artifact failure retryable without confirming twice', async () => {
    const fake = fakeAdmin({ payment, registration }); mocks.createAdminClient.mockReturnValue(fake.admin); mocks.verifyWebhook.mockReturnValue(webhook({ eventId: 'evt-retryable' })); mocks.createPostPaymentArtifacts.mockRejectedValueOnce(new Error('Temporary document service failure'));
    const response = await POST(request());
    expect(response.status).toBe(500); expect(fake.operations.some(operation => operation.table === 'payment_webhook_events' && operation.kind === 'update' && (operation.value as { status?: string }).status === 'failed')).toBe(true);
    expect(fake.operations.filter(operation => operation.kind === 'rpc' && operation.table === 'confirm_registration')).toHaveLength(1);
  });
});
