import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server
vi.mock('next/server', () => {
  class MockNextRequest {
    public url: string;
    public method: string;
    public headers: Map<string, string>;
    private _formData: FormData | null;

    constructor(url: string, init: { method?: string; headers?: Record<string, string>; formData?: FormData } = {}) {
      this.url = url;
      this.method = init.method || 'GET';
      this.headers = new Map(Object.entries(init.headers || {}));
      this._formData = init.formData || null;
    }

    async formData() {
      if (!this._formData) throw new Error('No form data');
      return this._formData;
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({
        body,
        status: init?.status ?? 200,
        json: async () => body,
      }),
    },
  };
});

const {
  mockRequireAdminWithSupabase, mockCheckRateLimit, mockFrom, mockStorage,
} = vi.hoisted(() => ({
  mockRequireAdminWithSupabase: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockFrom: vi.fn(),
  mockStorage: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/api-helpers', () => ({
  requireAdminWithSupabase: mockRequireAdminWithSupabase,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock('@/lib/validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/validation')>('@/lib/validation');
  return actual;
});

import { POST } from '@/app/api/projects/[id]/screens/[screenId]/screenshots/route';
import { NextRequest } from 'next/server';

const validProjectId = '550e8400-e29b-41d4-a716-446655440000';
const validScreenId = '660e8400-e29b-41d4-a716-446655440001';

function makeParams(id: string, screenId: string) {
  return { params: Promise.resolve({ id, screenId }) };
}

// PNG magic bytes: 0x89 0x50 0x4E 0x47
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00, 0x00, 0x00]);
// JPEG magic bytes: 0xFF 0xD8 0xFF
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00, 0x00, 0x00]);
// WebP magic bytes: RIFF
const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
// GIF magic bytes: GIF
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x00, 0x00, 0x00, 0x00]);
// Invalid magic bytes
const INVALID_BYTES = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00]);

function createMockFile(name: string, bytes: Uint8Array, size?: number): File {
  const blob = new Blob([bytes]);
  const file = new File([blob], name, { type: 'image/png' });
  // Override size if specified
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
}

function createMockFormData(file?: File): FormData {
  const formData = new FormData();
  if (file) {
    formData.set('file', file);
  }
  return formData;
}

function setupDefaultMocks() {
  const session = { type: 'admin' as const, id: 'admin', login_id: 'admin' };
  const supabase = {
    from: mockFrom,
    storage: mockStorage,
  };
  mockRequireAdminWithSupabase.mockResolvedValue({ session, supabase });
  mockCheckRateLimit.mockReturnValue(true);
  return { session, supabase };
}

