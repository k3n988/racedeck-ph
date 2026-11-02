type PaymentRow = {
  status: string;
  amount_paid: number | string | null;
  amount_refunded?: number | string | null;
  metadata?: unknown;
};

export type OrganizerPaymentSummary = {
  total_collected: number;
  organizer_revenue: number;
  successful_payments: number;
  pending_payments: number;
  refunded_amount: number;
};

const successfulStatuses = new Set(['succeeded', 'partially_refunded', 'refunded']);
const toCents = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

function organizerAllocationCents(payment: PaymentRow) {
  const metadata = payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata)
    ? payment.metadata as Record<string, unknown>
    : {};
  return Math.max(0, toCents(payment.amount_paid) - toCents(metadata.platform_fee) - toCents(metadata.processing_fee));
}

export function organizerAllocation(payment: PaymentRow) {
  return organizerAllocationCents(payment) / 100;
}

export function summarizeOrganizerPayments(payments: PaymentRow[]): OrganizerPaymentSummary {
  const successful = payments.filter((payment) => successfulStatuses.has(payment.status));
  return {
    total_collected: successful.reduce((sum, payment) => sum + toCents(payment.amount_paid), 0) / 100,
    organizer_revenue: successful.reduce((sum, payment) => sum + organizerAllocationCents(payment), 0) / 100,
    successful_payments: successful.length,
    pending_payments: payments.filter((payment) => payment.status === 'pending' || payment.status === 'processing').length,
    refunded_amount: payments.reduce((sum, payment) => sum + toCents(payment.amount_refunded), 0) / 100,
  };
}
