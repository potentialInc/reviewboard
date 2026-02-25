import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithSupabase, parseJsonBody } from '@/lib/api-helpers';
import { validateUUIDs } from '@/lib/validation';

// DELETE /api/projects/bulk — batch delete projects
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminWithSupabase();
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody<{ ids?: string[] }>(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
  }

  // SECURITY: Validate all UUIDs to prevent injection
  const uuidErr = validateUUIDs(ids, 'Project ID');
  if (uuidErr) return uuidErr;

  // SECURITY: Cap bulk operation size to prevent abuse
  if (ids.length > 50) {
    return NextResponse.json({ error: 'Cannot delete more than 50 projects at once' }, { status: 400 });
  }

  const { supabase } = auth;
  const { error } = await supabase
    .from('projects')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('[projects-bulk/DELETE]', error.message);
    return NextResponse.json({ error: 'Failed to delete projects' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: ids.length });
}
