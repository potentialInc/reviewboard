import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin } from '@/lib/auth';

// GET /api/feedback/[id] — single feedback detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceSupabase();

  const { data } = await supabase
    .from('comments')
    .select(`
      *,
      screenshot_version:screenshot_versions(
        id, version, image_url,
        screen:screens(
          id, name,
          project:projects(id, name)
        )
      ),
      replies(id, text, author_type, created_at)
    `)
    .eq('id', id)
    .single();

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(data);
}
