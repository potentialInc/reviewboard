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

const { mockGetSession, mockIsAdmin, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession,
  isAdmin: mockIsAdmin,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceSupabase: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return actual;
});

import { PATCH, DELETE } from '@/app/api/comments/[id]/route';
import { NextRequest } from 'next/server';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function createPatchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/comments/' + validUUID, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('PATCH /api/comments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid UUID', async () => {
    const req = createPatchRequest({ status: 'resolved' });
    const response = await PATCH(req, makeParams('not-valid'));
    expect(response.status).toBe(400);
  });

  it('should return 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = createPatchRequest({ status: 'resolved' });
    const response = await PATCH(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid JSON body', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    const req = new NextRequest('http://localhost/api/comments/' + validUUID, {
      method: 'PATCH',
      body: 'not-json',
    });
    const response = await PATCH(req, makeParams(validUUID));
    expect(response.status).toBe(400);
  });

  it('should return 404 when comment not found', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const mockSingle = vi.fn().mockResolvedValue({ data: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const req = createPatchRequest({ status: 'resolved' });
    const response = await PATCH(req, makeParams(validUUID));
    expect(response.status).toBe(404);
  });

  it('should return 403 when non-admin tries to edit text of another user', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: validUUID, author_id: 'other-user', text: 'original', status: 'open' },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const req = createPatchRequest({ text: 'modified' });
    const response = await PATCH(req, makeParams(validUUID));
    expect(response.status).toBe(403);
  });

  it('should allow author to edit their own text', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const currentComment = { id: validUUID, author_id: 'client1', text: 'original', status: 'open' };
    const updatedComment = { ...currentComment, text: 'modified' };

    const mockSingle = vi.fn()
      .mockResolvedValueOnce({ data: currentComment })  // fetch current
      .mockResolvedValueOnce({ data: updatedComment, error: null }); // update result

    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEq });
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) }) });
    const mockInsert = vi.fn().mockResolvedValue({});

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: mockSelectFn }; // fetch current
      if (fromCallCount === 2) return { update: mockUpdate }; // update
      if (fromCallCount === 3) return { insert: mockInsert }; // audit_log
      return { select: vi.fn() };
    });

    const req = createPatchRequest({ text: 'modified' });
    const response = await PATCH(req, makeParams(validUUID));
    expect(response.status).toBe(200);
  });

  it('should only allow admin to update status', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const currentComment = { id: validUUID, author_id: 'client1', text: 'test', status: 'open' };
    const updatedComment = { ...currentComment, status: 'resolved' };

    const mockSingle = vi.fn()
      .mockResolvedValueOnce({ data: currentComment })
      .mockResolvedValueOnce({ data: updatedComment, error: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEq });
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) }) });
    const mockInsert = vi.fn().mockResolvedValue({});

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: mockSelectFn };
      if (fromCallCount === 2) return { update: mockUpdate };
      if (fromCallCount === 3) return { insert: mockInsert };
      return { select: vi.fn() };
    });

    const req = createPatchRequest({ status: 'resolved' });
    const response = await PATCH(req, makeParams(validUUID));
    expect(response.status).toBe(200);
  });

  it('should return 403 when non-admin tries to change status', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    // Non-admin sends status only => now returns 403 early
    const req = createPatchRequest({ status: 'resolved' });
    const response = await PATCH(req, makeParams(validUUID));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('only admins');
  });
});

describe('DELETE /api/comments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid UUID', async () => {
    const req = new NextRequest('http://localhost/api/comments/bad', { method: 'DELETE' });
    const response = await DELETE(req, makeParams('bad-id'));
    expect(response.status).toBe(400);
  });

  it('should return 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/comments/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should return 404 when comment not found', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });

    const mockSingle = vi.fn().mockResolvedValue({ data: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const req = new NextRequest('http://localhost/api/comments/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(404);
  });

  it('should return 403 when non-admin tries to delete another user comment', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const mockSingle = vi.fn().mockResolvedValue({
      data: { text: 'some text', author_id: 'other-user' },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const req = new NextRequest('http://localhost/api/comments/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(403);
  });

  it('should allow admin to delete any comment', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const mockSingle = vi.fn().mockResolvedValue({
      data: { text: 'some text', author_id: 'other-user' },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockInsert = vi.fn().mockResolvedValue({});
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: mockSelect }; // fetch current
      if (fromCallCount === 2) return { insert: mockInsert }; // audit_log
      if (fromCallCount === 3) return { delete: mockDelete }; // delete
      return {};
    });

    const req = new NextRequest('http://localhost/api/comments/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('should allow author to delete own comment', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const mockSingle = vi.fn().mockResolvedValue({
      data: { text: 'my text', author_id: 'client1' },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockInsert = vi.fn().mockResolvedValue({});
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: mockSelect };
      if (fromCallCount === 2) return { insert: mockInsert };
      if (fromCallCount === 3) return { delete: mockDelete };
      return {};
    });

    const req = new NextRequest('http://localhost/api/comments/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(200);
  });

  it('should return 500 when delete fails', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockSingle = vi.fn().mockResolvedValue({
      data: { text: 'some text', author_id: 'user' },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockInsert = vi.fn().mockResolvedValue({});
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: mockSelect };
      if (fromCallCount === 2) return { insert: mockInsert };
      if (fromCallCount === 3) return { delete: mockDelete };
      return {};
    });

    const req = new NextRequest('http://localhost/api/comments/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
