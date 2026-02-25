import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Given a supabase client and an array of projects (each with nested screens),
 * returns a Record mapping project_id to the number of open feedback comments.
 *
 * Uses a single query with join to avoid N+1: comments -> screenshot_versions
 * instead of two separate queries.
 *
 * Projects are expected to have shape: { id: string; screens?: { id: string }[] }
 */
export async function getOpenFeedbackCountByProject(
  supabase: SupabaseClient,
  projects: { id: string; screens?: { id: string }[] }[]
): Promise<Record<string, number>> {
  // Collect all screen IDs across all projects
  const allScreenIds = projects.flatMap(
    (p) => (p.screens || []).map((s) => s.id)
  );

  if (allScreenIds.length === 0) {
    return {};
  }

  // Single query: join comments with screenshot_versions to get screen_id
  // This replaces two sequential queries with one
  const { data: openComments } = await supabase
    .from('comments')
    .select('screenshot_version:screenshot_versions!inner(screen_id)')
    .eq('status', 'open')
    .in('screenshot_version.screen_id', allScreenIds);

  if (!openComments || openComments.length === 0) {
    return {};
  }

  // Build screen -> project mapping for aggregation
  const screenToProject: Record<string, string> = {};
  for (const p of projects) {
    for (const s of p.screens || []) {
      screenToProject[s.id] = p.id;
    }
  }

  // Aggregate open feedback per project
  const openCountByProject: Record<string, number> = {};
  for (const c of openComments) {
    const sv = c.screenshot_version as { screen_id: string } | { screen_id: string }[];
    const screenId = Array.isArray(sv) ? sv[0]?.screen_id : sv?.screen_id;
    if (screenId) {
      const pid = screenToProject[screenId];
      if (pid) openCountByProject[pid] = (openCountByProject[pid] || 0) + 1;
    }
  }

  return openCountByProject;
}

/**
 * Given a supabase client and an array of screens (each with nested screenshot_versions),
 * returns a Record mapping screen_id to the number of open feedback comments.
 *
 * Screens are expected to have shape: { id: string; screenshot_versions?: { id: string }[] }
 */
export async function getOpenFeedbackCountByScreen(
  supabase: SupabaseClient,
  screens: { id: string; screenshot_versions?: { id: string }[] }[]
): Promise<Record<string, number>> {
  // Collect all screenshot_version IDs across all screens
  const allSvIds = screens.flatMap(
    (s) => (s.screenshot_versions || []).map((sv) => sv.id)
  );

  if (allSvIds.length === 0) {
    return {};
  }

  // Single query to count open comments per screenshot_version
  const { data: openComments } = await supabase
    .from('comments')
    .select('screenshot_version_id')
    .eq('status', 'open')
    .in('screenshot_version_id', allSvIds);

  if (!openComments || openComments.length === 0) {
    return {};
  }

  // Build sv -> screen mapping
  const svToScreen: Record<string, string> = {};
  for (const screen of screens) {
    for (const sv of screen.screenshot_versions || []) {
      svToScreen[sv.id] = screen.id;
    }
  }

  // Aggregate per screen
  const openCountByScreen: Record<string, number> = {};
  for (const c of openComments) {
    const screenId = svToScreen[c.screenshot_version_id];
    if (screenId) {
      openCountByScreen[screenId] = (openCountByScreen[screenId] || 0) + 1;
    }
  }

  return openCountByScreen;
}
