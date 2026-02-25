import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithSupabase } from '@/lib/api-helpers';
import { validateUUID, sanitizeFilename } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

// POST /api/projects/[id]/screens/[screenId]/screenshots — upload screenshot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; screenId: string }> }
) {
  const { id: projectId, screenId } = await params;
  const projectIdErr = validateUUID(projectId, 'Project ID');
  if (projectIdErr) return projectIdErr;
  const screenIdErr = validateUUID(screenId, 'Screen ID');
  if (screenIdErr) return screenIdErr;

  const auth = await requireAdminWithSupabase();
  if (auth.error) return auth.error;
  const { session, supabase } = auth;

  // SECURITY: Rate limit file uploads to prevent storage abuse (5 per minute)
  if (!checkRateLimit(`upload:${session.id}`, 5, 60_000)) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a moment.' },
      { status: 429 }
    );
  }

  const supabaseCheck = supabase;

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

  // Enforce file size limit (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
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

  // Get current max version
  const { data: versions } = await supabase
    .from('screenshot_versions')
    .select('version')
    .eq('screen_id', screenId)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = (versions?.[0]?.version || 0) + 1;

  // SECURITY: Sanitize filename and derive extension from validated magic bytes,
  // not from user-supplied filename, to prevent path traversal and MIME mismatch.
  const safeFilename = sanitizeFilename(file.name);
  const rawExt = safeFilename.split('.').pop()?.toLowerCase() || '';
  const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
  const ext = ALLOWED_EXTENSIONS.includes(rawExt)
    ? rawExt
    : (isPng ? 'png' : isJpeg ? 'jpg' : isWebp ? 'webp' : 'gif');
  const path = `${screenId}/v${nextVersion}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  // SECURITY: Derive content type from validated magic bytes, not user-supplied file.type.
  // This prevents MIME type mismatch attacks where a malicious user sends a wrong Content-Type.
  const contentType = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : isWebp ? 'image/webp' : 'image/gif';
  const { error: uploadError } = await supabase.storage
    .from('screenshots')
    .upload(path, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error('[screenshots/POST upload]', uploadError.message);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
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

  if (error) {
    console.error('[screenshots/POST]', error.message);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }

  // Update screen's updated_at
  await supabase
    .from('screens')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', screenId);

  return NextResponse.json(version, { status: 201 });
}
