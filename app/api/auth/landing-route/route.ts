import { NextResponse } from 'next/server';
import { resolveLandingRoute } from '@/lib/auth/resolve-landing-route';

export async function GET() {
  const route = await resolveLandingRoute();
  if (!route) return NextResponse.json({ error: 'This login is only for RaceDeck organizers and administrators.' }, { status: 403 });
  return NextResponse.json({ route });
}
