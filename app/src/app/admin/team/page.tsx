'use client';

import { Users } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translations';

export default function TeamPage() {
  const { t } = useTranslation();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-jakarta font-bold text-foreground">
          {t('team.title' as TranslationKey)}
        </h1>
        <p className="text-muted mt-1">
          {t('team.subtitle' as TranslationKey)}
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-jakarta font-semibold text-foreground mb-2">
            {t('team.comingSoon' as TranslationKey)}
          </h2>
          <p className="text-muted leading-relaxed">
            {t('team.comingSoonDesc' as TranslationKey)}
          </p>
        </div>
      </div>
    </div>
  );
}
