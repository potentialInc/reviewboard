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

const { mockGetSession, mockIsAdmin, mockHasProjectAccess, mockFrom, mockCheckRateLimit } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockHasProjectAccess: vi.fn(),
  mockFrom: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession,
  isAdmin: mockIsAdmin,
  hasProjectAccess: mockHasProjectAccess,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceSupabase: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return actual;
});

import { POST } from '@/app/api/comments/[id]/replies/route';
import { NextRequest } from 'next/server';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function createReplyRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/comments/' + validUUID + '/replies', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/comments/[id]/replies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue(true);
  });

  it('should return 400 for invalid Comment ID UUID', async () => {
    const req = createReplyRequest({ text: 'reply' });
    const response = await POST(req, makeParams('bad-id'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Comment ID');
  });

  it('should return 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = createReplyRequest({ text: 'reply' });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should return 429 when rate limit is exceeded', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockCheckRateLimit.mockReturnValue(false);

    const req = createReplyRequest({ text: 'reply' });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toContain('Too many replies');
  });

  it('should return 400 for invalid JSON body', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    const req = new NextRequest('http://localhost/api/comments/' + validUUID + '/replies', {
      method: 'POST',
      body: 'bad-json',
    });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid JSON');
  });

  it('should return 400 when text is missing', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    const req = createReplyRequest({});
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Reply text is required');
  });

  it('should return 400 when text is empty string', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    const req = createReplyRequest({ text: '' });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(400);
  });

  it('should create reply successfully for admin (skips project access check)', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const replyData = {
      id: 'reply-id',
      comment_id: validUUID,
      text: 'Thanks for feedback',
      author_type: 'admin',
      author_id: 'admin',
      created_at: '2024-01-01',
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: replyData, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const req = createReplyRequest({ text: 'Thanks for feedback' });
    const response = await POST(req, makeParams(validUUID));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.text).toBe('Thanks for feedback');
    expect(body.author_type).toBe('admin');
  });

  it('should check project access for client users', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);
    mockHasProjectAccess.mockReturnValue(true);

    // Comment lookup returns project_id
    const commentSingle = vi.fn().mockResolvedValue({
      data: { screenshot_version: { screen: { project_id: 'proj-1' } } },
    });
    const commentEq = vi.fn().mockReturnValue({ single: commentSingle });
    const commentSelect = vi.fn().mockReturnValue({ eq: commentEq });

    // client_account_projects lookup
    const capEq = vi.fn().mockResolvedValue({ data: [{ project_id: 'proj-1' }] });
    const capSelect = vi.fn().mockReturnValue({ eq: capEq });

    // replies insert
    const replyData = {
      id: 'reply-id',
      comment_id: validUUID,
      text: 'Noted',
      author_type: 'client',
      author_id: 'client1',
    };
    const replySingle = vi.fn().mockResolvedValue({ data: replyData, error: null });
    const replySelect = vi.fn().mockReturnValue({ single: replySingle });
    const replyInsert = vi.fn().mockReturnValue({ select: replySelect });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: commentSelect }; // comments lookup
      if (fromCallCount === 2) return { select: capSelect }; // client_account_projects
      if (fromCallCount === 3) return { insert: replyInsert }; // replies
      return {};
    });

    const req = createReplyRequest({ text: 'Noted' });
    const response = await POST(req, makeParams(validUUID));

    expect(response.status).toBe(201);
    expect(mockHasProjectAccess).toHaveBeenCalled();
  });

  it('should return 403 when client has no project access', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);
    mockHasProjectAccess.mockReturnValue(false);

    const commentSingle = vi.fn().mockResolvedValue({
      data: { screenshot_version: { screen: { project_id: 'proj-1' } } },
    });
    const commentEq = vi.fn().mockReturnValue({ single: commentSingle });
    const commentSelect = vi.fn().mockReturnValue({ eq: commentEq });

    const capEq = vi.fn().mockResolvedValue({ data: [] });
    const capSelect = vi.fn().mockReturnValue({ eq: capEq });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: commentSelect };
      if (fromCallCount === 2) return { select: capSelect };
      return {};
    });

    const req = createReplyRequest({ text: 'Noted' });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(403);
  });

  it('should return 404 when comment not found for client', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const commentSingle = vi.fn().mockResolvedValue({ data: null });
    const commentEq = vi.fn().mockReturnValue({ single: commentSingle });
    const commentSelect = vi.fn().mockReturnValue({ eq: commentEq });
    mockFrom.mockReturnValue({ select: commentSelect });

    const req = createReplyRequest({ text: 'Noted' });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(404);
  });

  it('should return 500 when insert fails', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const req = createReplyRequest({ text: 'reply text here' });
    const response = await POST(req, makeParams(validUUID));
    expect(response.status).toBe(500);

    consoleSpy.mockRestore();
  });
});
