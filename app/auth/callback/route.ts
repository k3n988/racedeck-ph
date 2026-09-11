import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { provisionUser } from '@/lib/auth/provisioning';
import { resolveLandingRoute } from '@/lib/auth/resolve-landing-route';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login?error=missing_code', request.url));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login?error=session_missing', request.url));

  const metadata = user.user_metadata ?? {};
  try {
    await provisionUser(user, metadata.account_type === 'organizer' && typeof metadata.organization_name === 'string' ? metadata.organization_name : undefined);
  } catch {
    return NextResponse.redirect(new URL('/login?error=profile_setup_failed', request.url));
  }
  const destination = await resolveLandingRoute();
  return NextResponse.redirect(new URL(destination, request.url));
}
