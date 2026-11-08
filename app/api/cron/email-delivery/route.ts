import { NextResponse } from 'next/server';
import { processEmailQueue } from '@/lib/email/email.service';

export async function POST(request: Request) { if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); try { return NextResponse.json(await processEmailQueue()); } catch (error) { console.error('Email delivery worker failed', error); return NextResponse.json({ error: 'Email delivery worker failed' }, { status: 500 }); } }
