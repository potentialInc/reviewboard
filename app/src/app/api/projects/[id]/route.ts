import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin, hasProjectAccess } from '@/lib/auth';

// GET /api/projects/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Fetch client account separately (avoids ambiguous FK with client_account_projects)
  const { data: clientAccounts } = await supabase
    .from('client_accounts')
    .select('login_id, password')
    .eq('project_id', id)
    .limit(1);

  // Batch: collect all screenshot_version IDs across all screens
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSvIds = (project.screens || []).flatMap((s: any) =>
    (s.screenshot_versions || []).map((sv: { id: string }) => sv.id)
  );

  // Batch: count open comments per screenshot_version in one query
  const openCountBySv: Record<string, number> = {};
  if (allSvIds.length > 0) {
    const { data: openComments } = await supabase
      .from('comments')
      .select('screenshot_version_id')
      .eq('status', 'open')
      .in('screenshot_version_id', allSvIds);
    for (const c of openComments || []) {
      openCountBySv[c.screenshot_version_id] = (openCountBySv[c.screenshot_version_id] || 0) + 1;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const screens = (project.screens || []).map((screen: any) => {
    const svIds = (screen.screenshot_versions || []).map((sv: { id: string }) => sv.id);
    const openCount = svIds.reduce((sum: number, svId: string) => sum + (openCountBySv[svId] || 0), 0);
    const sorted = [...(screen.screenshot_versions || [])].sort(
      (a: { version: number }, b: { version: number }) => b.version - a.version
    );
    return { ...screen, latest_version: sorted[0] || null, open_feedback_count: openCount };
  });

  const clientAcc = clientAccounts?.[0] || null;
  return NextResponse.json({
    ...project,
    screens,
    client_id: clientAcc?.login_id || null,
    client_password: clientAcc?.password || 'Potential',
  });
}

// PATCH /api/projects/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const supabase = await createServiceSupabase();

  const updates: Record<string, string> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.slack_channel !== undefined) updates.slack_channel = body.slack_channel;

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/projects/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceSupabase();
  const { error } = await supabase.from('projects').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
