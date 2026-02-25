import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ClientNavbar } from '@/components/client/navbar';
import { ToastProvider } from '@/components/ui/toast';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.type !== 'client') {
    redirect('/login');
  }

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <ClientNavbar />
        <main className="pt-16 px-6 py-10 max-w-6xl mx-auto">{children}</main>
      </div>
    </ToastProvider>
  );
}
