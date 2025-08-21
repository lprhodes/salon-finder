import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, updateSession } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow access to login page and its API
  if (pathname === '/login' || pathname === '/api/login') {
    return NextResponse.next();
  }
  
  // Allow access to static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // files with extensions
  ) {
    return NextResponse.next();
  }
  
  // Check for session
  const session = request.cookies.get('session')?.value;
  
  if (!session) {
    // Redirect to login if no session
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Verify session
  const parsed = await decrypt(session);
  
  if (!parsed || !parsed.authenticated) {
    // Invalid or unauthenticated session
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Update session expiry
  return await updateSession(request) || NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};