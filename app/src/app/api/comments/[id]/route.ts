import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin } from '@/lib/auth';
import { validateUUID, sanitizeText, validateTextLength } from '@/lib/validation';
import type { FeedbackStatus } from '@/lib/types';

// PATCH /api/comments/[id] — update status or text
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uuidErr = validateUUID(id);
  if (uuidErr) return uuidErr;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { status?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // SECURITY: Validate status value
  const validStatuses: FeedbackStatus[] = ['open', 'in-progress', 'resolved'];
  if (body.status && !validStatuses.includes(body.status as FeedbackStatus)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
  }

  // SECURITY: Status changes are admin-only
  if (body.status && !isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden: only admins can change status' }, { status: 403 });
  }

  // SECURITY: Sanitize text to prevent stored XSS
  if (body.text !== undefined) {
    body.text = sanitizeText(body.text);
    const textErr = validateTextLength(body.text, 5000, 'Comment text');
    if (textErr) return textErr;
  }

  const supabase = await createServiceSupabase();

  // Get current comment for audit log
  const { data: current } = await supabase
    .from('comments')
    .select('*')
    .eq('id', id)
    .single();

  if (!current) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

  // Authorization: text edits require author or admin
  if (body.text !== undefined && !isAdmin(session) && current.author_id !== session.login_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updates: Record<string, string | FeedbackStatus> = {};
  if (body.status && isAdmin(session)) updates.status = body.status as FeedbackStatus;
  if (body.text !== undefined) updates.text = body.text;

  // Early return if nothing to update
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(current);
  }

  const { data, error } = await supabase
    .from('comments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[comments/PATCH]', error.message);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }

  // Audit log — fire-and-forget to avoid blocking the response
  const auditInserts = [];
  if (body.status && current.status !== body.status) {
    auditInserts.push(supabase.from('audit_log').insert({
      entity_type: 'comment',
      entity_id: id,
      action: 'status_change',
      old_value: current.status,
      new_value: body.status,
      actor: session.login_id,
    }));
  }
  if (body.text !== undefined && current.text !== body.text) {
    auditInserts.push(supabase.from('audit_log').insert({
      entity_type: 'comment',
      entity_id: id,
      action: 'edit',
      old_value: current.text,
      new_value: body.text,
      actor: session.login_id,
    }));
  }
  if (auditInserts.length > 0) {
    Promise.all(auditInserts).catch((err) =>
      console.error('[comments/PATCH audit]', err)
    );
  }

  return NextResponse.json(data);
}

// DELETE /api/comments/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uuidErr = validateUUID(id);
  if (uuidErr) return uuidErr;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceSupabase();

  // Fetch current comment for authorization and audit log
  const { data: current } = await supabase
    .from('comments')
    .select('text, author_id')
    .eq('id', id)
    .single();

  if (!current) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  // Authorization: only the comment author or admin can delete
  if (!isAdmin(session) && current.author_id !== session.login_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Run audit log insert and comment delete in parallel
  const [, { error }] = await Promise.all([
    supabase.from('audit_log').insert({
      entity_type: 'comment',
      entity_id: id,
      action: 'delete',
      old_value: current.text,
      new_value: null,
      actor: session.login_id,
    }),
    supabase.from('comments').delete().eq('id', id),
  ]);

  if (error) {
    console.error('[comments/DELETE]', error.message);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
