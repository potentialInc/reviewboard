import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';

const startTime = Date.now();

export async function GET() {
  const checks: Record<string, string> = { status: 'ok' };

  // Database connectivity check with latency measurement
  try {
    const supabase = await createServiceSupabase();
    const start = Date.now();
    const { error } = await supabase.from('projects').select('id').limit(1);
    const latency = Date.now() - start;
    checks.database = error ? 'error' : 'ok';
    checks.db_latency_ms = String(latency);
    if (error) {
      checks.db_error = error.message;
    }
  } catch (err) {
    checks.database = 'unreachable';
    checks.db_error = err instanceof Error ? err.message : 'unknown';
  }

  const healthy = checks.database === 'ok';

  return NextResponse.json(
    {
      ...checks,
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'unknown',
    },
    { status: healthy ? 200 : 503 },
  );
}
