import { describe, expect, it } from 'vitest';
import { PayMongoProvider } from '@/lib/payments/paymongo.provider';

const sandboxSecret = process.env.PAYMONGO_SANDBOX_SECRET_KEY;

describe.skipIf(!sandboxSecret)('PayMongo sandbox integration', () => {
  it('creates a real sandbox Checkout Session without using production credentials', async () => {
    expect(sandboxSecret).toMatch(/^sk_test_/);
    const previous = process.env.PAYMONGO_SECRET_KEY;
    process.env.PAYMONGO_SECRET_KEY = sandboxSecret;
    try {
      const checkout = await new PayMongoProvider().createCheckout({
        amount: 1,
        currency: 'PHP',
        description: 'RaceDeck sandbox integration test',
        reference: `RACEDECK-SANDBOX-${Date.now()}`,
        successUrl: 'http://localhost:3000/my-races/sandbox-test',
        cancelUrl: 'http://localhost:3000/events',
      });
      expect(checkout.gatewayPaymentId).toMatch(/^cs_/);
      expect(checkout.checkoutUrl).toMatch(/^https:\/\/checkout\.paymongo\.com\//);
    } finally {
      if (previous === undefined) delete process.env.PAYMONGO_SECRET_KEY;
      else process.env.PAYMONGO_SECRET_KEY = previous;
    }
  });
});
