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
  mockFrom, mockGetOpenFeedbackCountByScreen,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockHasProjectAccess: vi.fn(),
  mockFrom: vi.fn(),
  mockGetOpenFeedbackCountByScreen: vi.fn(),
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

vi.mock('@/lib/feedback-count', () => ({
  getOpenFeedbackCountByScreen: mockGetOpenFeedbackCountByScreen,
}));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return actual;
});

import { GET, PATCH, DELETE } from '@/app/api/projects/[id]/route';
import { NextRequest } from 'next/server';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOpenFeedbackCountByScreen.mockResolvedValue({});
  });

  it('should return 400 for invalid UUID', async () => {
    const req = new NextRequest('http://localhost/api/projects/bad');
    const response = await GET(req, makeParams('bad'));
    expect(response.status).toBe(400);
  });

  it('should return 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/projects/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should return 403 when client has no access', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);
    mockHasProjectAccess.mockReturnValue(false);

    const capEq = vi.fn().mockResolvedValue({ data: [] });
    const capSelect = vi.fn().mockReturnValue({ eq: capEq });
    mockFrom.mockReturnValue({ select: capSelect });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    expect(response.status).toBe(403);
  });

  it('should return project with screens for admin', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const project = {
      id: validUUID,
      name: 'Test Project',
      screens: [
        {
          id: 's1',
          name: 'Home',
          screenshot_versions: [
            { id: 'sv1', version: 2, image_url: '/img2.png', created_at: '2024-01-02' },
            { id: 'sv2', version: 1, image_url: '/img1.png', created_at: '2024-01-01' },
          ],
        },
      ],
    };

    const projSingle = vi.fn().mockResolvedValue({ data: project, error: null });
    const projEq = vi.fn().mockReturnValue({ single: projSingle });
    const projSelect = vi.fn().mockReturnValue({ eq: projEq });

    // capLinks via Promise.all: client_account_projects.select().eq().limit()
    const capLimit = vi.fn().mockResolvedValue({
      data: [{ client_accounts: { login_id: 'client1' } }],
    });
    const capEq = vi.fn().mockReturnValue({ limit: capLimit });
    const capSelect = vi.fn().mockReturnValue({ eq: capEq });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: projSelect }; // projects
      if (fromCallCount === 2) return { select: capSelect }; // client_account_projects
      return { select: vi.fn() };
    });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe('Test Project');
    expect(body.screens[0].latest_version.version).toBe(2);
    expect(body.client_id).toBe('client1');
  });

  it('should return 404 when project not found', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const projSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
    const projEq = vi.fn().mockReturnValue({ single: projSingle });
    const projSelect = vi.fn().mockReturnValue({ eq: projEq });
    mockFrom.mockReturnValue({ select: projSelect });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid UUID', async () => {
    const req = new NextRequest('http://localhost/api/projects/bad', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'new' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await PATCH(req, makeParams('bad'));
    expect(response.status).toBe(400);
  });

  it('should return 401 for non-admin', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/projects/' + validUUID, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'new' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await PATCH(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should update project name', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const updatedProject = { id: validUUID, name: 'Updated Name' };
    const mockSingle = vi.fn().mockResolvedValue({ data: updatedProject, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await PATCH(req, makeParams(validUUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe('Updated Name');
  });

  it('should return 500 on update failure', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'fail' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await PATCH(req, makeParams(validUUID));
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});

describe('DELETE /api/projects/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid UUID', async () => {
    const req = new NextRequest('http://localhost/api/projects/bad', { method: 'DELETE' });
    const response = await DELETE(req, makeParams('bad'));
    expect(response.status).toBe(400);
  });

  it('should return 401 for non-admin', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/projects/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should delete project successfully', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ delete: mockDelete });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('should return 500 on delete failure', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'fail' } });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ delete: mockDelete });

    const req = new NextRequest('http://localhost/api/projects/' + validUUID, { method: 'DELETE' });
    const response = await DELETE(req, makeParams(validUUID));
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
