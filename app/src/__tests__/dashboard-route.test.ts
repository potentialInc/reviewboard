import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server with headers support
vi.mock('next/server', () => {
  class MockHeaders {
    private _map = new Map<string, string>();
    set(key: string, value: string) { this._map.set(key, value); }
    get(key: string) { return this._map.get(key) || null; }
  }

  return {
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({
        body,
        status: init?.status ?? 200,
        headers: new MockHeaders(),
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

import { GET } from '@/app/api/dashboard/route';
import { NextResponse } from 'next/server';

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no session', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('should return 403 when session is not admin', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const response = await GET();
    expect(response.status).toBe(403);
  });

  it('should return dashboard stats and recent activity for admin', async () => {
    // Build a mock supabase that supports the Promise.all pattern
    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // projects.select() => { count: 5 }
        return { select: vi.fn().mockReturnValue({ count: 5 }) };
      }
      if (fromCallCount === 2) {
        // comments.select().eq() => { count: 10 }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ count: 10 }) }) };
      }
      if (fromCallCount === 3) {
        // comments.select().gte() => { count: 3 }
        return { select: vi.fn().mockReturnValue({ gte: vi.fn().mockReturnValue({ count: 3 }) }) };
      }
      if (fromCallCount === 4) {
        // comments.select().gte() => { count: 7 }
        return { select: vi.fn().mockReturnValue({ gte: vi.fn().mockReturnValue({ count: 7 }) }) };
      }
      if (fromCallCount === 5) {
        // comments.select().order().limit() => { data: [...] }
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                data: [
                  {
                    id: 'c1',
                    text: 'Fix button',
                    created_at: '2024-01-01',
                    pin_number: 1,
                    status: 'open',
                    screenshot_version: {
                      screen: { name: 'Home', project: { name: 'MyProject' } },
                    },
                  },
                ],
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({}) };
    });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats).toBeDefined();
    expect(body.stats.total_projects).toBe(5);
    expect(body.stats.total_open_feedback).toBe(10);
    expect(body.stats.feedback_today).toBe(3);
    expect(body.stats.feedback_this_week).toBe(7);
    expect(body.recent_activity).toHaveLength(1);
    expect(body.recent_activity[0].project_name).toBe('MyProject');
    expect(body.recent_activity[0].screen_name).toBe('Home');
  });

  it('should handle zero/null counts gracefully', async () => {
    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return { select: vi.fn().mockReturnValue({ count: null }) };
      }
      if (fromCallCount <= 4) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ count: null }),
            gte: vi.fn().mockReturnValue({ count: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({ data: null }),
          }),
        }),
      };
    });

    mockRequireAdminWithSupabase.mockResolvedValue({
      session: { type: 'admin', id: 'admin', login_id: 'admin' },
      supabase: { from: mockFrom },
    });

    const response = await GET();
    const body = await response.json();

    expect(body.stats.total_projects).toBe(0);
    expect(body.stats.total_open_feedback).toBe(0);
    expect(body.stats.feedback_today).toBe(0);
    expect(body.stats.feedback_this_week).toBe(0);
    expect(body.recent_activity).toEqual([]);
  });
});
