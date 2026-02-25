import { cookies } from 'next/headers';
import { sealData, unsealData } from 'iron-session';
import type { SessionUser } from './types';

const SESSION_COOKIE = 'rb_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'reviewboard-default-secret-change-in-production-32chars!';

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(SESSION_COOKIE);
  if (!sealed?.value) return null;
  try {
    return await unsealData<SessionUser>(sealed.value, {
      password: SESSION_SECRET,
    });
  } catch {
    return null;
  }
}

export async function setSession(user: SessionUser) {
  const cookieStore = await cookies();
  const sealed = await sealData(user, {
    password: SESSION_SECRET,
    ttl: 60 * 60 * 24 * 7, // 7 days
  });
  cookieStore.set(SESSION_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.type === 'admin';
}

/** Check if a client has access to a project */
export function hasProjectAccess(
  user: SessionUser | null,
  projectId: string,
  assignedProjectIds?: string[]
): boolean {
  if (!user) return false;
  if (user.type === 'admin') return true;
  if (user.project_id === projectId) return true;
  if (assignedProjectIds?.includes(projectId)) return true;
  return false;
}
