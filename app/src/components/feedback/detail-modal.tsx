'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { StatusBadge, getPinColor } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { formatDistanceToNow } from 'date-fns';
import type { FeedbackStatus, Reply } from '@/lib/types';

interface FeedbackItem {
  id: string;
  pin_number: number;
  x: number;
  y: number;
  text: string;
  status: FeedbackStatus;
  created_at: string;
  screen_name: string;
  screenshot_version?: {
    image_url: string;
    screen?: { name: string };
  };
  replies?: Reply[];
}

interface FeedbackDetailModalProps {
  feedback: FeedbackItem | null;
  loading: boolean;
  replyText: string;
  sending: boolean;
  onClose: () => void;
  onReply: () => void;
  onReplyTextChange: (text: string) => void;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
}

export function FeedbackDetailModal({
  feedback,
  loading,
  replyText,
  sending,
  onClose,
  onReply,
  onReplyTextChange,
  onStatusChange,
}: FeedbackDetailModalProps) {
  return (
    <Modal open={!!feedback} onClose={onClose} title="Feedback Detail" size="5xl" bare>
      <div className="flex flex-col md:flex-row h-[85vh]">
        {/* Left: Image Viewer & Pin */}
        <div className="w-full md:w-1/2 bg-slate-100 border-b md:border-b-0 md:border-r border-slate-200 relative overflow-hidden flex items-center justify-center min-h-[200px] md:min-h-0">
          {loading ? (
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          ) : feedback?.screenshot_version?.image_url ? (
            <>
              <div className="absolute top-4 left-4 z-10">
                <span className="bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-medium text-slate-600 shadow-sm border border-slate-200">
                  {feedback.screenshot_version.screen?.name || feedback.screen_name}
                </span>
              </div>
              <div className="relative shadow-xl ring-1 ring-slate-900/5 bg-white select-none">
                <Image
                  src={feedback.screenshot_version.image_url}
                  alt="Screenshot"
                  width={400}
                  height={711}
                  sizes="400px"
                  className="w-[320px] h-auto block opacity-95"
                />
                <div
                  className={`absolute w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold z-20 animate-bounce ${getPinColor(feedback.status)}`}
                  style={{ left: `${feedback.x}%`, top: `${feedback.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  {feedback.pin_number}
                </div>
              </div>
            </>
          ) : (
            <div className="text-muted text-sm">No screenshot</div>
          )}
        </div>

        {/* Right: Conversation */}
        <div className="w-full md:w-1/2 flex flex-col h-full bg-white">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
            {feedback && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={feedback.status} />
                  <span className="text-xs text-slate-400">Pin #{feedback.pin_number}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg truncate max-w-[300px]">{feedback.text}</h3>
                <p className="text-xs text-slate-500">
                  {feedback.screen_name} &middot; {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
                </p>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Thread */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : feedback && (
              <>
                {/* Original feedback */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">CL</div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm text-slate-900">Client</span>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-tr-lg rounded-br-lg rounded-bl-lg border border-slate-100">
                      {feedback.text}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {feedback.replies && feedback.replies.length > 0 ? (
                  feedback.replies.map((r) => (
                    <div key={r.id} className="flex gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        r.author_type === 'admin'
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                          : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {r.author_type === 'admin' ? 'AD' : 'CL'}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-sm text-slate-900">
                            {r.author_type === 'admin' ? 'Admin' : 'Client'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div className={`mt-1 text-sm leading-relaxed p-3 border rounded-tr-lg rounded-br-lg rounded-bl-lg ${
                          r.author_type === 'admin'
                            ? 'bg-indigo-50 border-indigo-100 text-slate-700'
                            : 'bg-slate-50 border-slate-100 text-slate-600'
                        }`}>
                          {r.text}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-center">
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">No replies yet</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Reply */}
          {feedback && (
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <textarea
                value={replyText}
                onChange={(e) => onReplyTextChange(e.target.value)}
                placeholder="Write a reply..."
                aria-label="Write a reply"
                className="w-full h-24 p-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none bg-white shadow-sm mb-3"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onReply(); }
                }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-xs font-medium text-slate-500">Set Status:</span>
                  <select
                    value={feedback.status}
                    onChange={(e) => onStatusChange(feedback.id, e.target.value as FeedbackStatus)}
                    aria-label="Set feedback status"
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <button
                  onClick={onReply}
                  disabled={!replyText.trim() || sending}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-colors shadow-md disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Update & Reply'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
