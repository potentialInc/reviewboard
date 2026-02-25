import { NextRequest, NextResponse } from 'next/server';
import { unsealData } from 'iron-session';

const SESSION_SECRET = process.env.SESSION_SECRET || 'reviewboard-default-secret-change-in-production-32chars!';

async function getSessionFromCookie(request: NextRequest) {
  const sealed = request.cookies.get('rb_session');
  if (!sealed?.value) return null;
  try {
    return await unsealData<{ type: string; id: string }>(sealed.value, {
      password: SESSION_SECRET,
    });
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths
  if (pathname === '/login' || pathname.startsWith('/api/auth/') || pathname === '/api/health') {
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/client/:path*', '/api/:path*', '/login'],
};
