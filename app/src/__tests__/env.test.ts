import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test validateEnv fresh each time, so we use dynamic imports
// and reset the module between tests.

describe('validateEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Reset process.env to a clean state for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should pass when all required env vars are set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    const { validateEnv } = await import('@/lib/env');

    // Should not throw
    expect(() => validateEnv()).not.toThrow();
  });

  it('should skip validation during build phase', async () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    // Intentionally leave required vars unset
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { validateEnv } = await import('@/lib/env');

    // Should not throw or log errors during build
    expect(() => validateEnv()).not.toThrow();
  });

  it('should throw in production when env vars are missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PHASE;

    const { validateEnv } = await import('@/lib/env');

    expect(() => validateEnv()).toThrow('Missing required environment variables');
  });

  it('should log error in development when env vars are missing', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PHASE;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { validateEnv } = await import('@/lib/env');
    validateEnv();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const errorMessage = consoleSpy.mock.calls[0][0] as string;
    expect(errorMessage).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(errorMessage).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(errorMessage).toContain('SUPABASE_SERVICE_ROLE_KEY');

    consoleSpy.mockRestore();
  });

  it('should only report missing vars, not present ones', async () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PHASE;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { validateEnv } = await import('@/lib/env');
    validateEnv();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const errorMessage = consoleSpy.mock.calls[0][0] as string;
    expect(errorMessage).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(errorMessage).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(errorMessage).toContain('SUPABASE_SERVICE_ROLE_KEY');

    consoleSpy.mockRestore();
  });

  it('should only validate once due to internal guard', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PHASE;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { validateEnv } = await import('@/lib/env');
    validateEnv();
    validateEnv(); // second call should be a no-op

    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('should include helpful message about .env.local', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PHASE;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { validateEnv } = await import('@/lib/env');
    validateEnv();

    const errorMessage = consoleSpy.mock.calls[0][0] as string;
    expect(errorMessage).toContain('.env.local');

    consoleSpy.mockRestore();
  });
});
