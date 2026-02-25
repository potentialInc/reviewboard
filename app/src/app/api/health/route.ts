import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';

export async function GET() {
  const checks: Record<string, string> = { status: 'ok' };

  try {
    const supabase = await createServiceSupabase();
    const { error } = await supabase.from('projects').select('id').limit(1);
    checks.database = error ? 'error' : 'ok';
  } catch {
    checks.database = 'unreachable';
  }

  const healthy = checks.database === 'ok';

  return NextResponse.json(
    { ...checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
