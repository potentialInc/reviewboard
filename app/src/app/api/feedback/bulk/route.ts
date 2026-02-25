import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin } from '@/lib/auth';

// PATCH /api/feedback/bulk — bulk update feedback status
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ids, status } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0 || !status) {
    return NextResponse.json({ error: 'ids and status are required' }, { status: 400 });
  }

  const validStatuses = ['open', 'in-progress', 'resolved'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = await createServiceSupabase();
  const { error } = await supabase
    .from('comments')
    .update({ status })
    .in('id', ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: ids.length });
}
