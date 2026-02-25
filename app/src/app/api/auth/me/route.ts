import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// GET /api/auth/me — lightweight session check
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ type: session.type, login_id: session.login_id });
}
