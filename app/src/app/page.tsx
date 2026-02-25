import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function Home() {
  const session = await getSession();
  if (session?.type === 'admin') redirect('/admin');
  if (session?.type === 'client') redirect('/client/projects');
  redirect('/login');
}
