import { NextResponse } from 'next/server';
import { requireAdminWithSupabase } from '@/lib/api-helpers';

export async function GET() {
  const auth = await requireAdminWithSupabase();
  if (auth.error) return auth.error;
  const { supabase } = auth;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // Parallel queries to avoid sequential N+1 pattern
  const [
    { count: totalProjects },
    { count: totalOpen },
    { count: feedbackToday },
    { count: feedbackWeek },
    { data: recentComments },
  ] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('comments').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabase.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
    supabase.from('comments').select(`
      id, text, created_at, pin_number, status,
      screenshot_version:screenshot_versions(
        screen:screens(name, project:projects(name))
      )
    `).order('created_at', { ascending: false }).limit(10),
  ]);

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

  const res = NextResponse.json({
    stats: {
      total_projects: totalProjects || 0,
      total_open_feedback: totalOpen || 0,
      feedback_today: feedbackToday || 0,
      feedback_this_week: feedbackWeek || 0,
    },
    recent_activity: recentActivity,
  });

  // Cache dashboard stats for 30s — data is not real-time critical
  res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  return res;
}
