import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin } from '@/lib/auth';
import { getOpenFeedbackCountByProject } from '@/lib/feedback-count';
import { sanitizeText } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

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
      console.error('[projects/GET]', listErr.message);
      return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
    }

    // Fetch client accounts and open feedback counts in parallel
    const projectIds = (projects || []).map((p) => p.id);
    const [{ data: capLinks }, openCountByProject] = await Promise.all([
      projectIds.length > 0
        ? supabase
            .from('client_account_projects')
            .select('project_id, client_accounts(login_id)')
            .in('project_id', projectIds)
        : Promise.resolve({ data: [] as { project_id: string; client_accounts: { login_id: string } | { login_id: string }[] | null }[] }),
      getOpenFeedbackCountByProject(supabase, projects || []),
    ]);

    // Build project_id -> login_id mapping
    const clientIdByProject: Record<string, string> = {};
    for (const link of capLinks || []) {
      const acc = link.client_accounts as { login_id: string } | { login_id: string }[] | null;
      const loginId = Array.isArray(acc) ? acc[0]?.login_id : acc?.login_id;
      if (loginId) clientIdByProject[link.project_id] = loginId;
    }

    const enriched = (projects || []).map((p) => ({
      ...p,
      client_id: clientIdByProject[p.id] || null,
      screen_count: p.screens?.length || 0,
      open_feedback_count: openCountByProject[p.id] || 0,
    }));

    return NextResponse.json(enriched);
  }

  // Client: get assigned projects
  const { data: links } = await supabase
    .from('client_account_projects')
    .select('project_id')
    .eq('client_account_id', session.id);

  const projectIds = links?.map((l) => l.project_id) || [];

  if (projectIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*, screens(id)')
    .in('id', projectIds)
    .order('updated_at', { ascending: false });

  const openCountByProject = await getOpenFeedbackCountByProject(supabase, projects || []);

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

  // SECURITY: Rate limit project creation (10 per minute)
  if (!checkRateLimit(`project-create:${session.id}`, 10, 60_000)) {
    return NextResponse.json(
      { error: 'Too many project creation requests. Please wait.' },
      { status: 429 }
    );
  }

  let body: { name?: string; slack_channel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // SECURITY: Sanitize project name to prevent stored XSS
  const name = body.name ? sanitizeText(body.name, 255) : '';
  const slack_channel = body.slack_channel ? sanitizeText(body.slack_channel, 255) : undefined;
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
    console.error('[projects/POST]', error.message);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }

  // Auto-provision client account with shared password "Potential" (per PRD)
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const loginId = `${name.replace(/\s+/g, '')}${randomNum}`;
  const defaultPassword = 'Potential';

  const { data: account } = await supabase
    .from('client_accounts')
    .insert({
      login_id: loginId,
      password: defaultPassword,
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

  // Return credentials once — admin should share these securely with the client
  return NextResponse.json({
    project,
    client_account: {
      login_id: loginId,
      initial_password: defaultPassword,
    },
  }, { status: 201 });
}
