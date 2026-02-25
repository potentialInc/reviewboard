import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin, hasProjectAccess } from '@/lib/auth';
import { validateUUID, sanitizeText } from '@/lib/validation';
import { getOpenFeedbackCountByScreen } from '@/lib/feedback-count';

// GET /api/projects/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uuidErr = validateUUID(id);
  if (uuidErr) return uuidErr;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceSupabase();

  // Authorization: client users can only view projects they have access to
  if (!isAdmin(session)) {
    const { data: assignments } = await supabase
      .from('client_account_projects')
      .select('project_id')
      .eq('client_account_id', session.id);
    const assignedProjectIds = (assignments || []).map((a: { project_id: string }) => a.project_id);
    if (!hasProjectAccess(session, id, assignedProjectIds)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data: project, error: fetchErr } = await supabase
    .from('projects')
    .select(`
      *,
      screens(
        id, name, created_at, updated_at,
        screenshot_versions(id, version, image_url, created_at)
      )
    `)
    .eq('id', id)
    .single();

  if (fetchErr || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  interface ScreenWithVersions { id: string; name: string; screenshot_versions?: { id: string; version: number; image_url: string; created_at: string }[] }
  const typedScreens = (project.screens as ScreenWithVersions[] || []);

  // Fetch client account and open feedback counts in parallel
  const [{ data: capLinks }, openCountByScreen] = await Promise.all([
    supabase
      .from('client_account_projects')
      .select('client_accounts(login_id)')
      .eq('project_id', id)
      .limit(1),
    getOpenFeedbackCountByScreen(supabase, typedScreens),
  ]);

  const screens = typedScreens.map((screen) => {
    const sorted = [...(screen.screenshot_versions || [])].sort(
      (a, b) => b.version - a.version
    );
    return { ...screen, latest_version: sorted[0] || null, open_feedback_count: openCountByScreen[screen.id] || 0 };
  });

  const capLink = capLinks?.[0];
  const clientAcc = capLink?.client_accounts as { login_id: string } | { login_id: string }[] | null;
  const clientLoginId = Array.isArray(clientAcc) ? clientAcc[0]?.login_id : clientAcc?.login_id;
  return NextResponse.json({
    ...project,
    screens,
    client_id: clientLoginId || null,
  });
}

// PATCH /api/projects/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const patchUuidErr = validateUUID(id);
  if (patchUuidErr) return patchUuidErr;

  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name?: string; slack_channel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const supabase = await createServiceSupabase();

  // SECURITY: Sanitize inputs to prevent stored XSS
  const updates: Record<string, string> = {};
  if (body.name !== undefined) updates.name = sanitizeText(body.name, 255);
  if (body.slack_channel !== undefined) updates.slack_channel = sanitizeText(body.slack_channel, 255);

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[projects/PATCH]', error.message);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE /api/projects/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const delUuidErr = validateUUID(id);
  if (delUuidErr) return delUuidErr;

  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceSupabase();
  const { error } = await supabase.from('projects').delete().eq('id', id);

  if (error) {
    console.error('[projects/DELETE]', error.message);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
