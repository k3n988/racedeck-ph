export type PricingInput = { registrationAmount: number; processingFee?: number; platformFee?: number; discountAmount?: number };
export type PricingResult = PricingInput & { totalAmount: number; subtotalAmount: number };

function cents(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error('Payment amounts must be finite and non-negative');
  return Math.round(value * 100);
}

export function calculatePaymentTotal(input: PricingInput): PricingResult {
  const registration = cents(input.registrationAmount); const processing = cents(input.processingFee ?? 0); const platform = cents(input.platformFee ?? 0); const discount = cents(input.discountAmount ?? 0); const subtotal = Math.max(0, registration + processing + platform - discount);
  return { ...input, processingFee: processing / 100, platformFee: platform / 100, discountAmount: discount / 100, subtotalAmount: subtotal / 100, totalAmount: subtotal / 100 };
}
