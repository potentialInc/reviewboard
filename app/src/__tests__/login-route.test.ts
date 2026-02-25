import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server before anything else
vi.mock('next/server', () => {
  class MockNextRequest {
    public url: string;
    public method: string;
    public headers: Map<string, string>;
    private _body: string;

    constructor(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
      this.url = url;
      this.method = init.method || 'GET';
      this._body = init.body || '';
      this.headers = new Map(Object.entries(init.headers || {}));
    }

    async json() {
      return JSON.parse(this._body);
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({
        body,
        status: init?.status ?? 200,
        json: async () => body,
      }),
    },
  };
});

// Mock dependencies — vi.hoisted ensures these exist before vi.mock hoisting
const { mockSetSession, mockFrom, mockSelect, mockEq, mockSingle, mockUpdate, mockUpdateEq, mockCheckRateLimit } = vi.hoisted(() => ({
  mockSetSession: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateEq: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  setSession: mockSetSession,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceSupabase: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}));

import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';

// Helper to create a mock NextRequest
function createLoginRequest(body: Record<string, unknown>, ip = '127.0.0.1') {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue(true);

    // Setup supabase chain (select + update for auto-upgrade)
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockUpdateEq.mockResolvedValue({});
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: null });

    // Set admin credentials
    process.env.ADMIN_ID = 'admin';
    process.env.ADMIN_PASSWORD = 'admin-secret';
  });

  describe('rate limiting', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockReturnValue(false);

      const req = createLoginRequest({ id: 'admin', password: 'admin-secret' });
      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.error).toContain('Too many login attempts');
    });

    it('should pass IP from x-forwarded-for to rate limiter', async () => {
      const req = createLoginRequest({ id: 'test', password: 'test' }, '10.0.0.1');
      await POST(req);

      expect(mockCheckRateLimit).toHaveBeenCalledWith('login:10.0.0.1', 5, 60_000);
    });

    it('should use first IP from comma-separated x-forwarded-for', async () => {
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ id: 'test', password: 'test' }),
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '10.0.0.1, 10.0.0.2',
        },
      });
      await POST(req);

      expect(mockCheckRateLimit).toHaveBeenCalledWith('login:10.0.0.1', 5, 60_000);
    });
  });

  describe('input validation', () => {
    it('should return 400 when id is missing', async () => {
      const req = createLoginRequest({ password: 'secret' });
      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('ID and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const req = createLoginRequest({ id: 'admin' });
      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('ID and password are required');
    });

    it('should return 400 when both id and password are missing', async () => {
      const req = createLoginRequest({});
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('should return 400 when id is empty string', async () => {
      const req = createLoginRequest({ id: '', password: 'secret' });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });
  });

  describe('admin login', () => {
    it('should succeed with correct admin credentials', async () => {
      const req = createLoginRequest({ id: 'admin', password: 'admin-secret' });
      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.type).toBe('admin');
      expect(body.redirect).toBe('/admin');
    });

    it('should call setSession with admin data on admin login', async () => {
      const req = createLoginRequest({ id: 'admin', password: 'admin-secret' });
      await POST(req);

      expect(mockSetSession).toHaveBeenCalledWith({
        type: 'admin',
        id: 'admin',
        login_id: 'admin',
      });
    });

    it('should not query database for admin login', async () => {
      const req = createLoginRequest({ id: 'admin', password: 'admin-secret' });
      await POST(req);

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should fail with wrong admin password', async () => {
      const req = createLoginRequest({ id: 'admin', password: 'wrong-password' });
      const response = await POST(req);
      const body = await response.json();

      // Falls through to client lookup, no client found -> 401
      expect(response.status).toBe(401);
      expect(body.error).toContain('Invalid credentials');
    });
  });

  describe('client login', () => {
    it('should succeed with valid client credentials', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'client-uuid',
          login_id: 'client1',
          password: 'client-pass',
        },
      });

      const req = createLoginRequest({ id: 'client1', password: 'client-pass' });
      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.type).toBe('client');
      expect(body.redirect).toBe('/client/projects');
    });

    it('should call setSession with client data', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'client-uuid',
          login_id: 'client1',
          password: 'client-pass',
        },
      });

      const req = createLoginRequest({ id: 'client1', password: 'client-pass' });
      await POST(req);

      expect(mockSetSession).toHaveBeenCalledWith({
        type: 'client',
        id: 'client-uuid',
        login_id: 'client1',
      });
    });

    it('should query client_accounts table by login_id', async () => {
      mockSingle.mockResolvedValue({ data: null });

      const req = createLoginRequest({ id: 'client1', password: 'pass' });
      await POST(req);

      expect(mockFrom).toHaveBeenCalledWith('client_accounts');
      expect(mockSelect).toHaveBeenCalledWith('id, login_id, password');
      expect(mockEq).toHaveBeenCalledWith('login_id', 'client1');
    });

    it('should return 401 when client account not found', async () => {
      mockSingle.mockResolvedValue({ data: null });

      const req = createLoginRequest({ id: 'nonexistent', password: 'pass' });
      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toContain('Invalid credentials');
    });

    it('should return 401 when password does not match', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'client-uuid',
          login_id: 'client1',
          password: 'correct-pass',
        },
      });

      const req = createLoginRequest({ id: 'client1', password: 'wrong-pass' });
      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toContain('Invalid credentials');
    });

    it('should not call setSession on failed login', async () => {
      mockSingle.mockResolvedValue({ data: null });

      const req = createLoginRequest({ id: 'nonexistent', password: 'pass' });
      await POST(req);

      expect(mockSetSession).not.toHaveBeenCalled();
    });
  });
});
