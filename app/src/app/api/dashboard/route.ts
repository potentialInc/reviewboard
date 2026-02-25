import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceSupabase();

  // Total projects
  const { count: totalProjects } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true });

  // Total open feedback
  const { count: totalOpen } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');

  // Feedback today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: feedbackToday } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString());

  // Feedback this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const { count: feedbackWeek } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', weekStart.toISOString());

  // Recent activity
  const { data: recentComments } = await supabase
    .from('comments')
    .select(`
      id, text, created_at, pin_number, status,
      screenshot_version:screenshot_versions(
        screen:screens(name, project:projects(name))
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  const recentActivity = (recentComments || []).map((c) => {
    const sv = c.screenshot_version as {
      screen?: { name: string; project?: { name: string } };
    };
    return {
      id: c.id,
      comment: c.text,
      pin_number: c.pin_number,
      status: c.status,
      created_at: c.created_at,
      screen_name: sv?.screen?.name || '',
      project_name: sv?.screen?.project?.name || '',
    };
  });

  return NextResponse.json({
    stats: {
      total_projects: totalProjects || 0,
      total_open_feedback: totalOpen || 0,
      feedback_today: feedbackToday || 0,
      feedback_this_week: feedbackWeek || 0,
    },
    recent_activity: recentActivity,
  });
}
