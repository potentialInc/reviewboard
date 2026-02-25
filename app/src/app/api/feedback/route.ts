import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin } from '@/lib/auth';

// GET /api/feedback — list all feedback (admin)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const projectId = url.searchParams.get('project_id');
  const screenId = url.searchParams.get('screen_id');
  const search = url.searchParams.get('search');
  const page = parseInt(url.searchParams.get('page') || '1');
  const perPage = parseInt(url.searchParams.get('per_page') || '25');

  const supabase = await createServiceSupabase();

  // Build query via a join approach
  let query = supabase
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
      replies(id)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.ilike('text', `%${search}%`);
  }

  const { data: comments, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by project_id / screen_id in JS since they are nested relations
  let filtered = comments || [];
  if (projectId) {
    filtered = filtered.filter((c) => {
      const sv = c.screenshot_version as { screen?: { project?: { id: string } } };
      return sv?.screen?.project?.id === projectId;
    });
  }
  if (screenId) {
    filtered = filtered.filter((c) => {
      const sv = c.screenshot_version as { screen?: { id: string } };
      return sv?.screen?.id === screenId;
    });
  }

  const enriched = filtered.map((c) => {
    const sv = c.screenshot_version as {
      screen?: { name: string; project?: { name: string } };
    };
    return {
      ...c,
      screen_name: sv?.screen?.name || '',
      project_name: sv?.screen?.project?.name || '',
      reply_count: (c.replies as { id: string }[])?.length || 0,
    };
  });

  return NextResponse.json({ data: enriched, total: count || 0, page, per_page: perPage });
}
