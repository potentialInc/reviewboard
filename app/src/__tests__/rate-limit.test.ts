import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need fresh module state per test
describe('rate-limit', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('should allow first request', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    expect(checkRateLimit('test-key')).toBe(true);
  });

  it('should allow requests up to the max attempts', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('key-max', 5, 60_000)).toBe(true);
    }
  });

  it('should block request when max attempts exceeded', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    for (let i = 0; i < 5; i++) {
      checkRateLimit('key-block', 5, 60_000);
    }
    expect(checkRateLimit('key-block', 5, 60_000)).toBe(false);
  });

  it('should track different keys independently', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    for (let i = 0; i < 5; i++) {
      checkRateLimit('key-a', 5, 60_000);
    }
    expect(checkRateLimit('key-a', 5, 60_000)).toBe(false);
    expect(checkRateLimit('key-b', 5, 60_000)).toBe(true);
  });

  it('should reset after window expires', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    for (let i = 0; i < 5; i++) {
      checkRateLimit('key-expire', 5, 1000);
    }
    expect(checkRateLimit('key-expire', 5, 1000)).toBe(false);

    // Advance time past window
    vi.spyOn(Date, 'now').mockReturnValue(now + 1001);
    expect(checkRateLimit('key-expire', 5, 1000)).toBe(true);
  });

  it('should use default maxAttempts of 5 and windowMs of 60000', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('key-defaults')).toBe(true);
    }
    expect(checkRateLimit('key-defaults')).toBe(false);
  });

  it('should allow custom maxAttempts', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit('key-custom', 3)).toBe(true);
    }
    expect(checkRateLimit('key-custom', 3)).toBe(false);
  });
});
