'use client';

import type { FeedbackStatus } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n/translations';
import { useTranslation } from '@/lib/i18n/context';

const statusStyles: Record<FeedbackStatus, string> = {
  'open': 'bg-status-open-bg text-status-open',
  'in-progress': 'bg-status-progress-bg text-status-progress',
  'resolved': 'bg-status-resolved-bg text-status-resolved',
};

const statusLabelKeys: Record<FeedbackStatus, TranslationKey> = {
  'open': 'common.open',
  'in-progress': 'common.inProgress',
  'resolved': 'common.resolved',
};

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}>
      {t(statusLabelKeys[status])}
    </span>
  );
}

export function getPinColor(status: FeedbackStatus): string {
  if (status === 'open') return 'bg-red-500';
  if (status === 'in-progress') return 'bg-yellow-500';
  return 'bg-green-500';
}

export function getStatusTextColor(status: FeedbackStatus): string {
  if (status === 'open') return 'text-red-700';
  if (status === 'in-progress') return 'text-yellow-700';
  return 'text-green-700';
}

export function getStatusBorderColor(status: FeedbackStatus): string {
  if (status === 'open') return 'border border-red-200';
  if (status === 'in-progress') return 'border border-yellow-200';
  return 'border border-green-200';
}

export function CountBadge({ count, variant = 'default' }: { count: number; variant?: 'default' | 'danger' }) {
  const style = variant === 'danger'
    ? 'bg-red-100 text-red-700'
    : 'bg-primary-light text-primary';

  return (
    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${style}`}>
      {count}
    </span>
  );
}
