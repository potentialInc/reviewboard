import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

// POST /api/comments/[id]/replies — add reply
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text } = await request.json();
  if (!text) {
    return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
  }

  const supabase = await createServiceSupabase();

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
