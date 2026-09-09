import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedWebhook } from '@/lib/payments/gateway.interface';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), createCheckout: vi.fn(), verifyWebhook: vi.fn(), parseRefundWebhook: vi.fn(), createPostPaymentArtifacts: vi.fn(), reserveRegistrationSlot: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/payments/payment.service', () => ({ createPostPaymentArtifacts: mocks.createPostPaymentArtifacts }));
vi.mock('@/lib/registrations/slot.service', () => ({ reserveRegistrationSlot: mocks.reserveRegistrationSlot }));
vi.mock('@/lib/payments/paymongo.provider', () => ({ PayMongoProvider: class { createCheckout = mocks.createCheckout; verifyWebhook = mocks.verifyWebhook; }, parsePayMongoRefundWebhookPayload: mocks.parseRefundWebhook }));

import { POST as register } from '@/app/api/events/[eventId]/register/route';
import { POST as webhook } from '@/app/api/webhooks/paymongo/route';

const user = { id: 'participant-test', email: 'participant@example.test' };
const event = { id: 'event-test', organization_id: 'organization-test', name: 'RaceDeck Test Run', event_date: '2099-01-01', registration_opens_at: null, registration_closes_at: null, registration_availability: 'open', lifecycle_status: 'published', review_status: 'approved' };
const category = { id: '00000000-0000-4000-8000-000000000005', name: '5K', registration_fee: 500, registration_availability: 'open' };

function adminState() {
  const state: { registration: Record<string, unknown> | null; payment: Record<string, unknown> | null; holds: Array<Record<string, unknown>>; webhookEvents: Array<Record<string, unknown>>; confirmedCalls: number } = { registration: null, payment: null, holds: [], webhookEvents: [], confirmedCalls: 0 };
  const operations: Array<{ table: string; kind: string; value?: unknown }> = [];
  const admin = {
    from(table: string) {
      let mode = '';
      let inserted = false;
      let value: unknown;
      const applyUpdate = () => {
        if (mode !== 'update') return;
        const update = value as Record<string, unknown>;
        if (table === 'registration_holds' && state.holds.at(-1)) Object.assign(state.holds.at(-1)!, update);
        if (table === 'payments' && state.payment) Object.assign(state.payment, update);
        if (table === 'registrations' && state.registration) Object.assign(state.registration, update);
        if (table === 'payment_webhook_events' && state.webhookEvents.at(-1)) Object.assign(state.webhookEvents.at(-1)!, update);
      };
      const chain = {
        select() { mode = 'select'; return chain; },
        eq() { applyUpdate(); return chain; },
        insert(input: Record<string, unknown> | Record<string, unknown>[]) { inserted = true; value = input; operations.push({ table, kind: 'insert', value: input }); if (table === 'payment_webhook_events') { const row = { ...(input as Record<string, unknown>), id: 'webhook-test' }; state.webhookEvents.push(row); } return chain; },
        upsert(input: Record<string, unknown>) { value = input; operations.push({ table, kind: 'upsert', value: input }); return chain; },
        update(input: Record<string, unknown>) { value = input; operations.push({ table, kind: 'update', value: input }); return chain; },
        maybeSingle: async () => {
          if (table === 'events') return { data: event, error: null };
          if (table === 'event_waivers') return { data: null, error: null };
          if (table === 'race_categories') return { data: category, error: null };
          if (table === 'promo_codes') return { data: null, error: null };
          if (table === 'user_profiles') return { data: { first_name: 'Test', last_name: 'Participant', birthdate: null, mobile: null, address: null, emergency_contact_name: null, emergency_contact_number: null, default_shirt_size: null }, error: null };
          if (table === 'payment_webhook_events') { const existing = state.webhookEvents.find(row => row.gateway_event_id === 'event-paid'); return { data: existing ? { ...existing, status: 'processed' } : null, error: null }; }
          if (table === 'payments') return { data: state.payment, error: null };
          if (table === 'registrations') return { data: state.registration, error: null };
          return { data: null, error: null };
        },
        single: async () => {
          if (table === 'registrations') { state.registration = { ...(value as Record<string, unknown>), id: 'registration-test', registration_number: 'REG-2099-000001' }; return { data: { id: state.registration.id, registration_number: state.registration.registration_number }, error: null }; }
          if (table === 'payments' && inserted) { state.payment = { ...(value as Record<string, unknown>), id: 'payment-test' }; return { data: { id: state.payment.id }, error: null }; }
          if (table === 'payment_transactions') return { data: { id: 'transaction-test' }, error: null };
          return { data: null, error: null };
        },
        then<TResult1 = { data: unknown; error: null }, TResult2 = never>(onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
          applyUpdate();
          if (table === 'registration_activity' && mode === 'insert') return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
          return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
        },
      };
      if (table === 'event_registration_fields') { mode = 'select'; }
      if (table === 'registration_holds' && mode === '') { /* reserveRegistrationSlot is mocked below */ }
      return chain;
    },
    rpc(name: string) { operations.push({ table: name, kind: 'rpc' }); if (name === 'confirm_registration' && state.registration) { state.confirmedCalls += 1; state.registration.status = 'confirmed'; } return Promise.resolve({ data: name === 'confirm_registration' ? true : null, error: null }); },
    auth: { admin: { deleteUser: vi.fn() } },
  };
  return { admin, state, operations };
}

