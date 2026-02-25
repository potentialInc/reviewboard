'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';

interface CommentFormProps {
  x: number;
  y: number;
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
}

export function CommentForm({ x, y, onSubmit, onCancel }: CommentFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    await onSubmit(text.trim());
    setSubmitting(false);
  };

  return (
    <div
      className="absolute z-20 bg-white rounded-xl shadow-2xl border border-border p-4 w-72"
      style={{
        left: `${Math.min(x, 70)}%`,
        top: `${Math.min(y, 80)}%`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">Add Feedback</span>
        <button onClick={onCancel} className="p-1 rounded hover:bg-gray-100">
          <X className="w-4 h-4 text-muted" />
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe the issue or suggestion..."
          className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          rows={3}
          autoFocus
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}
