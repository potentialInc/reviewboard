'use client';

import { useTranslation } from '@/lib/i18n/context';

export function LanguageToggle({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { locale, setLocale } = useTranslation();

  const isDark = variant === 'dark';

  return (
    <button
      onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
      className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
        isDark
          ? 'text-gray-400 hover:text-white hover:bg-white/10'
          : 'text-muted hover:text-foreground hover:bg-gray-100'
      }`}
      aria-label={locale === 'ko' ? 'Switch to English' : '한국어로 전환'}
    >
      {locale === 'ko' ? 'EN' : '한국어'}
    </button>
  );
}
