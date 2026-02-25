'use client';

import { formatDistanceToNow } from 'date-fns';
import { getPinColor, getStatusTextColor, getStatusBorderColor } from '@/components/ui/badge';
import type { FeedbackStatus, FeedbackListItem } from '@/lib/types';

interface FeedbackTableProps {
  feedback: FeedbackListItem[];
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
  onViewDetail: (item: FeedbackListItem) => void;
}

export function FeedbackTable({
  feedback,
  selected,
  onSelectionChange,
  onStatusChange,
  onViewDetail,
}: FeedbackTableProps) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-border bg-gray-50/50">
          <th className="px-6 py-4">
            <input
              type="checkbox"
              checked={selected.size === feedback.length && feedback.length > 0}
              onChange={(e) => {
                if (e.target.checked) onSelectionChange(new Set(feedback.map((f) => f.id)));
                else onSelectionChange(new Set());
              }}
              aria-label="Select all feedback"
              className="rounded"
            />
          </th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Pin</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Comment</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Context</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Status</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Date</th>
          <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {feedback.map((f) => (
          <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
            <td className="px-6 py-4">
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(f.id); else next.delete(f.id);
                  onSelectionChange(next);
                }}
                aria-label={`Select feedback pin ${f.pin_number}`}
                className="rounded"
              />
            </td>
            <td className="px-6 py-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${getPinColor(f.status)}`}>
                {f.pin_number}
              </div>
            </td>
            <td className="px-6 py-4">
              <p className="font-medium text-slate-900 truncate max-w-xs text-sm">{f.text}</p>
            </td>
            <td className="px-6 py-4">
              <div className="flex flex-col">
                <span className="text-slate-900 font-medium text-xs">{f.screen_name}</span>
                <span className="text-slate-500 text-[10px]">{f.project_name}</span>
              </div>
            </td>
            <td className="px-6 py-4">
              <select
                value={f.status}
                onChange={(e) => onStatusChange(f.id, e.target.value as FeedbackStatus)}
                aria-label={`Change status for pin ${f.pin_number}`}
                className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer ${getStatusBorderColor(f.status)} ${
                  f.status === 'open' ? 'bg-status-open-bg' :
                  f.status === 'in-progress' ? 'bg-status-progress-bg' :
                  'bg-status-resolved-bg'
                } ${getStatusTextColor(f.status)}`}
              >
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </td>
            <td className="px-6 py-4 text-xs text-muted">
              {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
            </td>
            <td className="px-6 py-4">
              <button
                onClick={() => onViewDetail(f)}
                className="text-primary hover:underline text-xs font-medium"
              >
                View &amp; Reply
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
