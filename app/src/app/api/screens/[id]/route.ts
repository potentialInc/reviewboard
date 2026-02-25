import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithSupabase, requireAdminWithSupabase } from '@/lib/api-helpers';
import { isAdmin, hasProjectAccess } from '@/lib/auth';
import { validateUUID } from '@/lib/validation';

// GET /api/screens/[id] — get screen with versions and comments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uuidErr = validateUUID(id);
  if (uuidErr) return uuidErr;

  const auth = await requireAuthWithSupabase();
  if (auth.error) return auth.error;
  const { session, supabase } = auth;

  const { data: screen } = await supabase
    .from('screens')
    .select(`
      *,
      project:projects(id, name, slack_channel),
      screenshot_versions(
        id, version, image_url, created_at,
        comments(
          id, pin_number, x, y, text, author_id, status, created_at, updated_at,
          replies(id, text, author_type, created_at)
        )
      )
    `)
    .eq('id', id)
    .single();

  if (!screen) return NextResponse.json({ error: 'Screen not found' }, { status: 404 });

  // Authorization: client users can only view screens belonging to their projects
  if (!isAdmin(session)) {
    const projectData = Array.isArray(screen.project) ? screen.project[0] : screen.project;
    const projectId = projectData?.id;
    // FIX: deny access when projectId is missing instead of silently granting it
    if (!projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  // Sort versions descending, comments by pin_number
  const versions = (screen.screenshot_versions || [])
    .sort((a: { version: number }, b: { version: number }) => b.version - a.version)
    .map((v: { comments?: { pin_number: number; replies?: { created_at: string }[] }[] }) => ({
      ...v,
      comments: (v.comments || [])
        .sort((a: { pin_number: number }, b: { pin_number: number }) => a.pin_number - b.pin_number)
        .map((c: { replies?: { created_at: string }[] }) => ({
          ...c,
          replies: (c.replies || []).sort(
            (a: { created_at: string }, b: { created_at: string }) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
        })),
    }));

  return NextResponse.json({
    ...screen,
    screenshot_versions: versions,
    latest_version: versions[0] || null,
  });
}

// DELETE /api/screens/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uuidErr = validateUUID(id);
  if (uuidErr) return uuidErr;

  const auth = await requireAdminWithSupabase();
  if (auth.error) return auth.error;

  const { error } = await auth.supabase.from('screens').delete().eq('id', id);
  if (error) {
    console.error('[screens/DELETE]', error.message);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
