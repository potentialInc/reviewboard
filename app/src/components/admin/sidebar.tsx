'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, MessageSquare, Users, LogOut, Menu, X, Layers } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';
import { LanguageToggle } from '@/components/ui/language-toggle';
import type { TranslationKey } from '@/lib/i18n/translations';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, labelKey: 'nav.dashboard' as TranslationKey },
  { href: '/admin/projects', icon: FolderKanban, labelKey: 'nav.projects' as TranslationKey },
  { href: '/admin/feedback', icon: MessageSquare, labelKey: 'nav.feedback' as TranslationKey },
  { href: '/admin/team', icon: Users, labelKey: 'nav.team' as TranslationKey },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const sidebarContent = (
    <>
      {/* Logo header */}
      <div className="h-16 flex items-center gap-2 px-6 border-b border-white/5">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white flex-shrink-0">
          <Layers className="w-5 h-5" aria-hidden="true" />
        </div>
        <span className="font-jakarta text-lg font-bold text-white tracking-tight">ReviewBoard</span>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-white hover:bg-sidebar-hover ml-auto"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 transition-colors ${!isActive ? 'group-hover:text-primary' : ''}`} aria-hidden="true" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* User profile + Logout */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{t('nav.adminUser')}</p>
            <p className="text-xs text-slate-500 truncate">dev@reviewboard.io</p>
          </div>
          <LanguageToggle variant="dark" />
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-sidebar-hover transition-colors"
            aria-label={t('nav.logout')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-xl bg-sidebar text-white shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col z-40 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
