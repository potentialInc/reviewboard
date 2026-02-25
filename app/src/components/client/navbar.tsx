'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';

export function ClientNavbar() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-border flex items-center justify-between px-6 z-40">
      <Link href="/client/projects" className="text-xl font-bold text-primary">
        ReviewBoard
      </Link>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </header>
  );
}
