import { NextResponse } from 'next/server';
import { getPublicEventDetails } from '@/lib/public/events';
export async function GET(_request: Request, { params }: { params: { eventId: string } }) { const event = await getPublicEventDetails(params.eventId); if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 }); return NextResponse.json({ event }); }
