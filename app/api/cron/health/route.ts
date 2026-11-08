import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const checks = {
    cron_secret: Boolean(expected),
    supabase_service_role: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    resend: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  };
  let database = false;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('payment_webhook_events').select('id', { head: true, count: 'exact' });
    database = !error;
  } catch { database = false; }

  const ready = Object.values(checks).every(Boolean) && database;
  return NextResponse.json({ status: ready ? 'ready' : 'degraded', checks: { ...checks, database } }, { status: ready ? 200 : 503 });
}
