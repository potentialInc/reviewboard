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

const { mockClearSession } = vi.hoisted(() => ({
  mockClearSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  clearSession: mockClearSession,
}));

import { POST } from '@/app/api/auth/logout/route';

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call clearSession', async () => {
    mockClearSession.mockResolvedValue(undefined);
    await POST();
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it('should return ok: true', async () => {
    mockClearSession.mockResolvedValue(undefined);
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
