import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';
import { getSession, isAdmin } from '@/lib/auth';

// POST /api/projects/[id]/screens/[screenId]/screenshots — upload screenshot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; screenId: string }> }
) {
  const { id: projectId, screenId } = await params;
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseCheck = await createServiceSupabase();

  // Validate screen exists and belongs to the specified project
  const { data: screen } = await supabaseCheck
    .from('screens')
    .select('id')
    .eq('id', screenId)
    .eq('project_id', projectId)
    .single();

  if (!screen) {
    return NextResponse.json({ error: 'Screen not found in this project' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }

  // Validate file magic bytes server-side
  const headerBytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isPng = headerBytes[0] === 0x89 && headerBytes[1] === 0x50
    && headerBytes[2] === 0x4E && headerBytes[3] === 0x47;
  const isJpeg = headerBytes[0] === 0xFF && headerBytes[1] === 0xD8 && headerBytes[2] === 0xFF;
  const isWebp = headerBytes[0] === 0x52 && headerBytes[1] === 0x49
    && headerBytes[2] === 0x46 && headerBytes[3] === 0x46;
  const isGif = headerBytes[0] === 0x47 && headerBytes[1] === 0x49 && headerBytes[2] === 0x46;

  if (!isPng && !isJpeg && !isWebp && !isGif) {
    return NextResponse.json({ error: 'Invalid image file. Only PNG, JPEG, WebP, and GIF are allowed.' }, { status: 400 });
  }

  const supabase = await createServiceSupabase();

  // Get current max version
  const { data: versions } = await supabase
    .from('screenshot_versions')
    .select('version')
    .eq('screen_id', screenId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = (versions?.[0]?.version || 0) + 1;

  // Upload to storage
  const ext = file.name.split('.').pop() || 'png';
  const path = `${screenId}/v${nextVersion}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('screenshots')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from('screenshots')
    .getPublicUrl(path);

  // Create version record
  const { data: version, error } = await supabase
    .from('screenshot_versions')
    .insert({
      screen_id: screenId,
      version: nextVersion,
      image_url: publicUrl,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update screen's updated_at
  await supabase
    .from('screens')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', screenId);

  return NextResponse.json(version, { status: 201 });
}
