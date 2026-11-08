import { describe, expect, it } from 'vitest';
import { getCategoryPricing, manilaDateTimeToIso, validateEarlyBirdSchedule } from '@/lib/events/category-pricing';

describe('category pricing for registration', () => {
  const deadline = manilaDateTimeToIso('2026-11-07T23:59')!;
  const category = { registration_fee: 1500, early_bird_fee: 1200, early_bird_deadline: deadline };

  it('uses the early bird price before the Manila deadline and regular price at the deadline', () => {
    expect(getCategoryPricing(category, Date.parse(deadline) - 1).amount).toBe(1200);
    expect(getCategoryPricing(category, Date.parse(deadline)).amount).toBe(1500);
  });

  it('uses the regular price when no early bird offer is configured', () => {
    expect(getCategoryPricing({ registration_fee: 1500 }, Date.parse(deadline) - 1).amount).toBe(1500);
  });

  it('rejects an early bird deadline outside the registration window', () => {
    const schedule = { registrationOpensAt: manilaDateTimeToIso('2026-11-01T00:00'), registrationClosesAt: manilaDateTimeToIso('2026-11-30T23:59'), eventDate: '2026-12-12' };
    expect(validateEarlyBirdSchedule({ ...schedule, deadline: manilaDateTimeToIso('2026-10-31T23:59') })).toMatch(/after registration opens/i);
    expect(validateEarlyBirdSchedule({ ...schedule, deadline: manilaDateTimeToIso('2026-12-01T00:00') })).toMatch(/after registration closes/i);
    expect(validateEarlyBirdSchedule({ ...schedule, deadline })).toBeNull();
  });
});
