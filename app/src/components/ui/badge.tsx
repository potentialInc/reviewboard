import type { FeedbackStatus } from '@/lib/types';

const statusStyles: Record<FeedbackStatus, string> = {
  'open': 'bg-status-open-bg text-status-open',
  'in-progress': 'bg-status-progress-bg text-status-progress',
  'resolved': 'bg-status-resolved-bg text-status-resolved',
};

const statusLabels: Record<FeedbackStatus, string> = {
  'open': 'Open',
  'in-progress': 'In Progress',
  'resolved': 'Resolved',
};

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
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
