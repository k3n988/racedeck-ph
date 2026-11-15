import { NextResponse } from 'next/server';
import { getPublicEventWinnerGroups } from '@/lib/public/events';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  try {
    return NextResponse.json({ groups: await getPublicEventWinnerGroups(params.eventId) }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Public event winners could not be loaded', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Published results could not be loaded' }, { status: 500 });
  }
}
