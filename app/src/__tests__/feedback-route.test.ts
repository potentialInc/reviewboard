import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server with headers support
vi.mock('next/server', () => {
  class MockHeaders {
    private _map = new Map<string, string>();
    set(key: string, value: string) { this._map.set(key, value); }
    get(key: string) { return this._map.get(key) || null; }
  }

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
        headers: new MockHeaders(),
        json: async () => body,
      }),
    },
  };
});

const { mockRequireAdminWithSupabase, mockFrom } = vi.hoisted(() => ({
  mockRequireAdminWithSupabase: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/api-helpers', () => ({
  requireAdminWithSupabase: mockRequireAdminWithSupabase,
}));

import { GET } from '@/app/api/feedback/route';
import { NextRequest, NextResponse } from 'next/server';

describe('GET /api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no session', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new NextRequest('http://localhost/api/feedback');
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const req = new NextRequest('http://localhost/api/feedback');
    const response = await GET(req);
    expect(response.status).toBe(403);
  });

  it('should return paginated feedback for admin', async () => {
    const comments = [
      {
        id: 'c1',
        text: 'Button misaligned',
        status: 'open',
        screenshot_version: {
          screen: { name: 'Home', project: { name: 'MyProject' } },
        },
        replies: [{ id: 'r1' }],
      },
    ];

    const mockRange = vi.fn().mockResolvedValue({ data: comments, count: 1, error: null });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/feedback');
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].screen_name).toBe('Home');
    expect(body.data[0].project_name).toBe('MyProject');
    expect(body.data[0].reply_count).toBe(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.per_page).toBe(25);
  });

  it('should filter by status', async () => {
    const mockRange = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const mockEq = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder = vi.fn().mockReturnValue({ eq: mockEq });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/feedback?status=resolved');
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('should not filter when status is "all"', async () => {
    const mockRange = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/feedback?status=all');
    const response = await GET(req);
    expect(response.status).toBe(200);
  });

  it('should handle search parameter', async () => {
    const mockRange = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const mockIlike = vi.fn().mockReturnValue({ range: mockRange });
    const mockOrder = vi.fn().mockReturnValue({ ilike: mockIlike });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/feedback?search=button');
    const response = await GET(req);
    expect(response.status).toBe(200);
  });

  it('should use custom page and per_page params', async () => {
    const mockRange = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/feedback?page=3&per_page=10');
    const response = await GET(req);
    const body = await response.json();

    expect(body.page).toBe(3);
    expect(body.per_page).toBe(10);
  });

  it('should return 500 when query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockRange = vi.fn().mockResolvedValue({ data: null, count: null, error: { message: 'DB error' } });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/feedback');
    const response = await GET(req);
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
