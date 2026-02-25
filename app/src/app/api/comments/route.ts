import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin, hasProjectAccess } from '@/lib/auth';
import { sendSlackNotification } from '@/lib/slack';

// POST /api/comments — create comment (pin feedback)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { screenshot_version_id, x, y, text } = await request.json();
  if (!screenshot_version_id || x === undefined || y === undefined || !text) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = await createServiceSupabase();

  // Authorization: client users can only comment on screenshots belonging to their projects
  if (!isAdmin(session)) {
    const { data: svCheck } = await supabase
      .from('screenshot_versions')
      .select('screen:screens(project_id)')
      .eq('id', screenshot_version_id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const screenCheck = (svCheck as any)?.screen;
    const screenRow = Array.isArray(screenCheck) ? screenCheck[0] : screenCheck;
    const projectId = screenRow?.project_id;

    if (!projectId) {
      return NextResponse.json({ error: 'Screenshot version not found' }, { status: 404 });
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

  // Assign pin number with retry to handle race conditions
  // The DB has unique(screenshot_version_id, pin_number), so conflicts are caught
  let comment = null;
  let retries = 3;
  while (retries > 0) {
    const { data: existing } = await supabase
      .from('comments')
      .select('pin_number')
      .eq('screenshot_version_id', screenshot_version_id)
      .order('pin_number', { ascending: false })
      .limit(1);

    const pinNumber = (existing?.[0]?.pin_number || 0) + 1;

    const { data, error } = await supabase
      .from('comments')
      .insert({
        screenshot_version_id,
        pin_number: pinNumber,
        x,
        y,
        text,
        author_id: session.login_id,
        status: 'open',
      })
      .select()
      .single();

    if (!error) {
      comment = data;
      break;
    }

    // Unique constraint violation (23505) — retry with fresh pin number
    if (error.code === '23505') {
      retries--;
      continue;
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!comment) {
    return NextResponse.json({ error: 'Failed to assign pin number after retries' }, { status: 500 });
  }

  const pinNumber = comment.pin_number;

  // Send Slack notification
  const { data: sv } = await supabase
    .from('screenshot_versions')
    .select('screen:screens(name, project:projects(name, slack_channel))')
    .eq('id', screenshot_version_id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const screenData = sv?.screen as any;
  const screen = Array.isArray(screenData) ? screenData[0] : screenData;
  const project = screen?.project ? (Array.isArray(screen.project) ? screen.project[0] : screen.project) : null;
  if (project?.slack_channel) {
    await sendSlackNotification(project.slack_channel, {
      projectName: project.name,
      screenName: screen.name,
      comment: text,
      author: session.login_id,
      pinNumber,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
