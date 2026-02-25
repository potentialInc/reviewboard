import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

// Mock supabase server module
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceSupabase: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ limit: mockLimit });
  });

  it('should return 200 with status ok when database is healthy', async () => {
    mockLimit.mockResolvedValue({ error: null });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('should return 503 when database query returns an error', async () => {
    mockLimit.mockResolvedValue({ error: { message: 'connection refused' } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('error');
  });

  it('should return 503 when database is unreachable (exception thrown)', async () => {
    const { createServiceSupabase } = await import('@/lib/supabase/server');
    vi.mocked(createServiceSupabase).mockRejectedValueOnce(new Error('Network error'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.database).toBe('unreachable');
  });

  it('should query the projects table with limit 1', async () => {
    mockLimit.mockResolvedValue({ error: null });

    await GET();

    expect(mockFrom).toHaveBeenCalledWith('projects');
    expect(mockSelect).toHaveBeenCalledWith('id');
    expect(mockLimit).toHaveBeenCalledWith(1);
  });

  it('should include ISO timestamp in response', async () => {
    mockLimit.mockResolvedValue({ error: null });

    const response = await GET();
    const body = await response.json();

    // Validate it's a valid ISO string
    const date = new Date(body.timestamp);
    expect(date.toISOString()).toBe(body.timestamp);
  });
});
