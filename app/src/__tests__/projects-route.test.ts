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

const { mockGetSession, mockIsAdmin, mockFrom, mockGetOpenFeedbackCountByProject } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockFrom: vi.fn(),
  mockGetOpenFeedbackCountByProject: vi.fn(),
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

vi.mock('@/lib/feedback-count', () => ({
  getOpenFeedbackCountByProject: mockGetOpenFeedbackCountByProject,
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(async () => 'hashed-password') },
}));

import { GET, POST } from '@/app/api/projects/route';
import { NextRequest } from 'next/server';

describe('GET /api/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOpenFeedbackCountByProject.mockResolvedValue({});
  });

  it('should return 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('should return all projects for admin with enriched data', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);
    mockGetOpenFeedbackCountByProject.mockResolvedValue({ 'p1': 3 });

    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 'p1', name: 'Project 1', screens: [{ id: 's1' }, { id: 's2' }] },
      ],
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });

    // client_account_projects lookup
    const mockIn = vi.fn().mockResolvedValue({
      data: [{ project_id: 'p1', client_accounts: { login_id: 'client1' } }],
    });
    const capSelect = vi.fn().mockReturnValue({ in: mockIn });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: mockSelect }; // projects
      if (fromCallCount === 2) return { select: capSelect }; // client_account_projects
      return { select: vi.fn() };
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].client_id).toBe('client1');
    expect(body[0].screen_count).toBe(2);
    expect(body[0].open_feedback_count).toBe(3);
  });

  it('should return 500 when project list query fails', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await GET();
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('should return assigned projects for client user', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);
    mockGetOpenFeedbackCountByProject.mockResolvedValue({});

    // client_account_projects query
    const capEq = vi.fn().mockResolvedValue({ data: [{ project_id: 'p1' }] });
    const capSelect = vi.fn().mockReturnValue({ eq: capEq });

    // projects query
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'p1', name: 'My Project', screens: [{ id: 's1' }] }],
    });
    const mockIn = vi.fn().mockReturnValue({ order: mockOrder });
    const projSelect = vi.fn().mockReturnValue({ in: mockIn });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { select: capSelect }; // client_account_projects
      if (fromCallCount === 2) return { select: projSelect }; // projects
      return { select: vi.fn() };
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].screen_count).toBe(1);
  });

  it('should return empty array for client with no assigned projects', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const capEq = vi.fn().mockResolvedValue({ data: [] });
    const capSelect = vi.fn().mockReturnValue({ eq: capEq });
    mockFrom.mockReturnValue({ select: capSelect });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});

describe('POST /api/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    mockIsAdmin.mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Project' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should return 401 for non-admin', async () => {
    mockGetSession.mockResolvedValue({ type: 'client', id: 'c1', login_id: 'client1' });
    mockIsAdmin.mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Project' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid JSON', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: 'not-json',
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('should return 400 when name is missing', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Project name is required');
  });

  it('should create project and auto-provision client account', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);

    const projectData = { id: 'proj-new', name: 'New Project', slack_channel: null };
    const accountData = { id: 'acc-new', login_id: 'NewProject1234' };

    const projSingle = vi.fn().mockResolvedValue({ data: projectData, error: null });
    const projSelect = vi.fn().mockReturnValue({ single: projSingle });
    const projInsert = vi.fn().mockReturnValue({ select: projSelect });

    const accSingle = vi.fn().mockResolvedValue({ data: accountData });
    const accSelect = vi.fn().mockReturnValue({ single: accSingle });
    const accInsert = vi.fn().mockReturnValue({ select: accSelect });

    const linkInsert = vi.fn().mockResolvedValue({});

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return { insert: projInsert }; // projects
      if (fromCallCount === 2) return { insert: accInsert }; // client_accounts
      if (fromCallCount === 3) return { insert: linkInsert }; // client_account_projects
      return {};
    });

    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Project' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.project).toBeDefined();
    expect(body.client_account).toBeDefined();
    expect(body.client_account.initial_password).toBeDefined();
  });

  it('should return 500 when project creation fails', async () => {
    mockGetSession.mockResolvedValue({ type: 'admin', id: 'admin', login_id: 'admin' });
    mockIsAdmin.mockReturnValue(true);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const projSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const projSelect = vi.fn().mockReturnValue({ single: projSingle });
    const projInsert = vi.fn().mockReturnValue({ select: projSelect });
    mockFrom.mockReturnValue({ insert: projInsert });

    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Fail Project' }),
      headers: { 'content-type': 'application/json' },
    });
    const response = await POST(req);
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });
});
