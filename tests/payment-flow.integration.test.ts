import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PayMongoProvider } from '@/lib/payments/paymongo.provider';
import { authenticatedClient } from './helpers/auth';
import { cleanupLocalFixture, createLocalParticipant, seedLocalFixture } from './helpers/supabase';

describe('RaceDeck payment and checkout contracts', () => {
  let fixture: Awaited<ReturnType<typeof seedLocalFixture>>;
  const createdUsers: string[] = [];
  const createdRegistrations: string[] = [];
  const createdCategories: string[] = [];
  const createdHolds: string[] = [];
  const createdWebhookEvents: string[] = [];

  beforeAll(async () => { fixture = await seedLocalFixture(); });
  afterAll(async () => {
    if (!fixture) return;
    if (createdHolds.length) await fixture.admin.from('registration_holds').delete().in('id', createdHolds);
    if (createdWebhookEvents.length) await fixture.admin.from('payment_webhook_events').delete().in('id', createdWebhookEvents);
    if (createdRegistrations.length) await fixture.admin.from('registrations').delete().in('id', createdRegistrations);
    if (createdCategories.length) await fixture.admin.from('race_categories').delete().in('id', createdCategories);
    await Promise.all(createdUsers.map(id => fixture.admin.auth.admin.deleteUser(id)));
    await cleanupLocalFixture(fixture);
  });

  it('serializes concurrent slot holds at category capacity', async () => {
    const { data: category, error } = await fixture.admin.from('race_categories').insert({ event_id: fixture.event.id, name: `Capacity ${Date.now()}`, registration_fee: 100, max_slots: 1, registration_availability: 'open' }).select('id').single();
    expect(error).toBeNull(); expect(category).toBeTruthy(); createdCategories.push(category!.id);
    const secondParticipant = await createLocalParticipant(fixture.admin); createdUsers.push(secondParticipant.id);
    const expiry = new Date(Date.now() + 10 * 60_000).toISOString();
    const reserve = (userId: string) => fixture.admin.rpc('reserve_registration_slot', { p_event_id: fixture.event.id, p_category_id: category!.id, p_user_id: userId, p_session_id: `local-test-${userId}`, p_expires_at: expiry });
    const [first, second] = await Promise.all([reserve(fixture.participant.id), reserve(secondParticipant.id)]);
    expect(first.error).toBeNull(); expect(second.error).toBeNull();
    const holds = [first.data, second.data].filter((id): id is string => Boolean(id));
    createdHolds.push(...holds);
    expect(holds).toHaveLength(1);
  });

  it('deduplicates gateway webhook events with the durable unique key', async () => {
    const eventId = `local-payment-webhook-${crypto.randomUUID()}`;
    const base = { gateway: 'paymongo', gateway_event_id: eventId, event_type: 'payment.paid', payload: { test: true } };
    const first = await fixture.admin.from('payment_webhook_events').insert(base).select('id').single();
    expect(first.error).toBeNull(); createdWebhookEvents.push(first.data!.id);
    const duplicate = await fixture.admin.from('payment_webhook_events').insert(base);
    expect(duplicate.error?.code).toBe('23505');
    const { count } = await fixture.admin.from('payment_webhook_events').select('id', { count: 'exact', head: true }).eq('gateway', 'paymongo').eq('gateway_event_id', eventId);
    expect(count).toBe(1);
  });

  it('verifies signed PayMongo success and failure events without trusting client status', () => {
    const previous = process.env.PAYMONGO_WEBHOOK_SECRET; process.env.PAYMONGO_WEBHOOK_SECRET = 'local-webhook-secret';
    try {
      for (const [type, expected] of [['payment.paid', 'succeeded'], ['payment.failed', 'failed']] as const) {
        const raw = JSON.stringify({ data: { id: `evt-${type}`, attributes: { type, data: { id: `checkout-${type}` } } } });
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = crypto.createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET).update(`${timestamp}.${raw}`).digest('hex');
        expect(new PayMongoProvider().verifyWebhook(raw, `t=${timestamp},v1=${signature}`).status).toBe(expected);
      }
      expect(() => new PayMongoProvider().verifyWebhook('{"data":{}}', 't=1,v1=bad')).toThrow();
    } finally { if (previous === undefined) delete process.env.PAYMONGO_WEBHOOK_SECRET; else process.env.PAYMONGO_WEBHOOK_SECRET = previous; }
  });

  it('extracts the stored Checkout Session and paid amount from a Hosted Checkout webhook', () => {
    const previous = process.env.PAYMONGO_WEBHOOK_SECRET; process.env.PAYMONGO_WEBHOOK_SECRET = 'local-webhook-secret';
    try {
      const raw = JSON.stringify({ event_type: 'send.webhook', data: { id: 'evt-hosted-checkout', type: 'checkout_session.payment.paid', resource: 'checkout_session', data: { id: 'cs-racedeck-checkout', attributes: { payments: [{ id: 'pay-racedeck-transaction', attributes: { amount: 51250, status: 'paid' } }] } } } });
      const timestamp = String(Math.floor(Date.now() / 1000)); const signature = crypto.createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET).update(`${timestamp}.${raw}`).digest('hex');
      const verified = new PayMongoProvider().verifyWebhook(raw, `t=${timestamp},v1=${signature}`);
      expect(verified).toMatchObject({ eventId: 'evt-hosted-checkout', paymentId: 'cs-racedeck-checkout', gatewayTransactionId: 'pay-racedeck-transaction', status: 'succeeded', amount: 512.5 });
    } finally { if (previous === undefined) delete process.env.PAYMONGO_WEBHOOK_SECRET; else process.env.PAYMONGO_WEBHOOK_SECRET = previous; }
  });

  it('does not expose another participant registration through RLS', async () => {
    const other = await createLocalParticipant(fixture.admin); createdUsers.push(other.id);
    const { data: registration, error } = await fixture.admin.from('registrations').insert({ registration_number: `PRIVATE-${Date.now()}`, event_id: fixture.event.id, category_id: fixture.category.id, user_id: other.id, status: 'pending_payment', first_name: 'Other', last_name: 'Participant', email: other.email! }).select('id').single();
    expect(error).toBeNull(); createdRegistrations.push(registration!.id);
    const client = await authenticatedClient(fixture.participant);
    const { data } = await client.from('registrations').select('id').eq('id', registration!.id);
    expect(data).toEqual([]);
  });
});
