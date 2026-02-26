'use client';

import Link from 'next/link';
import { LogOut, Layers } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/ui/language-toggle';

export function ClientNavbar() {
  const { t } = useTranslation();
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <nav className="sticky top-0 h-16 bg-white border-b border-border flex items-center justify-between px-6 z-40" aria-label="Client navigation">
      <Link href="/client/projects" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
          <Layers className="w-5 h-5" aria-hidden="true" />
        </div>
        <span className="font-jakarta text-lg font-bold text-foreground tracking-tight">ReviewBoard</span>
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted font-medium hidden sm:block">{t('nav.clientMode')}</span>
        <LanguageToggle />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-muted hover:text-red-600 transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
          {t('nav.logout')}
        </button>
      </div>
    </nav>
  );
}
