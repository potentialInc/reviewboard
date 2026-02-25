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

import { POST } from '@/app/api/projects/[id]/screens/route';
import { NextRequest, NextResponse } from 'next/server';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/projects/[id]/screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid Project ID', async () => {
    const req = new NextRequest('http://localhost/api/projects/bad/screens', {
      method: 'POST',
      body: JSON.stringify({ name: 'Screen' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req, makeParams('bad-id'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Project ID');
  });

  it('should return 401 when no session', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID + '/screens', {
      method: 'POST',
      body: JSON.stringify({ name: 'Screen' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID + '/screens', {
      method: 'POST',
      body: JSON.stringify({ name: 'Screen' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req, makeParams(validUUID));
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

    const req = new NextRequest('http://localhost/api/projects/' + validUUID + '/screens', {
      method: 'POST',
      body: 'not-json',
    });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(400);
  });

  it('should return 400 when name is missing', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: {} });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID + '/screens', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Screen name is required');
  });

  it('should create screen successfully', async () => {
    const screenData = { id: 'screen-new', project_id: validUUID, name: 'New Screen' };
    const mockSingle = vi.fn().mockResolvedValue({ data: screenData, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { name: 'New Screen' } });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID + '/screens', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Screen' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req, makeParams(validUUID));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.name).toBe('New Screen');
  });

  it('should return 500 when insert fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });
    mockParseJsonBody.mockResolvedValue({ body: { name: 'Fail Screen' } });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID + '/screens', {
      method: 'POST',
      body: JSON.stringify({ name: 'Fail Screen' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
