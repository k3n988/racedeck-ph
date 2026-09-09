import { NextResponse } from 'next/server';
import { dispatchDueReminders } from '@/lib/email/reminder.service';

export async function POST(request: Request) { if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); try { return NextResponse.json(await dispatchDueReminders()); } catch (error) { console.error('Reminder dispatch failed', error); return NextResponse.json({ error: 'Reminder dispatch failed' }, { status: 500 }); } }
