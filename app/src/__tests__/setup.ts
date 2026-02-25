import { vi } from 'vitest';

// Set required environment variables for tests
process.env.SESSION_SECRET = 'test-session-secret-must-be-at-least-32-chars-long';
process.env.ADMIN_ID = 'admin';
process.env.ADMIN_PASSWORD = 'admin-secret';

// Mock next/headers globally since it's not available outside Next.js runtime
vi.mock('next/headers', () => {
  const mockCookieStore = {
    get: vi.fn(),
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
  };
  return {
    cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
  };
});
