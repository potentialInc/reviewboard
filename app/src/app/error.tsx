'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background" role="alert">
      <div className="text-center px-4">
        <AlertCircle className="w-16 h-16 text-status-open mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold mb-2">{t('error.title')}</h1>
        <p className="text-muted mb-6">{t('error.description')}</p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-primary/20 transition-colors"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          {t('error.tryAgain')}
        </button>
      </div>
    </main>
  );
}
