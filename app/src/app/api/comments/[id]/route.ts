import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin } from '@/lib/auth';
import type { FeedbackStatus } from '@/lib/types';

// PATCH /api/comments/[id] — update status or text
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
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
  if (body.status && isAdmin(session)) updates.status = body.status;
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  if (body.status && current.status !== body.status) {
    await supabase.from('audit_log').insert({
      entity_type: 'comment',
      entity_id: id,
      action: 'status_change',
      old_value: current.status,
      new_value: body.status,
      actor: session.login_id,
    });
  }
  if (body.text !== undefined && current.text !== body.text) {
    await supabase.from('audit_log').insert({
      entity_type: 'comment',
      entity_id: id,
      action: 'edit',
      old_value: current.text,
      new_value: body.text,
      actor: session.login_id,
    });
  }

  return NextResponse.json(data);
}

// DELETE /api/comments/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  if (current) {
    await supabase.from('audit_log').insert({
      entity_type: 'comment',
      entity_id: id,
      action: 'delete',
      old_value: current.text,
      new_value: null,
      actor: session.login_id,
    });
  }

  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
