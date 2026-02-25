import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cookies } from 'next/headers';

// Mock iron-session
vi.mock('iron-session', () => ({
  sealData: vi.fn(async (data: unknown) => JSON.stringify(data)),
  unsealData: vi.fn(async (sealed: string) => JSON.parse(sealed)),
}));

import { getSession, setSession, clearSession, isAdmin, hasProjectAccess } from '@/lib/auth';
import { sealData, unsealData } from 'iron-session';
import type { SessionUser } from '@/lib/types';

describe('auth / session management', () => {
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
  });

  describe('getSession', () => {
    it('should return null when no session cookie exists', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      const result = await getSession();
      expect(result).toBeNull();
    });

    it('should return null when session cookie has empty value', async () => {
      mockCookieStore.get.mockReturnValue({ value: '' });
      const result = await getSession();
      expect(result).toBeNull();
    });

    it('should return session user when valid cookie exists', async () => {
      const user: SessionUser = { type: 'admin', id: 'admin', login_id: 'admin-user' };
      const sealed = JSON.stringify(user);
      mockCookieStore.get.mockReturnValue({ value: sealed });

      const result = await getSession();

      expect(unsealData).toHaveBeenCalledWith(sealed, expect.objectContaining({ password: expect.any(String) }));
      expect(result).toEqual(user);
    });

    it('should return null when unseal fails (corrupted cookie)', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'corrupted-data' });
      vi.mocked(unsealData).mockRejectedValueOnce(new Error('Bad seal'));

      const result = await getSession();
      expect(result).toBeNull();
    });
  });

  describe('setSession', () => {
    it('should seal user data and set cookie with correct options', async () => {
      const user: SessionUser = { type: 'admin', id: 'admin', login_id: 'admin-user' };

      await setSession(user);

      expect(sealData).toHaveBeenCalledWith(user, expect.objectContaining({
        password: expect.any(String),
        ttl: 60 * 60 * 24 * 7,
      }));

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'rb_session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        }),
      );
    });

    it('should set secure flag based on NODE_ENV', async () => {
      const user: SessionUser = { type: 'client', id: 'c1', login_id: 'client1' };

      // In test env (not production), secure should be false
      await setSession(user);

      const setCall = mockCookieStore.set.mock.calls[0];
      expect(setCall[2].secure).toBe(false);
    });

    it('should set session for client user', async () => {
      const user: SessionUser = {
        type: 'client',
        id: 'c1',
        login_id: 'client1',
      };

      await setSession(user);

      expect(sealData).toHaveBeenCalledWith(user, expect.any(Object));
    });
  });

  describe('clearSession', () => {
    it('should delete the session cookie', async () => {
      await clearSession();
      expect(mockCookieStore.delete).toHaveBeenCalledWith('rb_session');
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin user', () => {
      const user: SessionUser = { type: 'admin', id: 'admin', login_id: 'admin-user' };
      expect(isAdmin(user)).toBe(true);
    });

    it('should return false for client user', () => {
      const user: SessionUser = { type: 'client', id: 'c1', login_id: 'client1' };
      expect(isAdmin(user)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isAdmin(null)).toBe(false);
    });
  });

  describe('hasProjectAccess', () => {
    it('should return false when user is null', () => {
      expect(hasProjectAccess(null, 'proj-1')).toBe(false);
    });

    it('should return true for admin regardless of project', () => {
      const admin: SessionUser = { type: 'admin', id: 'admin', login_id: 'admin-user' };
      expect(hasProjectAccess(admin, 'any-project-id')).toBe(true);
    });

    it('should return true when project is in assignedProjectIds', () => {
      const client: SessionUser = {
        type: 'client',
        id: 'c1',
        login_id: 'client1',
      };
      expect(hasProjectAccess(client, 'proj-3', ['proj-2', 'proj-3'])).toBe(true);
    });

    it('should return false when project is not in assignedProjectIds', () => {
      const client: SessionUser = {
        type: 'client',
        id: 'c1',
        login_id: 'client1',
      };
      expect(hasProjectAccess(client, 'proj-3', ['proj-2', 'proj-4'])).toBe(false);
    });

    it('should handle undefined assignedProjectIds', () => {
      const client: SessionUser = {
        type: 'client',
        id: 'c1',
        login_id: 'client1',
      };
      expect(hasProjectAccess(client, 'proj-2', undefined)).toBe(false);
    });

    it('should handle empty assignedProjectIds array', () => {
      const client: SessionUser = {
        type: 'client',
        id: 'c1',
        login_id: 'client1',
      };
      expect(hasProjectAccess(client, 'proj-2', [])).toBe(false);
    });
  });
});
