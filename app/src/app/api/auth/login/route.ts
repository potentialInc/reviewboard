import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { setSession } from '@/lib/auth';
import { createServiceSupabase } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting: 5 attempts per IP per minute
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  if (!checkRateLimit(`login:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again in a minute.' },
      { status: 429 }
    );
  }

  let body: { id?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id, password } = body;

  if (!id || !password) {
    return NextResponse.json({ error: 'ID and password are required' }, { status: 400 });
  }

  // Check admin credentials
  if (id === process.env.ADMIN_ID && password === process.env.ADMIN_PASSWORD) {
    await setSession({ type: 'admin', id: 'admin', login_id: id });
    return NextResponse.json({ type: 'admin', redirect: '/admin' });
  }

  // Check client credentials (bcrypt hash comparison)
  const supabase = await createServiceSupabase();
  const { data: account } = await supabase
    .from('client_accounts')
    .select('id, login_id, password')
    .eq('login_id', id)
    .single();

  if (!account) {
    return NextResponse.json({ error: 'Invalid credentials. Please try again.' }, { status: 401 });
  }

  // Support both bcrypt hashed and legacy plaintext passwords
  const isHashed = account.password.startsWith('$2');
  const passwordMatch = isHashed
    ? await bcrypt.compare(password, account.password)
    : account.password === password;

  if (!passwordMatch) {
    return NextResponse.json({ error: 'Invalid credentials. Please try again.' }, { status: 401 });
  }

  await setSession({
    type: 'client',
    id: account.id,
    login_id: account.login_id,
  });

  return NextResponse.json({ type: 'client', redirect: '/client/projects' });
}
