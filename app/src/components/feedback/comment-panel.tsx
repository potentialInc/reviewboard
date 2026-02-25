'use client';

import { useState, memo } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import type { Comment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface CommentPanelProps {
  comments: Comment[];
  selectedPin: string | null;
  onSelectPin: (id: string) => void;
  onReply?: (commentId: string, text: string) => Promise<void>;
  userType: 'admin' | 'client';
}

export const CommentPanel = memo(function CommentPanel({ comments, selectedPin, onSelectPin, onReply, userType }: CommentPanelProps) {
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleReply = async (commentId: string) => {
    if (!replyText.trim() || !onReply) return;
    setSending(true);
    await onReply(commentId, replyText.trim());
    setReplyText('');
    setReplyingTo(null);
    setSending(false);
  };

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-sm text-muted">No feedback yet</p>
        <p className="text-xs text-muted mt-1">Click on the image to leave feedback</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {comments.map((c) => (
        <div
          key={c.id}
          className={`p-4 cursor-pointer transition-colors ${
            selectedPin === c.id ? 'bg-primary-light' : 'hover:bg-gray-50'
          }`}
          onClick={() => onSelectPin(c.id)}
        >
          <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              c.status === 'open' ? 'bg-status-open' :
              c.status === 'in-progress' ? 'bg-status-progress' : 'bg-status-resolved'
            }`}>
              {c.pin_number}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted">{c.author_id}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-sm text-foreground">{c.text}</p>
              <p className="text-xs text-muted mt-1">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </p>

              {/* Replies */}
              {c.replies && c.replies.length > 0 && (
                <div className="mt-3 space-y-2 pl-3 border-l-2 border-border">
                  {c.replies.map((r) => (
                    <div key={r.id} className="text-sm">
                      <span className={`text-xs font-medium ${r.author_type === 'admin' ? 'text-primary' : 'text-muted'}`}>
                        {r.author_type === 'admin' ? 'Admin' : 'Client'}
                      </span>
                      <p className="text-foreground">{r.text}</p>
                      <p className="text-xs text-muted">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {selectedPin === c.id && (
                <div className="mt-3">
                  {replyingTo === c.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={userType === 'admin' ? 'Write a reply...' : 'Add a comment...'}
                        aria-label={`Reply to pin ${c.pin_number}`}
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleReply(c.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleReply(c.id)}
                        disabled={!replyText.trim() || sending}
                        aria-label="Send reply"
                        className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplyingTo(c.id); }}
                      className="text-xs text-primary hover:text-primary-hover font-medium"
                    >
                      Reply
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
