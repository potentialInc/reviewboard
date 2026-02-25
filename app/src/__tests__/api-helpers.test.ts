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

const { mockGetSession, mockIsAdmin, mockCreateServiceSupabase } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockCreateServiceSupabase: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession,
  isAdmin: mockIsAdmin,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceSupabase: mockCreateServiceSupabase,
}));

import {
  requireAuth, requireAdmin,
  requireAdminWithSupabase, requireAuthWithSupabase,
  parseJsonBody,
} from '@/lib/api-helpers';

describe('api-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should return session when authenticated', async () => {
      const session = { type: 'admin' as const, id: 'admin', login_id: 'admin' };
      mockGetSession.mockResolvedValue(session);

      const result = await requireAuth();
      expect(result.session).toEqual(session);
      expect(result.error).toBeUndefined();
    });

    it('should return 401 error when no session', async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await requireAuth();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(401);
      expect(result.session).toBeUndefined();
    });
  });

  describe('requireAdmin', () => {
    it('should return session when admin', async () => {
      const session = { type: 'admin' as const, id: 'admin', login_id: 'admin' };
      mockGetSession.mockResolvedValue(session);
      mockIsAdmin.mockReturnValue(true);

      const result = await requireAdmin();
      expect(result.session).toEqual(session);
      expect(result.error).toBeUndefined();
    });

    it('should return 401 when no session', async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await requireAdmin();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(401);
    });

    it('should return 401 when session exists but is not admin', async () => {
      const session = { type: 'client' as const, id: 'c1', login_id: 'client1' };
      mockGetSession.mockResolvedValue(session);
      mockIsAdmin.mockReturnValue(false);

      const result = await requireAdmin();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(401);
      const body = await result.error!.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('requireAdminWithSupabase', () => {
    it('should return session and supabase for admin', async () => {
      const session = { type: 'admin' as const, id: 'admin', login_id: 'admin' };
      const mockSupabase = { from: vi.fn() };
      mockGetSession.mockResolvedValue(session);
      mockIsAdmin.mockReturnValue(true);
      mockCreateServiceSupabase.mockResolvedValue(mockSupabase);

      const result = await requireAdminWithSupabase();
      expect(result.session).toEqual(session);
      expect(result.supabase).toBe(mockSupabase);
      expect(result.error).toBeUndefined();
    });

    it('should return error without creating supabase when not admin', async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await requireAdminWithSupabase();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(401);
      expect(mockCreateServiceSupabase).not.toHaveBeenCalled();
    });
  });

  describe('requireAuthWithSupabase', () => {
    it('should return session and supabase for authenticated user', async () => {
      const session = { type: 'client' as const, id: 'c1', login_id: 'client1' };
      const mockSupabase = { from: vi.fn() };
      mockGetSession.mockResolvedValue(session);
      mockCreateServiceSupabase.mockResolvedValue(mockSupabase);

      const result = await requireAuthWithSupabase();
      expect(result.session).toEqual(session);
      expect(result.supabase).toBe(mockSupabase);
      expect(result.error).toBeUndefined();
    });

    it('should return error when not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await requireAuthWithSupabase();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(401);
      expect(mockCreateServiceSupabase).not.toHaveBeenCalled();
    });
  });

  describe('parseJsonBody', () => {
    it('should parse valid JSON body', async () => {
      const mockRequest = {
        json: async () => ({ name: 'test', value: 42 }),
      } as Request;

      const result = await parseJsonBody<{ name: string; value: number }>(mockRequest);
      expect(result.body).toEqual({ name: 'test', value: 42 });
      expect(result.error).toBeUndefined();
    });

    it('should return 400 error for invalid JSON', async () => {
      const mockRequest = {
        json: async () => { throw new Error('Unexpected token'); },
      } as Request;

      const result = await parseJsonBody(mockRequest);
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(400);
      const body = await result.error!.json();
      expect(body.error).toContain('Invalid JSON body');
    });
  });
});
