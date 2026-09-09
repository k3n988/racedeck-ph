import { NextResponse } from 'next/server';
import { recoverPayMongoWebhooks } from '@/lib/payments/webhook-recovery.service';

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await recoverPayMongoWebhooks()); }
  catch (error) { console.error('Payment webhook recovery failed', error); return NextResponse.json({ error: 'Payment webhook recovery failed' }, { status: 500 }); }
}
