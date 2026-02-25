import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin } from '@/lib/auth';

// GET /api/projects — list all projects (admin) or assigned projects (client)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServiceSupabase();

  if (isAdmin(session)) {
    const { data: projects, error: listErr } = await supabase
      .from('projects')
      .select(`
        *,
        screens(id)
      `)
      .order('created_at', { ascending: false });

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    // Fetch client accounts separately (avoids ambiguous FK with client_account_projects)
    const projectIds = (projects || []).map((p) => p.id);
    const { data: clientAccounts } = projectIds.length > 0
      ? await supabase
          .from('client_accounts')
          .select('project_id, login_id')
          .in('project_id', projectIds)
      : { data: [] };

    // Batch: collect all screen IDs across all projects
    const allScreenIds = (projects || []).flatMap(
      (p) => (p.screens || []).map((s: { id: string }) => s.id)
    );

    // Batch: get screenshot_version → screen mapping in one query
    const svToScreen: Record<string, string> = {};
    if (allScreenIds.length > 0) {
      const { data: svData } = await supabase
        .from('screenshot_versions')
        .select('id, screen_id')
        .in('screen_id', allScreenIds);
      for (const sv of svData || []) {
        svToScreen[sv.id] = sv.screen_id;
      }
    }

    // Batch: count open comments in one query
    const openCountByScreen: Record<string, number> = {};
    const allSvIds = Object.keys(svToScreen);
    if (allSvIds.length > 0) {
      const { data: openComments } = await supabase
        .from('comments')
        .select('screenshot_version_id')
        .eq('status', 'open')
        .in('screenshot_version_id', allSvIds);
      for (const c of openComments || []) {
        const screenId = svToScreen[c.screenshot_version_id];
        openCountByScreen[screenId] = (openCountByScreen[screenId] || 0) + 1;
      }
    }

    // Build screen → project mapping for aggregation
    const screenToProject: Record<string, string> = {};
    for (const p of projects || []) {
      for (const s of p.screens || []) {
        screenToProject[(s as { id: string }).id] = p.id;
      }
    }

    // Aggregate open feedback per project
    const openCountByProject: Record<string, number> = {};
    for (const [screenId, count] of Object.entries(openCountByScreen)) {
      const pid = screenToProject[screenId];
      if (pid) openCountByProject[pid] = (openCountByProject[pid] || 0) + count;
    }

    const enriched = (projects || []).map((p) => {
      const clientAcc = (clientAccounts || []).find(
        (c: { project_id: string }) => c.project_id === p.id
      );
      return {
        ...p,
        client_id: clientAcc?.login_id || null,
        screen_count: p.screens?.length || 0,
        open_feedback_count: openCountByProject[p.id] || 0,
      };
    });

    return NextResponse.json(enriched);
  }

  // Client: get assigned projects
  const { data: links } = await supabase
    .from('client_account_projects')
    .select('project_id')
    .eq('client_account_id', session.id);

  const projectIds = links?.map((l) => l.project_id) || [];
  if (session.project_id && !projectIds.includes(session.project_id)) {
    projectIds.push(session.project_id);
  }

  if (projectIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*, screens(id)')
    .in('id', projectIds)
    .order('updated_at', { ascending: false });

  // Batch: collect all screen IDs
  const allScreenIds = (projects || []).flatMap(
    (p) => (p.screens || []).map((s: { id: string }) => s.id)
  );

  const svToScreen: Record<string, string> = {};
  if (allScreenIds.length > 0) {
    const { data: svData } = await supabase
      .from('screenshot_versions')
      .select('id, screen_id')
      .in('screen_id', allScreenIds);
    for (const sv of svData || []) {
      svToScreen[sv.id] = sv.screen_id;
    }
  }

  const openCountByScreen: Record<string, number> = {};
  const allSvIds = Object.keys(svToScreen);
  if (allSvIds.length > 0) {
    const { data: openComments } = await supabase
      .from('comments')
      .select('screenshot_version_id')
      .eq('status', 'open')
      .in('screenshot_version_id', allSvIds);
    for (const c of openComments || []) {
      const screenId = svToScreen[c.screenshot_version_id];
      openCountByScreen[screenId] = (openCountByScreen[screenId] || 0) + 1;
    }
  }

  const screenToProject: Record<string, string> = {};
  for (const p of projects || []) {
    for (const s of p.screens || []) {
      screenToProject[(s as { id: string }).id] = p.id;
    }
  }

  const openCountByProject: Record<string, number> = {};
  for (const [screenId, count] of Object.entries(openCountByScreen)) {
    const pid = screenToProject[screenId];
    if (pid) openCountByProject[pid] = (openCountByProject[pid] || 0) + count;
  }

  const enriched = (projects || []).map((p) => ({
    ...p,
    screen_count: p.screens?.length || 0,
    open_feedback_count: openCountByProject[p.id] || 0,
  }));

  return NextResponse.json(enriched);
}

// POST /api/projects — create project (admin only)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, slack_channel } = await request.json();
  if (!name) {
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
  }

  const supabase = await createServiceSupabase();

  // Create project
  const { data: project, error } = await supabase
    .from('projects')
    .insert({ name, slack_channel: slack_channel || null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-provision client account
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const loginId = `${name.replace(/\s+/g, '')}${randomNum}`;

  const { data: account } = await supabase
    .from('client_accounts')
    .insert({
      project_id: project.id,
      login_id: loginId,
      password: 'Potential',
    })
    .select()
    .single();

  // Link account to project
  if (account) {
    await supabase.from('client_account_projects').insert({
      client_account_id: account.id,
      project_id: project.id,
    });
  }

  return NextResponse.json({
    project,
    client_account: {
      login_id: loginId,
      password: 'Potential',
    },
  }, { status: 201 });
}