function registerRequest() { return new Request('http://localhost/api/events/event-test/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category_id: category.id, answers: {}, accept_waiver: false, idempotency_key: 'local-idempotency-key-1234' }) }); }
function webhookRequest() { return new Request('http://localhost/api/webhooks/paymongo', { method: 'POST', headers: { 'Paymongo-Signature': 'verified' }, body: JSON.stringify({ data: { id: 'event-paid' } }) }); }

describe('RaceDeck participant registration payment vertical slice', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a pending registration/hold, verifies payment server-side, and processes a duplicate webhook once', async () => {
    const fake = adminState();
    mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) } }); mocks.createAdminClient.mockReturnValue(fake.admin);
    mocks.reserveRegistrationSlot.mockImplementation(async (_admin: unknown, _eventId: string, _categoryId: string, _userId: string, expiresAt: string) => { const hold = { id: 'hold-test', status: 'active', expires_at: expiresAt }; fake.state.holds.push(hold); return { data: hold.id, error: null }; });
    mocks.createCheckout.mockResolvedValue({ gatewayPaymentId: 'cs-test', checkoutUrl: 'https://checkout.test/cs-test' });
    const registrationResponse = await register(registerRequest(), { params: { eventId: event.id } });
    const registrationBody = await registrationResponse.json();
    expect(registrationResponse.status).toBe(201); expect(registrationBody).toMatchObject({ payment_id: 'payment-test', registration_id: 'registration-test', checkout_url: 'https://checkout.test/cs-test', status: 'pending' });
    expect(fake.state.registration?.status).toBe('pending_payment'); expect(fake.state.payment?.status).toBe('pending'); expect(fake.operations.some(operation => operation.table === 'registration_holds' && operation.kind === 'update' && (operation.value as { status?: string }).status === 'converted')).toBe(true);
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amount: 500, reference: 'REG-2099-000001' }));

    const verified: VerifiedWebhook = { eventId: 'event-paid', eventType: 'checkout_session.payment.paid', paymentId: 'cs-test', status: 'succeeded', amount: 500, gatewayTransactionId: 'pay-test', raw: { data: {} } };
    mocks.verifyWebhook.mockReturnValue(verified);
    const firstWebhook = await webhook(webhookRequest());
    expect(firstWebhook.status).toBe(200); expect(fake.operations.some(operation => operation.table === 'payments' && operation.kind === 'update' && (operation.value as { status?: string }).status === 'succeeded')).toBe(true); expect(fake.state.registration?.status).toBe('confirmed'); expect(fake.state.confirmedCalls).toBe(1); expect(mocks.createPostPaymentArtifacts).toHaveBeenCalledTimes(1);

    const duplicateWebhook = await webhook(webhookRequest());
    expect(duplicateWebhook.status).toBe(200); expect(fake.state.confirmedCalls).toBe(1); expect(mocks.createPostPaymentArtifacts).toHaveBeenCalledTimes(1);
  });
});
