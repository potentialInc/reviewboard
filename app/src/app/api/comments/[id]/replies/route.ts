import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithSupabase, parseJsonBody } from '@/lib/api-helpers';
import { isAdmin, hasProjectAccess } from '@/lib/auth';
import { validateUUID, sanitizeText, validateTextLength } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

// POST /api/comments/[id]/replies — add reply
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params;
  const uuidErr = validateUUID(commentId, 'Comment ID');
  if (uuidErr) return uuidErr;

  const auth = await requireAuthWithSupabase();
  if (auth.error) return auth.error;
  const { session, supabase } = auth;

  // SECURITY: Rate limit reply creation to prevent spam (15 per minute per user)
  if (!checkRateLimit(`reply:${session.id}`, 15, 60_000)) {
    return NextResponse.json(
      { error: 'Too many replies. Please wait a moment.' },
      { status: 429 }
    );
  }

  const parsed = await parseJsonBody<{ text?: string }>(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;
  let { text } = body;
  if (!text) {
    return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
  }

  // SECURITY: Sanitize text to prevent stored XSS and enforce length
  text = sanitizeText(text);
  const textErr = validateTextLength(text, 5000, 'Reply text');
  if (textErr) return textErr;
  if (!text) {
    return NextResponse.json({ error: 'Reply text cannot be empty after sanitization' }, { status: 400 });
  }

  // SECURITY: Verify client user has access to the project this comment belongs to.
  // Without this check, a client could reply to any comment they know the UUID of.
  if (!isAdmin(session)) {
    const { data: comment } = await supabase
      .from('comments')
      .select('screenshot_version:screenshot_versions(screen:screens(project_id))')
      .eq('id', commentId)
      .single();

    const sv = comment?.screenshot_version as { screen?: { project_id: string } | { project_id: string }[] } | null;
    const screenRow = sv?.screen
      ? (Array.isArray(sv.screen) ? sv.screen[0] : sv.screen)
      : null;
    const projectId = screenRow?.project_id;

    if (!projectId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const { data: assignments } = await supabase
      .from('client_account_projects')
      .select('project_id')
      .eq('client_account_id', session.id);
    const assignedProjectIds = (assignments || []).map((a: { project_id: string }) => a.project_id);

    if (!hasProjectAccess(session, projectId, assignedProjectIds)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from('replies')
    .insert({
      comment_id: commentId,
      text,
      author_type: session.type,
      author_id: session.login_id,
    })
    .select()
    .single();

  if (error) {
    console.error('[replies/POST]', error.message);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
