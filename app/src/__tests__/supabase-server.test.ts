import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cookies } from 'next/headers';

// Mock @supabase/ssr and @supabase/supabase-js — vi.hoisted ensures variable exists before vi.mock hoisting
const { mockCreateServerClient, mockCreateClient } = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  })),
  mockCreateClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import { createServerSupabase, createServiceSupabase } from '@/lib/supabase/server';

describe('supabase/server', () => {
  let mockCookieStore: {
    get: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore = {
      get: vi.fn(),
      getAll: vi.fn(() => []),
      set: vi.fn(),
      delete: vi.fn(),
    };
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  describe('createServerSupabase', () => {
    it('should create a supabase client with anon key', async () => {
      await createServerSupabase();

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        }),
      );
    });

    it('should return a supabase client object', async () => {
      const client = await createServerSupabase();
      expect(client).toBeDefined();
      expect(client).toHaveProperty('from');
    });

    it('should pass cookie getAll that reads from cookie store', async () => {
      const testCookies = [{ name: 'test', value: 'val' }];
      mockCookieStore.getAll.mockReturnValue(testCookies);

      await createServerSupabase();

      const cookieConfig = mockCreateServerClient.mock.calls[0][2].cookies;
      const result = cookieConfig.getAll();
      expect(result).toEqual(testCookies);
    });

    it('should pass cookie setAll that writes to cookie store', async () => {
      await createServerSupabase();

      const cookieConfig = mockCreateServerClient.mock.calls[0][2].cookies;
      const cookiesToSet = [
        { name: 'sb-access-token', value: 'token-value', options: { path: '/' } },
      ];

      cookieConfig.setAll(cookiesToSet);

      expect(mockCookieStore.set).toHaveBeenCalledWith('sb-access-token', 'token-value', { path: '/' });
    });

    it('should silently catch errors in setAll (Server Component context)', async () => {
      mockCookieStore.set.mockImplementation(() => {
        throw new Error('Cannot set cookies in Server Component');
      });

      await createServerSupabase();

      const cookieConfig = mockCreateServerClient.mock.calls[0][2].cookies;

      // Should not throw
      expect(() =>
        cookieConfig.setAll([{ name: 'test', value: 'val', options: {} }])
      ).not.toThrow();
    });
  });

  describe('createServiceSupabase', () => {
    it('should create a supabase client with service role key (no cookies)', async () => {
      await createServiceSupabase();

      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-role-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: false,
            persistSession: false,
          }),
        }),
      );
    });

    it('should return a supabase client object', async () => {
      const client = await createServiceSupabase();
      expect(client).toBeDefined();
      expect(client).toHaveProperty('from');
    });

    it('should use SUPABASE_SERVICE_ROLE_KEY via createClient, not createServerClient', async () => {
      await createServiceSupabase();

      const secondArg = mockCreateClient.mock.calls[0][1];
      expect(secondArg).toBe('test-service-role-key');
      expect(secondArg).not.toBe('test-anon-key');
      // Should NOT use createServerClient (which requires cookies)
      expect(mockCreateServerClient).not.toHaveBeenCalledWith(
        expect.anything(),
        'test-service-role-key',
        expect.anything(),
      );
    });
  });
});
