import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession,
}));

import { GET } from '@/app/api/auth/me/route';

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should return session type and login_id for admin', async () => {
    mockGetSession.mockResolvedValue({
      type: 'admin',
      id: 'admin',
      login_id: 'admin-user',
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.type).toBe('admin');
    expect(body.login_id).toBe('admin-user');
  });

  it('should return session type and login_id for client', async () => {
    mockGetSession.mockResolvedValue({
      type: 'client',
      id: 'c1',
      login_id: 'client1',
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.type).toBe('client');
    expect(body.login_id).toBe('client1');
  });

  it('should not expose session id', async () => {
    mockGetSession.mockResolvedValue({
      type: 'admin',
      id: 'admin-secret-id',
      login_id: 'admin-user',
    });

    const response = await GET();
    const body = await response.json();

    expect(body.id).toBeUndefined();
  });
});
