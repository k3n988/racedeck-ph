import { NextResponse } from 'next/server';
import { requireInternalAccess } from '@/lib/auth/rbac';
import { recoverPayMongoWebhooks } from '@/lib/payments/webhook-recovery.service';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(_request: Request, { params }: { params: { webhookId: string } }) {
  await requireInternalAccess();
  const admin = createAdminClient();
  const { data: event } = await admin.from('payment_webhook_events').select('id,status').eq('id', params.webhookId).eq('gateway', 'paymongo').maybeSingle();
  if (!event) return NextResponse.json({ error: 'Payment webhook event not found' }, { status: 404 });
  if (event.status === 'processed' || event.status === 'ignored') return NextResponse.json({ error: 'This webhook event is already terminal' }, { status: 409 });
  const { data: queued, error } = await admin.from('payment_webhook_events').update({ status: 'received', next_retry_at: null, error_message: null }).eq('id', event.id).in('status', ['failed', 'processing', 'received']).select('id,status').maybeSingle();
  if (error || !queued) return NextResponse.json({ error: 'Webhook could not be queued for retry' }, { status: 409 });
  return NextResponse.json({ event: queued, recovery: await recoverPayMongoWebhooks(1, event.id) });
}
