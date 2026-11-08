import { NextResponse } from 'next/server';
import { requireInternalAccess } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';

const statuses = ['received', 'processing', 'failed', 'processed', 'ignored'] as const;

export async function GET(request: Request) {
  await requireInternalAccess();
  const requestedStatus = new URL(request.url).searchParams.get('status');
  const admin = createAdminClient();
  let query = admin.from('payment_webhook_events').select('id,gateway,gateway_event_id,event_type,status,processing_attempts,next_retry_at,error_message,received_at,processed_at,payment_id,transaction_id,registration_id,event_id,organization_id').eq('gateway', 'paymongo').order('updated_at', { ascending: false }).limit(100);
  if (requestedStatus && (statuses as readonly string[]).includes(requestedStatus)) query = query.eq('status', requestedStatus as (typeof statuses)[number]);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Payment webhook events could not be loaded' }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
