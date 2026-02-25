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

const {
  mockIsAdmin, mockHasProjectAccess, mockFrom,
  mockRequireAuthWithSupabase, mockRequireAdminWithSupabase,
} = vi.hoisted(() => ({
  mockIsAdmin: vi.fn(),
  mockHasProjectAccess: vi.fn(),
  mockFrom: vi.fn(),
  mockRequireAuthWithSupabase: vi.fn(),
  mockRequireAdminWithSupabase: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  isAdmin: mockIsAdmin,
  hasProjectAccess: mockHasProjectAccess,
}));

vi.mock('@/lib/api-helpers', () => ({
  requireAuthWithSupabase: mockRequireAuthWithSupabase,
  requireAdminWithSupabase: mockRequireAdminWithSupabase,
}));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return actual;
});

import { GET, DELETE } from '@/app/api/screens/[id]/route';
import { NextRequest, NextResponse } from 'next/server';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/screens/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid UUID', async () => {
    const req = new NextRequest('http://localhost/api/screens/bad');
    const response = await GET(req, makeParams('bad'));
    expect(response.status).toBe(400);
  });

  it('should return 401 when no session', async () => {
    mockRequireAuthWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const req = new NextRequest('http://localhost/api/screens/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should return 404 when screen not found', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAuthWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/screens/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    expect(response.status).toBe(404);
  });

  it('should return 403 when client has no access to project', async () => {
    mockIsAdmin.mockReturnValue(false);
    mockHasProjectAccess.mockReturnValue(false);

    const screenData = {
      id: validUUID,
      name: 'Home',
      project: { id: 'proj-1', name: 'Project 1', slack_channel: null },
      screenshot_versions: [],
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: screenData });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    const capEq = vi.fn().mockResolvedValue({ data: [] });
    const capSelect = vi.fn().mockReturnValue({ eq: capEq });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: mockSelect }; // screens
      if (fromCallCount === 2) return { select: capSelect }; // client_account_projects
      return { select: vi.fn() };
    });

    mockRequireAuthWithSupabase.mockResolvedValue({
      session: { type: 'client', id: 'c1', login_id: 'client1' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/screens/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    expect(response.status).toBe(403);
  });

  it('should return screen with sorted versions and comments for admin', async () => {
    mockIsAdmin.mockReturnValue(true);

    const screenData = {
      id: validUUID,
      name: 'Home',
      project: { id: 'proj-1', name: 'Project 1', slack_channel: null },
      screenshot_versions: [
        {
          version: 1,
          comments: [
            { pin_number: 2, replies: [{ created_at: '2024-01-02' }, { created_at: '2024-01-01' }] },
            { pin_number: 1, replies: [] },
          ],
        },
        {
          version: 2,
          comments: [],
        },
      ],
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: screenData });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAuthWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/screens/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.screenshot_versions[0].version).toBe(2);
    expect(body.screenshot_versions[1].version).toBe(1);
    expect(body.screenshot_versions[1].comments[0].pin_number).toBe(1);
    expect(body.screenshot_versions[1].comments[1].pin_number).toBe(2);
    expect(body.screenshot_versions[1].comments[1].replies[0].created_at).toBe('2024-01-01');
    expect(body.latest_version.version).toBe(2);
  });
});

describe('DELETE /api/screens/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid UUID', async () => {
    const req = new NextRequest('http://localhost/api/screens/bad', { method: 'DELETE' });
    const response = await DELETE(req, makeParams('bad'));
    expect(response.status).toBe(400);
  });

  it('should return 401 when no session', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new NextRequest('http://localhost/api/screens/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const req = new NextRequest('http://localhost/api/screens/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(403);
  });

  it('should delete screen successfully for admin', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ delete: mockDelete });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/screens/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('should return 500 when delete fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ delete: mockDelete });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/screens/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
