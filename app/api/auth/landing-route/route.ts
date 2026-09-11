import { NextResponse } from 'next/server';
import { resolveLandingRoute } from '@/lib/auth/resolve-landing-route';

export async function GET() {
  return NextResponse.json({ route: await resolveLandingRoute() });
}
