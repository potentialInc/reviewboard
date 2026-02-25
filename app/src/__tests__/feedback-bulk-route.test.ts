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

import { PATCH } from '@/app/api/feedback/bulk/route';
import { NextRequest, NextResponse } from 'next/server';

function createBulkRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/feedback/bulk', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const validId = '550e8400-e29b-41d4-a716-446655440000';

describe('PATCH /api/feedback/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no session', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = createBulkRequest({ ids: [validId], status: 'resolved' });
    const response = await PATCH(req);
    expect(response.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const req = createBulkRequest({ ids: [validId], status: 'resolved' });
    const response = await PATCH(req);
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

    const req = new NextRequest('http://localhost/api/feedback/bulk', {
      method: 'PATCH',
      body: 'not-json',
    });
    const response = await PATCH(req);
    expect(response.status).toBe(400);
  });

  it('should return 400 when ids is missing', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { status: 'resolved' } });

    const req = createBulkRequest({ status: 'resolved' });
    const response = await PATCH(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('ids and status are required');
  });

  it('should return 400 when status is missing', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: [validId] } });

    const req = createBulkRequest({ ids: [validId] });
    const response = await PATCH(req);
    expect(response.status).toBe(400);
  });

  it('should return 400 when ids is empty array', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: [], status: 'resolved' } });

    const req = createBulkRequest({ ids: [], status: 'resolved' });
    const response = await PATCH(req);
    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid status value', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: [validId], status: 'invalid-status' } });

    const req = createBulkRequest({ ids: [validId], status: 'invalid-status' });
    const response = await PATCH(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid status');
  });

  it('should accept "open" as valid status', async () => {
    const mockIn = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ update: mockUpdate });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: [validId], status: 'open' } });

    const req = createBulkRequest({ ids: [validId], status: 'open' });
    const response = await PATCH(req);
    expect(response.status).toBe(200);
  });

  it('should accept "in-progress" as valid status', async () => {
    const mockIn = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ update: mockUpdate });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: [validId], status: 'in-progress' } });

    const req = createBulkRequest({ ids: [validId], status: 'in-progress' });
    const response = await PATCH(req);
    expect(response.status).toBe(200);
  });

  it('should accept "resolved" as valid status', async () => {
    const mockIn = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ update: mockUpdate });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: [validId], status: 'resolved' } });

    const req = createBulkRequest({ ids: [validId], status: 'resolved' });
    const response = await PATCH(req);
    expect(response.status).toBe(200);
  });

  it('should update feedback statuses successfully', async () => {
    const mockIn = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const validId2 = '550e8400-e29b-41d4-a716-446655440001';
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: [validId, validId2], status: 'resolved' } });

    const req = createBulkRequest({ ids: [validId, validId2], status: 'resolved' });
    const response = await PATCH(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.updated).toBe(2);
  });

  it('should return 500 when update fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockIn = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ update: mockUpdate });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { ids: [validId], status: 'resolved' } });

    const req = createBulkRequest({ ids: [validId], status: 'resolved' });
    const response = await PATCH(req);
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
