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
  mockGetSession, mockIsAdmin, mockHasProjectAccess,
  mockFrom, mockSendSlackNotification,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockHasProjectAccess: vi.fn(),
  mockFrom: vi.fn(),
  mockSendSlackNotification: vi.fn(),
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

vi.mock('@/lib/slack', () => ({
  sendSlackNotification: mockSendSlackNotification,
}));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return actual;
});

import { POST } from '@/app/api/comments/route';
import { NextRequest } from 'next/server';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function createCommentRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/comments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendSlackNotification.mockResolvedValue(undefined);
  });

  it('should return 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = createCommentRequest({});
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid JSON body', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    const req = new NextRequest('http://localhost/api/comments', {
      method: 'POST',
      body: 'not-json',
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid JSON');
  });

  it('should return 400 when required fields are missing', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    const req = createCommentRequest({ screenshot_version_id: validUUID });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Missing required fields');
  });

  it('should return 400 for invalid screenshot_version_id UUID', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    const req = createCommentRequest({
      screenshot_version_id: 'not-a-uuid',
      x: 50,
      y: 50,
      text: 'Test comment',
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid coordinates', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    const req = createCommentRequest({
      screenshot_version_id: validUUID,
      x: 150,
      y: 50,
      text: 'Test comment',
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('should create comment successfully as admin', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const mockSelect = vi.fn();
    const mockInsert = vi.fn();
    const mockEq = vi.fn();
    const mockOrder = vi.fn();
    const mockLimit = vi.fn();
    const mockSingle = vi.fn();

    // Pin number query chain
    const pinChain = { order: mockOrder };
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: [] });

    // Insert chain
    const insertChain = { select: vi.fn().mockReturnValue({ single: mockSingle }) };
    mockSingle.mockResolvedValue({
      data: {
        id: 'new-comment-id',
        pin_number: 1,
        screenshot_version_id: validUUID,
        x: 50,
        y: 50,
        text: 'Test',
        author_id: 'admin',
        status: 'open',
      },
      error: null,
    });

    // Slack lookup chain
    const svSelectChain = { eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null }) }) };

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(pinChain) }) };
      if (fromCallCount === 2) return { insert: mockInsert };
      if (fromCallCount === 3) return { select: vi.fn().mockReturnValue(svSelectChain) };
      return { select: vi.fn() };
    });

    mockInsert.mockReturnValue(insertChain);

    const req = createCommentRequest({
      screenshot_version_id: validUUID,
      x: 50,
      y: 50,
      text: 'Test comment',
    });
    const response = await POST(req);
    expect(response.status).toBe(201);
  });

  it('should check project access for client users', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);
    mockHasProjectAccess.mockReturnValue(false);

    // screenshot_versions lookup returns project_id
    const svSingle = vi.fn().mockResolvedValue({
      data: { screen: { project_id: 'proj-1' } },
    });
    const svEq = vi.fn().mockReturnValue({ single: svSingle });
    const svSelect = vi.fn().mockReturnValue({ eq: svEq });

    // client_account_projects lookup
    const capEq = vi.fn().mockResolvedValue({ data: [] });
    const capSelect = vi.fn().mockReturnValue({ eq: capEq });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: svSelect }; // screenshot_versions
      if (fromCallCount === 2) return { select: capSelect }; // client_account_projects
      return { select: vi.fn() };
    });

    const req = createCommentRequest({
      screenshot_version_id: validUUID,
      x: 50,
      y: 50,
      text: 'Test comment',
    });
    const response = await POST(req);
    expect(response.status).toBe(403);
  });

  it('should return 404 when screenshot version not found for client', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const svSingle = vi.fn().mockResolvedValue({ data: null });
    const svEq = vi.fn().mockReturnValue({ single: svSingle });
    const svSelect = vi.fn().mockReturnValue({ eq: svEq });

    mockFrom.mockReturnValue({ select: svSelect });

    const req = createCommentRequest({
      screenshot_version_id: validUUID,
      x: 50,
      y: 50,
      text: 'Test comment',
    });
    const response = await POST(req);
    expect(response.status).toBe(404);
  });
});
