import { describe, expect, it } from 'vitest';
import { parsePayMongoWebhookPayload } from '@/lib/payments/paymongo.provider';

function checkoutWebhook(method: string) {
  return {
    data: {
      id: 'evt_method_test',
      attributes: {
        type: 'checkout_session.payment.paid',
        data: {
          id: 'cs_method_test',
          attributes: {
            payments: [{ id: 'pay_method_test', attributes: { amount: 45000, status: 'paid', source: { type: method } } }],
          },
        },
      },
    },
  };
}

describe('PayMongo verified payment method parsing', () => {
  it.each(['gcash', 'qrph', 'paymaya', 'maya', 'card'])('records the verified %s payment source', (method) => {
    expect(parsePayMongoWebhookPayload(checkoutWebhook(method)).paymentMethod).toBe(method);
  });

  it('does not expose or persist an unknown provider source as a payment method', () => {
    expect(parsePayMongoWebhookPayload(checkoutWebhook('unrecognized_source')).paymentMethod).toBeUndefined();
  });
});
