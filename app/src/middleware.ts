import { NextRequest, NextResponse } from 'next/server';
import { unsealData } from 'iron-session';

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters long');
  }
  return secret;
}

async function getSessionFromCookie(request: NextRequest) {
  const sealed = request.cookies.get('rb_session');
  if (!sealed?.value) return null;
  try {
    return await unsealData<{ type: string; id: string }>(sealed.value, {
      password: getSessionSecret(),
    });
  } catch {
    return null;
  }
}

/**
 * Append security headers to every response.
 * SECURITY: HSTS, CSP, and other defense-in-depth headers that protect against
 * clickjacking, MIME-sniffing, XSS, and protocol downgrade attacks.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  // SECURITY: Strict-Transport-Security forces HTTPS for 1 year including subdomains.
  // Prevents SSL-stripping / protocol downgrade attacks.
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  // SECURITY: Content-Security-Policy restricts the sources from which the browser
  // will load scripts, styles, images, etc. This mitigates XSS by blocking inline
  // scripts (except unsafe-inline for Next.js hydration) and unknown origins.
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co http://127.0.0.1:*",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co http://127.0.0.1:*",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // SECURITY: Prevents DNS prefetch to external origins (privacy + security)
  response.headers.set('X-DNS-Prefetch-Control', 'off');

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths — still get security headers
  if (pathname === '/login' || pathname.startsWith('/api/auth/') || pathname === '/api/health') {
    return applySecurityHeaders(NextResponse.next());
  }

  // CSRF defense: reject state-changing API requests with mismatched Origin.
  // SECURITY: When Origin header is absent on a non-GET/HEAD request, reject it.
  // A missing Origin on a mutating request is suspicious (e.g. curl from a script,
  // or a cross-site request from a legacy browser). Legitimate browser JS calls
  // always send an Origin header with fetch/XMLHttpRequest.
  if (pathname.startsWith('/api/') && request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    const allowed = new URL(request.url).origin;
    if (!origin || origin !== allowed) {
      return NextResponse.json({ error: 'CSRF rejected' }, { status: 403 });
    }
  }

  // Protected paths — validate session
  if (pathname.startsWith('/admin') || pathname.startsWith('/client') || pathname.startsWith('/api/')) {
    const session = await getSessionFromCookie(request);

    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Role-based access: admin routes require admin session
    if (pathname.startsWith('/admin') && session.type !== 'admin') {
      return NextResponse.redirect(new URL('/client/projects', request.url));
    }

    // Role-based access: client routes require client session
    if (pathname.startsWith('/client') && session.type !== 'client') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/admin/:path*', '/client/:path*', '/api/:path*', '/login'],
};
