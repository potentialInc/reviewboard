import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { ToastProvider } from '@/components/ui/toast';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.type !== 'admin') {
    redirect('/login');
  }

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <AdminSidebar />
        <main className="lg:ml-64 p-10 pt-16 lg:pt-10">{children}</main>
      </div>
    </ToastProvider>
  );
}
