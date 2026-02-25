'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, AlertCircle, RefreshCw, MousePointer } from 'lucide-react';
import { PinOverlay } from '@/components/feedback/pin-overlay';
import { CommentForm } from '@/components/feedback/comment-form';
import { CommentPanel } from '@/components/feedback/comment-panel';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useToast } from '@/components/ui/toast';
import type { Comment } from '@/lib/types';

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

export default function FeedbackViewerPage() {
  const { id: projectId, screenId } = useParams<{ id: string; screenId: string }>();
  const { toast } = useToast();

  const [screen, setScreen] = useState<ScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<{ x: number; y: number } | null>(null);
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

  // Close version picker on outside click
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

  const handleImageClick = useCallback((x: number, y: number) => {
    setNewPin({ x, y });
    setSelectedPin(null);
  }, []);

  const handlePinClick = useCallback((c: Comment) => {
    setSelectedPin(c.id);
    setNewPin(null);
  }, []);

  const handleSubmitComment = useCallback(async (text: string) => {
    if (!currentVersion) return;
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot_version_id: currentVersion.id,
        x: newPin!.x,
        y: newPin!.y,
        text,
      }),
    });

    if (res.ok) {
      toast('Feedback submitted!', 'success');
      setNewPin(null);
      await fetchScreen();
    } else {
      toast('Failed to submit feedback', 'error');
    }
  }, [currentVersion, newPin, toast, fetchScreen]);

  const handleReply = useCallback(async (commentId: string, text: string) => {
    const res = await fetch(`/api/comments/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      toast('Reply added', 'success');
      await fetchScreen();
    }
  }, [toast, fetchScreen]);

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
        <h2 className="text-xl font-semibold text-foreground mb-2">Failed to load screen</h2>
        <p className="text-muted mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchScreen().finally(() => setLoading(false)); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!screen) return <p>Screen not found</p>;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Projects', href: '/client/projects' },
        { label: screen.project.name, href: `/client/projects/${projectId}/screens` },
        { label: screen.name },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/client/projects/${projectId}/screens`}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Back to screens"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-900">{screen.name}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {currentVersion && (
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                  v{currentVersion.version}{currentVersion.id === screen.latest_version?.id ? ' (Latest)' : ''}
                </span>
              )}
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
                      setNewPin(null);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      v.id === selectedVersion ? 'text-primary font-medium' : ''
                    }`}
                  >
                    v{v.version} {v.id === screen.latest_version?.id && '(latest)'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row flex-1 gap-0 min-h-0 rounded-2xl border border-border overflow-hidden bg-white">
        {/* Screenshot viewer */}
        <div className="flex-1 overflow-auto bg-gray-50 relative">
          {currentVersion ? (
            <div className="relative">
              <PinOverlay
                comments={currentVersion.comments || []}
                selectedPin={selectedPin}
                onPinClick={handlePinClick}
                onImageClick={handleImageClick}
                imageUrl={currentVersion.image_url}
              />
              {newPin && (
                <CommentForm
                  x={newPin.x}
                  y={newPin.y}
                  onSubmit={handleSubmitComment}
                  onCancel={() => setNewPin(null)}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted">
              No screenshot uploaded yet
            </div>
          )}
        </div>

        {/* Comment side panel */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center">
                Feedback
                <span className="bg-slate-100 text-slate-600 text-xs font-medium rounded-full px-2 py-0.5 ml-2">
                  {currentVersion?.comments?.length || 0} Items
                </span>
              </h3>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-light text-primary text-xs font-medium rounded-full">
                <MousePointer className="w-3 h-3" />
                Click anywhere to comment
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <CommentPanel
              comments={currentVersion?.comments || []}
              selectedPin={selectedPin}
              onSelectPin={setSelectedPin}
              onReply={handleReply}
              userType="client"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
