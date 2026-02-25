import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithSupabase, parseJsonBody } from '@/lib/api-helpers';
import { validateUUID, sanitizeText } from '@/lib/validation';

// POST /api/projects/[id]/screens — create screen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const uuidErr = validateUUID(projectId, 'Project ID');
  if (uuidErr) return uuidErr;

  const auth = await requireAdminWithSupabase();
  if (auth.error) return auth.error;

  const parsed = await parseJsonBody<{ name?: string }>(request);
  if (parsed.error) return parsed.error;
  // SECURITY: Sanitize screen name to prevent stored XSS
  const name = parsed.body.name ? sanitizeText(parsed.body.name, 255) : '';
  if (!name) {
    return NextResponse.json({ error: 'Screen name is required' }, { status: 400 });
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from('screens')
    .insert({ project_id: projectId, name })
    .select()
    .single();

  if (error) {
    console.error('[screens/POST]', error.message);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
