import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const protectedPrefixes = ['/organizer', '/admin'];
const authPrefixes = ['/login', '/organizer-register', '/forgot-password', '/reset-password'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAuthPage = authPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // Public pages do not need an Auth network request. Keep event browsing and
  // other public routes available even if the Supabase Auth service is down.
  if (!isProtected && !isAuthPage) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isProtected) return new NextResponse('Authentication is temporarily unavailable. Please try again shortly.', { status: 503 });
      return response;
    }
    user = data.user;
  } catch {
    if (isProtected) return new NextResponse('Authentication is temporarily unavailable. Please try again shortly.', { status: 503 });
    return response;
  }

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  const isRegistrationPage = pathname === '/organizer-register';
  const isLoginPage = pathname === '/login';
  if (isAuthPage && user && !isRegistrationPage && !isLoginPage) {
    const requestedNext = request.nextUrl.searchParams.get('next');
    const safeNext = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : null;
    return NextResponse.redirect(new URL(safeNext ?? '/organizer/verification', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)'],
};
