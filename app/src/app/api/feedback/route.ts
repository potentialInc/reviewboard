import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithSupabase } from '@/lib/api-helpers';

// GET /api/feedback — list all feedback (admin)
export async function GET(request: NextRequest) {
  const auth = await requireAdminWithSupabase();
  if (auth.error) return auth.error;
  const { supabase } = auth;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const projectId = url.searchParams.get('project_id');
  const screenId = url.searchParams.get('screen_id');
  const search = url.searchParams.get('search');
  const page = parseInt(url.searchParams.get('page') || '1');
  const perPage = parseInt(url.searchParams.get('per_page') || '25');

  // Use !inner joins to enable server-side filtering by project/screen
  // When filtering, we need inner joins; otherwise use regular joins
  const svJoin = screenId || projectId ? '!inner' : '';
  const screenJoin = projectId ? '!inner' : '';

  let query = supabase
    .from('comments')
    .select(`
      *,
      screenshot_version:screenshot_versions${svJoin}(
        id, version, image_url,
        screen:screens${screenJoin}(
          id, name,
          project:projects(id, name)
        )
      ),
      replies(id)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
    query = query.ilike('text', `%${escaped}%`);
  }

  // Server-side filtering through nested relations
  if (screenId) {
    query = query.eq('screenshot_version.screen_id', screenId);
  }
  if (projectId) {
    query = query.eq('screenshot_version.screen.project_id', projectId);
  }

  // Apply pagination after filters so count is accurate
  query = query.range((page - 1) * perPage, page * perPage - 1);

  const { data: comments, count, error } = await query;

  if (error) {
    console.error('[feedback/GET]', error.message);
    return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });
  }

  const enriched = (comments || []).map((c) => {
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

  const res = NextResponse.json({ data: enriched, total: count || 0, page, per_page: perPage });
  // Short cache for paginated feedback lists — stale-while-revalidate for seamless UX
  res.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');
  return res;
}
