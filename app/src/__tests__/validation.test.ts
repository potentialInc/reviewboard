import { describe, it, expect, vi } from 'vitest';

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

import {
  isValidUUID, validateUUID, validateUUIDs,
  validateCoordinates, sanitizeText, validateTextLength,
  validateStatus, sanitizeFilename,
} from '@/lib/validation';

describe('validation', () => {
  describe('isValidUUID', () => {
    it('should return true for valid lowercase UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should return true for valid uppercase UUID', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should return true for valid mixed case UUID', () => {
      expect(isValidUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidUUID('')).toBe(false);
    });

    it('should return false for non-UUID string', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('should return false for UUID without dashes', () => {
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    });

    it('should return false for UUID with extra characters', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000x')).toBe(false);
    });

    it('should return false for partial UUID', () => {
      expect(isValidUUID('550e8400-e29b')).toBe(false);
    });

    it('should return false for UUID with invalid hex chars', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
    });
  });

  describe('validateUUID', () => {
    it('should return null for valid UUID', () => {
      const result = validateUUID('550e8400-e29b-41d4-a716-446655440000');
      expect(result).toBeNull();
    });

    it('should return 400 response for invalid UUID', async () => {
      const result = validateUUID('not-valid');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
      const body = await result!.json();
      expect(body.error).toContain('Invalid');
      expect(body.error).toContain('ID');
    });

    it('should use custom label in error message', async () => {
      const result = validateUUID('bad', 'Project ID');
      expect(result).not.toBeNull();
      const body = await result!.json();
      expect(body.error).toContain('Project ID');
    });

    it('should use default label "ID"', async () => {
      const result = validateUUID('bad');
      const body = await result!.json();
      expect(body.error).toBe('Invalid ID format');
    });
  });

  describe('validateUUIDs', () => {
    it('should return null when all UUIDs are valid', () => {
      const result = validateUUIDs([
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001',
      ]);
      expect(result).toBeNull();
    });

    it('should return 400 when any UUID is invalid', async () => {
      const result = validateUUIDs(['550e8400-e29b-41d4-a716-446655440000', 'bad-id']);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
      const body = await result!.json();
      expect(body.error).toContain('bad-id');
    });

    it('should return null for empty array', () => {
      expect(validateUUIDs([])).toBeNull();
    });

    it('should use custom label', async () => {
      const result = validateUUIDs(['bad'], 'Project');
      const body = await result!.json();
      expect(body.error).toContain('Project');
    });
  });

  describe('validateCoordinates', () => {
    it('should return null for valid coordinates', () => {
      expect(validateCoordinates(50, 50)).toBeNull();
    });

    it('should return null for zero coordinates', () => {
      expect(validateCoordinates(0, 0)).toBeNull();
    });

    it('should return null for boundary value 100', () => {
      expect(validateCoordinates(100, 100)).toBeNull();
    });

    it('should return null for string number coordinates', () => {
      expect(validateCoordinates('50', '50')).toBeNull();
    });

    it('should return 400 for x below 0', async () => {
      const result = validateCoordinates(-1, 50);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
      const body = await result!.json();
      expect(body.error).toContain('Coordinates');
    });

    it('should return 400 for x above 100', () => {
      const result = validateCoordinates(101, 50);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
    });

    it('should return 400 for y below 0', () => {
      const result = validateCoordinates(50, -1);
      expect(result).not.toBeNull();
    });

    it('should return 400 for y above 100', () => {
      const result = validateCoordinates(50, 101);
      expect(result).not.toBeNull();
    });

    it('should return 400 for NaN values', () => {
      const result = validateCoordinates('abc', 50);
      expect(result).not.toBeNull();
    });

    it('should return 400 for undefined values', () => {
      const result = validateCoordinates(undefined, undefined);
      expect(result).not.toBeNull();
    });

    it('should accept decimal coordinates within range', () => {
      expect(validateCoordinates(33.5, 66.7)).toBeNull();
    });
  });

  describe('sanitizeText', () => {
    it('should strip HTML tags', () => {
      expect(sanitizeText('<b>Hello</b>')).toBe('Hello');
    });

    it('should strip script tags but keep inner text', () => {
      // The regex strips tags but keeps text between them
      expect(sanitizeText('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
    });

    it('should strip nested HTML tags', () => {
      expect(sanitizeText('<b><i>bold italic</i></b>')).toBe('bold italic');
    });

    it('should normalize whitespace', () => {
      expect(sanitizeText('hello   world')).toBe('hello world');
    });

    it('should trim leading/trailing whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
    });

    it('should preserve single newlines', () => {
      expect(sanitizeText('line1\nline2')).toBe('line1\nline2');
    });

    it('should enforce max length', () => {
      const long = 'a'.repeat(6000);
      expect(sanitizeText(long).length).toBe(5000);
    });

    it('should use custom max length', () => {
      const long = 'a'.repeat(200);
      expect(sanitizeText(long, 100).length).toBe(100);
    });

    it('should return empty string for HTML-only input', () => {
      expect(sanitizeText('<div></div>')).toBe('');
    });

    it('should handle plain text without modification', () => {
      expect(sanitizeText('Simple text')).toBe('Simple text');
    });
  });

  describe('validateTextLength', () => {
    it('should return null when text is within limit', () => {
      expect(validateTextLength('short text')).toBeNull();
    });

    it('should return 400 when text exceeds limit', async () => {
      const result = validateTextLength('a'.repeat(5001));
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
      const body = await result!.json();
      expect(body.error).toContain('5000');
    });

    it('should use custom max length', async () => {
      const result = validateTextLength('a'.repeat(101), 100);
      expect(result).not.toBeNull();
      const body = await result!.json();
      expect(body.error).toContain('100');
    });

    it('should use custom label', async () => {
      const result = validateTextLength('a'.repeat(5001), 5000, 'Comment');
      const body = await result!.json();
      expect(body.error).toContain('Comment');
    });

    it('should return null at exact limit', () => {
      expect(validateTextLength('a'.repeat(5000))).toBeNull();
    });
  });

  describe('validateStatus', () => {
    it('should return null for "open"', () => {
      expect(validateStatus('open')).toBeNull();
    });

    it('should return null for "in-progress"', () => {
      expect(validateStatus('in-progress')).toBeNull();
    });

    it('should return null for "resolved"', () => {
      expect(validateStatus('resolved')).toBeNull();
    });

    it('should return 400 for invalid status', async () => {
      const result = validateStatus('invalid');
      expect(result).not.toBeNull();
      expect(result!.status).toBe(400);
      const body = await result!.json();
      expect(body.error).toContain('Invalid status');
    });

    it('should return 400 for empty string', () => {
      const result = validateStatus('');
      expect(result).not.toBeNull();
    });
  });

  describe('sanitizeFilename', () => {
    it('should keep safe filenames unchanged', () => {
      expect(sanitizeFilename('screenshot.png')).toBe('screenshot.png');
    });

    it('should strip directory traversal', () => {
      expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    });

    it('should strip Windows-style paths', () => {
      expect(sanitizeFilename('C:\\Users\\test\\file.txt')).toBe('file.txt');
    });

    it('should replace special characters with underscores', () => {
      expect(sanitizeFilename('file name (1).png')).toBe('file_name__1_.png');
    });

    it('should keep alphanumeric, dash, underscore, dot', () => {
      expect(sanitizeFilename('my-file_v2.png')).toBe('my-file_v2.png');
    });

    it('should handle empty string', () => {
      expect(sanitizeFilename('')).toBe('');
    });
  });
});
