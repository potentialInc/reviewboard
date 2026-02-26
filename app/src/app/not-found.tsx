'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-foreground mb-2">{t('notFound.title')}</p>
        <p className="text-muted mb-6">{t('notFound.description')}</p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-primary/20 transition-colors"
        >
          {t('notFound.goHome')}
        </Link>
      </div>
    </main>
  );
}
