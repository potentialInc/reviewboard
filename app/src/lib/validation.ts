import { NextResponse } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function validateUUID(id: string, label = 'ID') {
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: `Invalid ${label} format` }, { status: 400 });
  }
  return null;
}

/**
 * Validate an array of UUIDs (for bulk operations).
 * Returns an error response if any ID is invalid, otherwise null.
 */
export function validateUUIDs(ids: string[], label = 'ID') {
  for (const id of ids) {
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: `Invalid ${label} format: ${id}` }, { status: 400 });
    }
  }
  return null;
}

export function validateCoordinates(x: unknown, y: unknown) {
  const nx = Number(x);
  const ny = Number(y);
  if (isNaN(nx) || isNaN(ny) || nx < 0 || nx > 100 || ny < 0 || ny > 100) {
    return NextResponse.json(
      { error: 'Coordinates must be numbers between 0 and 100' },
      { status: 400 }
    );
  }
  return null;
}

/**
 * Validate and sanitize text input (comments, replies, project names, etc.).
 * SECURITY: Prevents XSS by stripping HTML tags and enforces length limits
 * consistent with DB constraints (text columns are capped at 5000 chars).
 */
export function sanitizeText(input: string, maxLength = 5000): string {
  // Strip HTML tags to prevent stored XSS
  const stripped = input.replace(/<[^>]*>/g, '');
  // Normalize whitespace (collapse multiple spaces/newlines but keep single newlines)
  const normalized = stripped.replace(/[^\S\n]+/g, ' ').trim();
  // Enforce max length
  return normalized.slice(0, maxLength);
}

/**
 * Validate text length and return an error response if it exceeds the limit.
 */
export function validateTextLength(
  text: string,
  maxLength = 5000,
  label = 'Text'
) {
  if (text.length > maxLength) {
    return NextResponse.json(
      { error: `${label} must not exceed ${maxLength} characters` },
      { status: 400 }
    );
  }
  return null;
}

/**
 * Validate a feedback status value.
 */
const VALID_STATUSES = ['open', 'in-progress', 'resolved'];
export function validateStatus(status: string) {
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }
  return null;
}

/**
 * Sanitize a filename to prevent path traversal attacks.
 * SECURITY: Strips directory components and special characters, keeping only
 * the base filename with safe characters.
 */
export function sanitizeFilename(filename: string): string {
  // Remove directory traversal components
  const base = filename.replace(/^.*[\\/]/, '');
  // Keep only alphanumeric, dash, underscore, dot
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}
