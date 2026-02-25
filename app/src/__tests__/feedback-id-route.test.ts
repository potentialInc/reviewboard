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

const { mockRequireAdminWithSupabase, mockFrom } = vi.hoisted(() => ({
  mockRequireAdminWithSupabase: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/api-helpers', () => ({
  requireAdminWithSupabase: mockRequireAdminWithSupabase,
}));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return actual;
});

import { GET } from '@/app/api/feedback/[id]/route';
import { NextRequest, NextResponse } from 'next/server';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/feedback/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid UUID', async () => {
    const req = new NextRequest('http://localhost/api/feedback/bad');
    const response = await GET(req, makeParams('bad'));
    expect(response.status).toBe(400);
  });

  it('should return 401 when no session', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new NextRequest('http://localhost/api/feedback/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('should return 403 for non-admin', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const req = new NextRequest('http://localhost/api/feedback/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    expect(response.status).toBe(403);
  });

  it('should return 404 when feedback not found', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/feedback/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    expect(response.status).toBe(404);
  });

  it('should return feedback detail for admin', async () => {
    const feedbackData = {
      id: validUUID,
      text: 'Fix this',
      status: 'open',
      screenshot_version: {
        id: 'sv1',
        version: 1,
        image_url: '/img.png',
        screen: { id: 's1', name: 'Home', project: { id: 'p1', name: 'Project' } },
      },
      replies: [{ id: 'r1', text: 'On it', author_type: 'admin', created_at: '2024-01-01' }],
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: feedbackData, error: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const req = new NextRequest('http://localhost/api/feedback/' + validUUID);
    const response = await GET(req, makeParams(validUUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.text).toBe('Fix this');
    expect(body.replies).toHaveLength(1);
    expect(body.screenshot_version.screen.name).toBe('Home');
  });
});
