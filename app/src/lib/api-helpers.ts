import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { createServiceSupabase } from '@/lib/supabase/server';
import type { SessionUser } from '@/lib/types';

type SupabaseClient = Awaited<ReturnType<typeof createServiceSupabase>>;

/**
 * Require an authenticated session. Returns 401 if not logged in.
 */
export async function requireAuth(): Promise<
  | { session: SessionUser; error?: never }
  | { session?: never; error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session };
}

/**
 * Require an authenticated admin session. Returns 401 if not logged in or not admin.
 * Note: returns 401 (not 403) for non-admin to match existing API behavior.
 */
export async function requireAdmin(): Promise<
  | { session: SessionUser; error?: never }
  | { session?: never; error: NextResponse }
> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session };
}

/**
 * Require admin and create a Supabase service client in one call.
 */
export async function requireAdminWithSupabase(): Promise<
  | { session: SessionUser; supabase: SupabaseClient; error?: never }
  | { session?: never; supabase?: never; error: NextResponse }
> {
  const result = await requireAdmin();
  if (result.error) return result;
  const supabase = await createServiceSupabase();
  return { session: result.session, supabase };
}

/**
 * Require auth and create a Supabase service client in one call.
 */
export async function requireAuthWithSupabase(): Promise<
  | { session: SessionUser; supabase: SupabaseClient; error?: never }
  | { session?: never; supabase?: never; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;
  const supabase = await createServiceSupabase();
  return { session: result.session, supabase };
}

/**
 * Parse JSON body safely, returning 400 on invalid JSON.
 */
export async function parseJsonBody<T>(request: Request): Promise<
  | { body: T; error?: never }
  | { body?: never; error: NextResponse }
> {
  try {
    const body = await request.json();
    return { body: body as T };
  } catch {
    return { error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) };
  }
}
