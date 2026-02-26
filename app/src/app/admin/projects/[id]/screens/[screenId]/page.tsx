'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react';
import { PinOverlay } from '@/components/feedback/pin-overlay';
import { CommentPanel } from '@/components/feedback/comment-panel';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useToast } from '@/components/ui/toast';
import { useTranslation } from '@/lib/i18n/context';
import type { Comment, FeedbackStatus } from '@/lib/types';

interface ScreenshotVersion {
  id: string;
  version: number;
  image_url: string;
  comments: Comment[];
}

interface ScreenData {
  id: string;
  name: string;
  project: { id: string; name: string };
  screenshot_versions: ScreenshotVersion[];
  latest_version: ScreenshotVersion | null;
}

export default function AdminScreenViewerPage() {
  const { t } = useTranslation();
  const { id: projectId, screenId } = useParams<{ id: string; screenId: string }>();
  const { toast } = useToast();

  const [screen, setScreen] = useState<ScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const versionPickerRef = useRef<HTMLDivElement>(null);

  const fetchScreen = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/screens/${screenId}`);
      if (!res.ok) throw new Error('Failed to load screen');
      const data = await res.json();
      setScreen(data);
      setSelectedVersion(prev => prev ?? data.latest_version?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [screenId]);

  useEffect(() => {
    fetchScreen().finally(() => setLoading(false));
  }, [fetchScreen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (versionPickerRef.current && !versionPickerRef.current.contains(e.target as Node)) {
        setShowVersionPicker(false);
      }
    }
    if (showVersionPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showVersionPicker]);

  const currentVersion = screen?.screenshot_versions.find((v) => v.id === selectedVersion)
    || screen?.latest_version;

  const handlePinClick = useCallback((c: Comment) => {
    setSelectedPin(c.id);
  }, []);

  const handleReply = useCallback(async (commentId: string, text: string) => {
    const res = await fetch(`/api/comments/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      toast(t('toast.replySent'), 'success');
      await fetchScreen();
    }
  }, [toast, fetchScreen, t]);

  const handleStatusChange = useCallback(async (commentId: string, status: FeedbackStatus) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast(t('toast.statusUpdated'), 'success');
      await fetchScreen();
    }
  }, [toast, fetchScreen, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-status-open mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('viewer.loadFailed')}</h2>
        <p className="text-muted mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchScreen().finally(() => setLoading(false)); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> {t('common.retry')}
        </button>
      </div>
    );
  }

  if (!screen) return <p>{t('viewer.notFound')}</p>;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <Breadcrumb items={[
        { label: t('nav.dashboard'), href: '/admin' },
        { label: t('nav.projects'), href: '/admin/projects' },
        { label: screen.project.name, href: `/admin/projects/${projectId}` },
        { label: screen.name },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/projects/${projectId}`}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Back to project"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-900">{screen.name}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {currentVersion && (
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                  v{currentVersion.version}{currentVersion.id === screen.latest_version?.id ? ` (${t('viewer.latest')})` : ''}
                </span>
              )}
              <span>
                {currentVersion?.comments?.length || 0} {t('viewer.items')}
              </span>
            </div>
          </div>
        </div>

        {/* Version picker */}
        {screen.screenshot_versions.length > 1 && (
          <div className="relative" ref={versionPickerRef}>
            <button
              onClick={() => setShowVersionPicker(!showVersionPicker)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-lg text-sm font-medium hover:bg-gray-50"
              aria-label={`Select version, currently v${currentVersion?.version || 1}`}
              aria-expanded={showVersionPicker}
            >
              v{currentVersion?.version || 1}
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>
            {showVersionPicker && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg py-1 z-30 min-w-[120px]">
                {screen.screenshot_versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVersion(v.id);
                      setShowVersionPicker(false);
                      setSelectedPin(null);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      v.id === selectedVersion ? 'text-primary font-medium' : ''
                    }`}
                  >
                    v{v.version} {v.id === screen.latest_version?.id && `(${t('viewer.latest')})`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="relative flex-1 min-h-0 rounded-2xl border border-border overflow-hidden bg-white">
        {/* Screenshot viewer */}
        <div className="absolute inset-0 lg:right-96 overflow-auto bg-gray-50 flex items-center justify-center p-4">
          {currentVersion ? (
            <PinOverlay
              comments={currentVersion.comments || []}
              selectedPin={selectedPin}
              onPinClick={handlePinClick}
              imageUrl={currentVersion.image_url}
              readOnly
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted">
              {t('viewer.noScreenshot')}
            </div>
          )}
        </div>

        {/* Comment side panel with status controls */}
        <div className="absolute right-0 top-0 bottom-0 w-full lg:w-96 bg-white border-l border-border flex flex-col shadow-xl z-10">
          <div className="p-4 border-b border-border">
            <h3 className="text-base font-bold text-slate-800 flex items-center">
              {t('viewer.feedback')}
              <span className="bg-slate-100 text-slate-600 text-xs font-medium rounded-full px-2 py-0.5 ml-2">
                {currentVersion?.comments?.length || 0} {t('viewer.items')}
              </span>
            </h3>
          </div>

          {/* Status summary */}
          {currentVersion && currentVersion.comments.length > 0 && (
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              {(['open', 'in-progress', 'resolved'] as const).map((status) => {
                const count = currentVersion.comments.filter(c => c.status === status).length;
                if (count === 0) return null;
                const colors = {
                  'open': 'bg-status-open-bg text-status-open',
                  'in-progress': 'bg-status-progress-bg text-status-progress',
                  'resolved': 'bg-status-resolved-bg text-status-resolved',
                };
                const labels = { 'open': t('common.open'), 'in-progress': t('common.inProgress'), 'resolved': t('common.resolved') };
                return (
                  <span key={status} className={`text-xs font-medium px-2 py-1 rounded-full ${colors[status]}`}>
                    {labels[status]} {count}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <AdminCommentPanel
              comments={currentVersion?.comments || []}
              selectedPin={selectedPin}
              onSelectPin={setSelectedPin}
              onReply={handleReply}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Admin-specific comment panel with inline status change */
function AdminCommentPanel({
  comments,
  selectedPin,
  onSelectPin,
  onReply,
  onStatusChange,
}: {
  comments: Comment[];
  selectedPin: string | null;
  onSelectPin: (id: string) => void;
  onReply: (commentId: string, text: string) => Promise<void>;
  onStatusChange: (commentId: string, status: FeedbackStatus) => void;
}) {
  const { t } = useTranslation();
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleReply = async (commentId: string) => {
    if (!replyText.trim()) return;
    setSending(true);
    await onReply(commentId, replyText.trim());
    setReplyText('');
    setReplyingTo(null);
    setSending(false);
  };

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <p className="text-sm text-muted">{t('commentPanel.noFeedback')}</p>
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
                <select
                  value={c.status}
                  onChange={(e) => {
                    e.stopPropagation();
                    onStatusChange(c.id, e.target.value as FeedbackStatus);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`text-[10px] font-semibold rounded-full px-2 py-0.5 outline-none cursor-pointer border-none ${
                    c.status === 'open' ? 'bg-status-open-bg text-status-open' :
                    c.status === 'in-progress' ? 'bg-status-progress-bg text-status-progress' :
                    'bg-status-resolved-bg text-status-resolved'
                  }`}
                  aria-label={`Change status of pin ${c.pin_number}`}
                >
                  <option value="open">{t('common.open')}</option>
                  <option value="in-progress">{t('common.inProgress')}</option>
                  <option value="resolved">{t('common.resolved')}</option>
                </select>
              </div>
              <p className="text-sm text-foreground">{c.text}</p>
              <p className="text-xs text-muted mt-1">
                {new Date(c.created_at).toLocaleDateString()}
              </p>

              {/* Replies */}
              {c.replies && c.replies.length > 0 && (
                <div className="mt-3 space-y-2 pl-3 border-l-2 border-border">
                  {c.replies.map((r) => (
                    <div key={r.id} className="text-sm">
                      <span className={`text-xs font-medium ${r.author_type === 'admin' ? 'text-primary' : 'text-muted'}`}>
                        {r.author_type === 'admin' ? t('common.admin') : t('common.client')}
                      </span>
                      <p className="text-foreground">{r.text}</p>
                      <p className="text-xs text-muted">
                        {new Date(r.created_at).toLocaleDateString()}
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
                        placeholder={t('commentPanel.replyPlaceholder')}
                        aria-label={`Reply to pin ${c.pin_number}`}
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleReply(c.id);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReply(c.id); }}
                        disabled={!replyText.trim() || sending}
                        aria-label="Send reply"
                        className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50"
                      >
                        {sending ? '...' : t('commentPanel.reply')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplyingTo(c.id); }}
                      className="text-xs text-primary hover:text-primary-hover font-medium"
                    >
                      {t('commentPanel.reply')}
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
}
