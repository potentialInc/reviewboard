'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, type Locale, type TranslationKey } from './translations';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, ...args: unknown[]) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ko');

  useEffect(() => {
    const saved = localStorage.getItem('rb_locale') as Locale | null;
    if (saved && (saved === 'en' || saved === 'ko')) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('rb_locale', newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback((key: TranslationKey, ...args: unknown[]): string => {
    const value = translations[locale][key];
    if (typeof value === 'function') {
      return (value as (...a: unknown[]) => string)(...args);
    }
    return value ?? key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
