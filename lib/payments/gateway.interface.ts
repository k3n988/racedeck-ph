export type CheckoutRequest = { amount: number; currency: string; description: string; reference: string; successUrl: string; cancelUrl: string };
export type CheckoutResult = { gatewayPaymentId: string; checkoutUrl: string };
export type VerifiedWebhook = { eventId: string; eventType: string; paymentId: string; transactionId?: string; status: 'succeeded' | 'failed' | 'expired' | 'cancelled'; amount?: number; gatewayTransactionId?: string; raw: Record<string, unknown> };
export interface PaymentGateway { createCheckout(request: CheckoutRequest): Promise<CheckoutResult>; verifyWebhook(rawBody: string, signature: string): VerifiedWebhook; }
