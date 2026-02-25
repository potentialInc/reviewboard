import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithSupabase } from '@/lib/api-helpers';
import { validateUUID } from '@/lib/validation';

// GET /api/feedback/[id] — single feedback detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // SECURITY: Validate UUID to prevent malformed ID injection
  const uuidErr = validateUUID(id);
  if (uuidErr) return uuidErr;

  const auth = await requireAdminWithSupabase();
  if (auth.error) return auth.error;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      screenshot_version:screenshot_versions(
        id, version, image_url,
        screen:screens(
          id, name,
          project:projects(id, name)
        )
      ),
      replies(id, text, author_type, created_at)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('[feedback/GET]', error.message);
  }

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(data);
}
