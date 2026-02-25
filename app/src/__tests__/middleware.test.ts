import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUnsealData } = vi.hoisted(() => ({
  mockUnsealData: vi.fn(),
}));

// Mock iron-session
vi.mock('iron-session', () => ({
  unsealData: mockUnsealData,
}));

// Mock next/server with headers support for applySecurityHeaders
vi.mock('next/server', () => {
  class MockHeaders {
    private _map = new Map<string, string>();
    set(key: string, value: string) { this._map.set(key, value); }
    get(key: string) { return this._map.get(key) || null; }
  }

  class MockNextRequest {
    public url: string;
    public method: string;
    public headers: { get: (key: string) => string | null };
    public cookies: { get: (name: string) => { value: string } | undefined };
    public nextUrl: { pathname: string };

    constructor(url: string, init: {
      method?: string;
      headers?: Record<string, string>;
      cookies?: Record<string, string>;
    } = {}) {
      this.url = url;
      this.method = init.method || 'GET';
      const headerMap = new Map(Object.entries(init.headers || {}));
      this.headers = { get: (key: string) => headerMap.get(key) || null };
      const cookieMap = init.cookies || {};
      this.cookies = { get: (name: string) => cookieMap[name] ? { value: cookieMap[name] } : undefined };
      this.nextUrl = { pathname: new URL(url).pathname };
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      next: () => ({ type: 'next', headers: new MockHeaders() }),
      json: (body: unknown, init?: { status?: number }) => ({
        type: 'json',
        body,
        status: init?.status ?? 200,
        headers: new MockHeaders(),
        json: async () => body,
      }),
      redirect: (url: URL) => ({
        type: 'redirect',
        url: url.toString(),
        headers: new MockHeaders(),
      }),
    },
  };
});

import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';

function createRequest(
  pathname: string,
  options: { method?: string; headers?: Record<string, string>; cookies?: Record<string, string> } = {}
) {
  return new NextRequest(`http://localhost${pathname}`, options);
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = 'test-session-secret-must-be-at-least-32-chars-long';
  });

  describe('public paths', () => {
    it('should pass through /login with security headers', async () => {
      const req = createRequest('/login');
      const response = await middleware(req);
      expect(response.type).toBe('next');
      expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
    });

    it('should pass through /api/auth/login', async () => {
      const req = createRequest('/api/auth/login', { method: 'POST' });
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });

    it('should pass through /api/auth/me', async () => {
      const req = createRequest('/api/auth/me');
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });

    it('should pass through /api/health', async () => {
      const req = createRequest('/api/health');
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });
  });

  describe('CSRF protection', () => {
    it('should reject POST to API with mismatched origin', async () => {
      const req = createRequest('/api/projects', {
        method: 'POST',
        headers: { origin: 'https://evil.com' },
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('json');
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('CSRF rejected');
    });

    it('should allow POST to API with matching origin', async () => {
      mockUnsealData.mockResolvedValue({ type: 'admin', id: 'admin' });
      const req = createRequest('/api/projects', {
        method: 'POST',
        headers: { origin: 'http://localhost' },
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });

    it('should allow GET to API without origin header', async () => {
      mockUnsealData.mockResolvedValue({ type: 'admin', id: 'admin' });
      const req = createRequest('/api/projects', {
        method: 'GET',
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });

    it('should reject POST without origin header (CSRF defense)', async () => {
      const req = createRequest('/api/projects', {
        method: 'POST',
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      // Missing origin on mutating request is now rejected
      expect(response.type).toBe('json');
      expect(response.status).toBe(403);
    });

    it('should not apply CSRF check to GET requests even with wrong origin', async () => {
      mockUnsealData.mockResolvedValue({ type: 'admin', id: 'admin' });
      const req = createRequest('/api/projects', {
        method: 'GET',
        headers: { origin: 'https://evil.com' },
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });
  });

  describe('authentication', () => {
    it('should return 401 for unauthenticated API GET request', async () => {
      const req = createRequest('/api/projects', { method: 'GET' });
      const response = await middleware(req);
      expect(response.type).toBe('json');
      expect(response.status).toBe(401);
    });

    it('should redirect unauthenticated admin page to /login', async () => {
      const req = createRequest('/admin');
      const response = await middleware(req);
      expect(response.type).toBe('redirect');
      expect(response.url).toContain('/login');
    });

    it('should redirect unauthenticated client page to /login', async () => {
      const req = createRequest('/client/projects');
      const response = await middleware(req);
      expect(response.type).toBe('redirect');
      expect(response.url).toContain('/login');
    });

    it('should return 401 when cookie unseal fails', async () => {
      mockUnsealData.mockRejectedValue(new Error('Bad seal'));
      const req = createRequest('/api/projects', {
        method: 'GET',
        cookies: { rb_session: 'bad-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('json');
      expect(response.status).toBe(401);
    });
  });

  describe('role-based access', () => {
    it('should redirect client user from admin pages to /client/projects', async () => {
      mockUnsealData.mockResolvedValue({ type: 'client', id: 'c1' });
      const req = createRequest('/admin', {
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('redirect');
      expect(response.url).toContain('/client/projects');
    });

    it('should redirect admin user from client pages to /admin', async () => {
      mockUnsealData.mockResolvedValue({ type: 'admin', id: 'admin' });
      const req = createRequest('/client/projects', {
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('redirect');
      expect(response.url).toContain('/admin');
    });

    it('should allow admin to access admin pages', async () => {
      mockUnsealData.mockResolvedValue({ type: 'admin', id: 'admin' });
      const req = createRequest('/admin', {
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });

    it('should allow client to access client pages', async () => {
      mockUnsealData.mockResolvedValue({ type: 'client', id: 'c1' });
      const req = createRequest('/client/projects', {
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });

    it('should allow admin to access API routes', async () => {
      mockUnsealData.mockResolvedValue({ type: 'admin', id: 'admin' });
      const req = createRequest('/api/projects', {
        method: 'GET',
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });

    it('should allow client to access API routes', async () => {
      mockUnsealData.mockResolvedValue({ type: 'client', id: 'c1' });
      const req = createRequest('/api/projects', {
        method: 'GET',
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.type).toBe('next');
    });
  });

  describe('security headers', () => {
    it('should apply HSTS header on public paths', async () => {
      const req = createRequest('/login');
      const response = await middleware(req);
      expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    });

    it('should apply CSP header on protected paths', async () => {
      mockUnsealData.mockResolvedValue({ type: 'admin', id: 'admin' });
      const req = createRequest('/admin', {
        cookies: { rb_session: 'valid-cookie' },
      });
      const response = await middleware(req);
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
    });

    it('should apply X-DNS-Prefetch-Control header', async () => {
      const req = createRequest('/api/health');
      const response = await middleware(req);
      expect(response.headers.get('X-DNS-Prefetch-Control')).toBe('off');
    });
  });

  describe('non-protected paths', () => {
    it('should pass through non-protected paths with security headers', async () => {
      const req = createRequest('/some-public-page');
      const response = await middleware(req);
      expect(response.type).toBe('next');
      expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
    });
  });
});
