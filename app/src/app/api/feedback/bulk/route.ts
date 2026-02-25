import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithSupabase, parseJsonBody } from '@/lib/api-helpers';
import { validateUUIDs } from '@/lib/validation';

// PATCH /api/feedback/bulk — bulk update feedback status
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminWithSupabase();
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody<{ ids?: string[]; status?: string }>(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;
  const { ids, status } = body;
  if (!Array.isArray(ids) || ids.length === 0 || !status) {
    return NextResponse.json({ error: 'ids and status are required' }, { status: 400 });
  }

  // SECURITY: Validate all UUIDs in the array to prevent injection
  const uuidErr = validateUUIDs(ids, 'Feedback ID');
  if (uuidErr) return uuidErr;

  // SECURITY: Cap bulk operation size to prevent abuse
  if (ids.length > 100) {
    return NextResponse.json({ error: 'Cannot update more than 100 items at once' }, { status: 400 });
  }

  const validStatuses = ['open', 'in-progress', 'resolved'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { supabase } = auth;
  const { error } = await supabase
    .from('comments')
    .update({ status })
    .in('id', ids);

  if (error) {
    console.error('[feedback-bulk/PATCH]', error.message);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: ids.length });
}
