import { describe, expect, it } from 'vitest';
import { organizerAllocation, summarizeOrganizerPayments } from '@/lib/payments/organizer-payment-calculations';

describe('organizer payment summaries', () => {
  it('sums PHP values in centavos and keeps refunded totals separate from historical collections', () => {
    const payments = [
      { status: 'succeeded', amount_paid: '0.10', amount_refunded: '0', metadata: { platform_fee: '0.01', processing_fee: '0.01' } },
      { status: 'partially_refunded', amount_paid: '0.20', amount_refunded: '0.05', metadata: { platform_fee: '0.02', processing_fee: '0.01' } },
      { status: 'refunded', amount_paid: '0.30', amount_refunded: '0.30', metadata: { platform_fee: '0.03', processing_fee: '0.02' } },
      { status: 'pending', amount_paid: '0', amount_refunded: '0', metadata: {} },
      { status: 'failed', amount_paid: '0', amount_refunded: '0', metadata: {} },
    ];
    expect(summarizeOrganizerPayments(payments)).toEqual({
      total_collected: 0.6,
      organizer_revenue: 0.5,
      successful_payments: 3,
      pending_payments: 1,
      refunded_amount: 0.35,
    });
  });

  it('does not produce a negative organizer allocation when fee snapshots exceed paid value', () => {
    expect(organizerAllocation({ status: 'succeeded', amount_paid: '0.01', metadata: { platform_fee: '0.02', processing_fee: '0.03' } })).toBe(0);
  });
});
