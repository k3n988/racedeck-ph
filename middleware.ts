import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const protectedPrefixes = [
  '/dashboard', '/my-races', '/notifications', '/profile', '/payments', '/organizer', '/admin',
];
const authPrefixes = ['/login', '/register', '/organizer-register', '/forgot-password'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAuthPage = authPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    if (pathname === '/organizer' || pathname.startsWith('/organizer/')) loginUrl.searchParams.set('portal', 'organizer');
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
  const isRegistrationPage = pathname === '/register' || pathname === '/organizer-register';
  const isLoginPage = pathname === '/login';
  if (isAuthPage && user && !isRegistrationPage && !isLoginPage) {
    const requestedNext = request.nextUrl.searchParams.get('next');
    const safeNext = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : null;
    const portal = request.nextUrl.searchParams.get('portal');
    return NextResponse.redirect(new URL(safeNext ?? (portal === 'organizer' ? '/organizer/verification' : '/dashboard'), request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)'],
};
