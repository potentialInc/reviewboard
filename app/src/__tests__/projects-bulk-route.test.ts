import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server
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

const { mockRequireAdminWithSupabase, mockParseJsonBody, mockFrom } = vi.hoisted(() => ({
  mockRequireAdminWithSupabase: vi.fn(),
  mockParseJsonBody: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/api-helpers', () => ({
  requireAdminWithSupabase: mockRequireAdminWithSupabase,
  parseJsonBody: mockParseJsonBody,
}));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return actual;
});

import { DELETE } from '@/app/api/projects/bulk/route';
import { NextRequest, NextResponse } from 'next/server';

function createBulkDeleteRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/projects/bulk', {
    method: 'DELETE',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('DELETE /api/projects/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no session', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = createBulkDeleteRequest({ ids: ['id1'] });
    const response = await DELETE(req);
    expect(response.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const req = createBulkDeleteRequest({ ids: ['id1'] });
    const response = await DELETE(req);
    expect(response.status).toBe(403);
  });

  it('should return 400 for invalid JSON', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({
      error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    });

    const req = new NextRequest('http://localhost/api/projects/bulk', {
      method: 'DELETE',
      body: 'not-json',
    });
    const response = await DELETE(req);
    expect(response.status).toBe(400);
  });

  it('should return 400 when ids is not an array', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: 'not-array' } });

    const req = createBulkDeleteRequest({ ids: 'not-array' });
    const response = await DELETE(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('ids array is required');
  });

  it('should return 400 when ids is empty array', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: [] } });

    const req = createBulkDeleteRequest({ ids: [] });
    const response = await DELETE(req);
    expect(response.status).toBe(400);
  });

  it('should return 400 when ids is missing', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: {} });

    const req = createBulkDeleteRequest({});
    const response = await DELETE(req);
    expect(response.status).toBe(400);
  });

  it('should delete projects successfully', async () => {
    const mockIn = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ delete: mockDelete });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    const validIds = [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ];
    mockParseJsonBody.mockResolvedValue({ body: { ids: validIds } });

    const req = createBulkDeleteRequest({ ids: validIds });
    const response = await DELETE(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(3);
  });

  it('should return 500 when delete fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockIn = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const mockDelete = vi.fn().mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ delete: mockDelete });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    const validId = '550e8400-e29b-41d4-a716-446655440000';
    mockParseJsonBody.mockResolvedValue({ body: { ids: [validId] } });

    const req = createBulkDeleteRequest({ ids: [validId] });
    const response = await DELETE(req);
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