describe('POST /api/projects/[id]/screens/[screenId]/screenshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid project UUID', async () => {
    const formData = createMockFormData();
    const req = new NextRequest('http://localhost/api/projects/bad/screens/' + validScreenId + '/screenshots', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams('bad', validScreenId));
    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid screen UUID', async () => {
    const formData = createMockFormData();
    const req = new NextRequest('http://localhost/api/projects/' + validProjectId + '/screens/bad/screenshots', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, 'bad'));
    expect(response.status).toBe(400);
  });

  it('should return 401 when not admin', async () => {
    mockRequireAdminWithSupabase.mockResolvedValue({
      error: { status: 401, json: async () => ({ error: 'Unauthorized' }) },
    });

    const formData = createMockFormData();
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(401);
  });

  it('should return 429 when rate limited', async () => {
    setupDefaultMocks();
    mockCheckRateLimit.mockReturnValue(false);

    // Set up screen check to not be reached (rate limit is checked first)
    const formData = createMockFormData();
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toContain('Too many uploads');
  });

  it('should return 404 when screen not found in project', async () => {
    setupDefaultMocks();

    // Screen lookup returns null
    const mockSingle = vi.fn().mockResolvedValue({ data: null });
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    mockFrom.mockReturnValue({ select: mockSelect });

    const formData = createMockFormData();
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('Screen not found');
  });

  it('should return 400 when no file in form data', async () => {
    setupDefaultMocks();

    // Screen exists
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: validScreenId } });
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    mockFrom.mockReturnValue({ select: mockSelect });

    const formData = createMockFormData(); // No file
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('File is required');
  });

  it('should return 400 when file exceeds 10MB', async () => {
    setupDefaultMocks();

    // Screen exists
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: validScreenId } });
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    mockFrom.mockReturnValue({ select: mockSelect });

    const file = createMockFile('large.png', PNG_BYTES, 11 * 1024 * 1024);
    const formData = createMockFormData(file);
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('File too large');
  });

  it('should return 400 for invalid image file (bad magic bytes)', async () => {
    setupDefaultMocks();

    // Screen exists
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: validScreenId } });
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    mockFrom.mockReturnValue({ select: mockSelect });

    const file = createMockFile('malicious.exe', INVALID_BYTES);
    const formData = createMockFormData(file);
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid image file');
  });

  it('should upload PNG successfully and return 201', async () => {
    setupDefaultMocks();

    const versionRecord = { id: 'v1', screen_id: validScreenId, version: 1, image_url: 'https://example.com/img.png' };

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // screens.select().eq().eq().single() => screen exists
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validScreenId } }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 2) {
        // screenshot_versions.select().eq().order().limit() => get max version
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 3) {
        // screenshot_versions.insert().select().single() => create version
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: versionRecord, error: null }),
            }),
          }),
        };
      }
      if (fromCallCount === 4) {
        // screens.update().eq() => update screen's updated_at
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({}),
          }),
        };
      }
      return {};
    });

    // Mock storage upload and getPublicUrl
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/img.png' } });
    mockStorage.from.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });

    const file = createMockFile('screenshot.png', PNG_BYTES);
    const formData = createMockFormData(file);
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.version).toBe(1);
    expect(body.image_url).toBe('https://example.com/img.png');
  });

  it('should upload JPEG successfully', async () => {
    setupDefaultMocks();

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validScreenId } }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [{ version: 3 }] }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 3) {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'v4', screen_id: validScreenId, version: 4, image_url: 'https://example.com/img.jpg' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 4) {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({}),
          }),
        };
      }
      return {};
    });

    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/img.jpg' } });
    mockStorage.from.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });

    const file = createMockFile('photo.jpg', JPEG_BYTES);
    const formData = createMockFormData(file);
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.version).toBe(4);
  });

  it('should return 500 when storage upload fails', async () => {
    setupDefaultMocks();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validScreenId } }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: { message: 'Storage error' } }),
    });

    const file = createMockFile('screenshot.png', PNG_BYTES);
    const formData = createMockFormData(file);
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('should return 500 when version insert fails', async () => {
    setupDefaultMocks();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validScreenId } }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 3) {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert error' } }),
            }),
          }),
        };
      }
      return {};
    });

    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/img.png' } }),
    });

    const file = createMockFile('screenshot.png', PNG_BYTES);
    const formData = createMockFormData(file);
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('should accept WebP files', async () => {
    setupDefaultMocks();

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validScreenId } }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 3) {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'v1', screen_id: validScreenId, version: 1, image_url: 'https://example.com/img.webp' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 4) {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({}),
          }),
        };
      }
      return {};
    });

    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/img.webp' } }),
    });

    const file = createMockFile('image.webp', WEBP_BYTES);
    const formData = createMockFormData(file);
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(201);
  });

  it('should accept GIF files', async () => {
    setupDefaultMocks();

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validScreenId } }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 3) {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'v1', screen_id: validScreenId, version: 1, image_url: 'https://example.com/img.gif' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 4) {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({}),
          }),
        };
      }
      return {};
    });

    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/img.gif' } }),
    });

    const file = createMockFile('animation.gif', GIF_BYTES);
    const formData = createMockFormData(file);
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(201);
  });

  it('should increment version number based on existing versions', async () => {
    setupDefaultMocks();

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: validScreenId } }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 2) {
        // Existing versions with max version = 5
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [{ version: 5 }] }),
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 3) {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'v6', screen_id: validScreenId, version: 6, image_url: 'https://example.com/v6.png' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (fromCallCount === 4) {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({}),
          }),
        };
      }
      return {};
    });

    mockStorage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/v6.png' } }),
    });

    const file = createMockFile('screenshot.png', PNG_BYTES);
    const formData = createMockFormData(file);
    const req = new NextRequest('http://localhost/test', {
      method: 'POST',
      formData,
    } as never);
    const response = await POST(req, makeParams(validProjectId, validScreenId));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.version).toBe(6);
  });
});
