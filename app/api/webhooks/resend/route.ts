import { NextResponse } from 'next/server';
import { processResendWebhook } from '@/lib/email/resend.webhook';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rawBody = await request.text();
  try { return NextResponse.json({ received: true, ...(await processResendWebhook(rawBody, request)) }); } catch (error) { const message = error instanceof Error ? error.message : 'Invalid webhook'; return NextResponse.json({ error: message === 'Invalid webhook signature' ? message : 'Invalid email delivery webhook' }, { status: 400 }); }
}
