export type CheckoutRequest = { amount: number; currency: string; description: string; reference: string; successUrl: string; cancelUrl: string };
export type CheckoutResult = { gatewayPaymentId: string; checkoutUrl: string };
export type RefundRequest = { gatewayPaymentId: string; amount: number; reason: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'others'; notes: string; idempotencyKey: string };
export type RefundResult = { gatewayRefundId: string; status: 'pending' | 'processing' | 'succeeded' | 'failed'; failureCode?: string; failureMessage?: string };
export type VerifiedRefundWebhook = { eventId: string; eventType: string; gatewayRefundId: string; status: 'pending' | 'processing' | 'succeeded' | 'failed'; failureCode?: string; failureMessage?: string; raw: Record<string, unknown> };
export type VerifiedWebhook = { eventId: string; eventType: string; paymentId: string; transactionId?: string; status: 'succeeded' | 'failed' | 'expired' | 'cancelled'; amount?: number; gatewayTransactionId?: string; raw: Record<string, unknown> };
export interface PaymentGateway { createCheckout(request: CheckoutRequest): Promise<CheckoutResult>; verifyWebhook(rawBody: string, signature: string): VerifiedWebhook; }
export interface RefundGateway { createRefund(request: RefundRequest): Promise<RefundResult>; }
