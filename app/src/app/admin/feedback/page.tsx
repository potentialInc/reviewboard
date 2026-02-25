'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Search, ChevronLeft, ChevronRight, Send, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useToast } from '@/components/ui/toast';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import type { FeedbackStatus, Reply } from '@/lib/types';

interface FeedbackItem {
  id: string;
  pin_number: number;
  x: number;
  y: number;
  text: string;
  author_id: string;
  status: FeedbackStatus;
  created_at: string;
  project_name: string;
  screen_name: string;
  reply_count: number;
  screenshot_version?: {
    image_url: string;
    screen?: { name: string };
  };
  replies?: Reply[];
}

const PER_PAGE_OPTIONS = [10, 25, 50];

function getPinColor(status: FeedbackStatus): string {
  if (status === 'open') return 'bg-red-500';
  if (status === 'in-progress') return 'bg-yellow-500';
  return 'bg-green-500';
}

function getStatusTextColor(status: FeedbackStatus): string {
  if (status === 'open') return 'text-red-700';
  if (status === 'in-progress') return 'text-yellow-700';
  return 'text-green-700';
}

function getStatusBorderColor(status: FeedbackStatus): string {
  if (status === 'open') return 'border border-red-200';
  if (status === 'in-progress') return 'border border-yellow-200';
  return 'border border-green-200';
}

export default function AdminFeedbackPage() {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (search) params.set('search', search);

    try {
      const res = await fetch(`/api/feedback?${params}`);
      if (!res.ok) throw new Error('Failed to fetch feedback');
      const data = await res.json();
      setFeedback(data.data || []);
      setTotal(data.total || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch feedback');
      toast('Failed to load feedback', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, statusFilter, search, toast]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  // Debounce search input: 300ms delay
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  // Bulk status update
  const handleBulkStatus = async (status: FeedbackStatus) => {
    if (selected.size === 0) return;
    const res = await fetch('/api/feedback/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), status }),
    });
    if (res.ok) {
      toast(`${selected.size} item(s) updated to ${status}`, 'success');
      setSelected(new Set());
      fetchFeedback();
    } else {
      toast('Bulk update failed', 'error');
    }
  };

  const handleViewDetail = async (item: FeedbackItem) => {
    setDetailLoading(true);
    setSelectedFeedback(item);
    const res = await fetch(`/api/feedback/${item.id}`);
    const data = await res.json();
    setSelectedFeedback({ ...item, ...data });
    setDetailLoading(false);
  };

  const handleStatusChange = async (id: string, status: FeedbackStatus) => {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast('Status updated', 'success');
      fetchFeedback();
      if (selectedFeedback?.id === id) {
        setSelectedFeedback((prev) => prev ? { ...prev, status } : null);
      }
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedFeedback) return;
    setSending(true);
    const res = await fetch(`/api/comments/${selectedFeedback.id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: replyText.trim() }),
    });
    if (res.ok) {
      toast('Reply sent', 'success');
      setReplyText('');
      await handleViewDetail(selectedFeedback);
    } else {
      toast('Failed to send reply', 'error');
    }
    setSending(false);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Feedback' }]} />
      <h1 className="text-2xl font-bold mb-8 font-jakarta">Feedback Manager</h1>
      <p className="text-muted mt-1 -mt-7 mb-8">Review and triage incoming feedback from all projects.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary/5 rounded-xl">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button onClick={() => handleBulkStatus('open')} className="px-3 py-1 text-xs font-medium bg-status-open-bg text-status-open rounded-full">Mark Open</button>
          <button onClick={() => handleBulkStatus('in-progress')} className="px-3 py-1 text-xs font-medium bg-status-progress-bg text-status-progress rounded-full">In Progress</button>
          <button onClick={() => handleBulkStatus('resolved')} className="px-3 py-1 text-xs font-medium bg-status-resolved-bg text-status-resolved rounded-full">Resolved</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted hover:text-foreground">Clear</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search feedback..."
              aria-label="Search feedback"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="all">All Projects</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>
        ) : feedback.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-24 h-24 mx-auto mb-4 text-gray-200" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="15" y="30" width="90" height="65" rx="8" stroke="currentColor" strokeWidth="2" />
              <circle cx="60" cy="55" r="12" stroke="currentColor" strokeWidth="2" opacity="0.4" />
              <path d="M56 55l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
              <line x1="30" y1="78" x2="90" y2="78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
              <line x1="35" y1="85" x2="85" y2="85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
            </svg>
            <p className="text-muted font-medium mb-1">No feedback found</p>
            <p className="text-sm text-muted">Feedback from clients will appear here.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selected.size === feedback.length && feedback.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(feedback.map((f) => f.id)));
                      else setSelected(new Set());
                    }}
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
                        setSelected(next);
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${getPinColor(f.status)}`}>
                      {f.pin_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted max-w-[300px] truncate">{f.text}</td>
                  <td className="px-6 py-4 text-sm">{f.project_name} &gt; {f.screen_name}</td>
                  <td className="px-6 py-4">
                    <select
                      value={f.status}
                      onChange={(e) => handleStatusChange(f.id, e.target.value as FeedbackStatus)}
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
                      onClick={() => handleViewDetail(f)}
                      className="text-primary hover:underline text-xs font-medium"
                    >
                      View &amp; Reply
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>Show</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 border border-border rounded-lg text-sm"
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>of {total}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm px-3">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal — split layout matching mockup */}
      <Modal
        open={!!selectedFeedback}
        onClose={() => { setSelectedFeedback(null); setReplyText(''); }}
        title="Feedback Detail"
        size="5xl"
        bare
      >
        <div className="flex h-[85vh]">
          {/* Left: Image Viewer & Pin */}
          <div className="w-1/2 bg-slate-100 border-r border-slate-200 relative overflow-hidden flex items-center justify-center">
            {detailLoading ? (
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : selectedFeedback?.screenshot_version?.image_url ? (
              <>
                <div className="absolute top-4 left-4 z-10">
                  <span className="bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-medium text-slate-600 shadow-sm border border-slate-200">
                    {selectedFeedback.screenshot_version.screen?.name || selectedFeedback.screen_name}
                  </span>
                </div>
                <div className="relative shadow-xl ring-1 ring-slate-900/5 bg-white select-none">
                  <Image
                    src={selectedFeedback.screenshot_version.image_url}
                    alt="Screenshot"
                    width={400}
                    height={711}
                    sizes="400px"
                    className="w-[320px] h-auto block opacity-95"
                  />
                  <div
                    className={`absolute w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold z-20 animate-bounce ${getPinColor(selectedFeedback.status)}`}
                    style={{ left: `${selectedFeedback.x}%`, top: `${selectedFeedback.y}%`, transform: 'translate(-50%, -50%)' }}
                  >
                    {selectedFeedback.pin_number}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted text-sm">No screenshot</div>
            )}
          </div>

          {/* Right: Conversation */}
          <div className="w-1/2 flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              {selectedFeedback && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={selectedFeedback.status} />
                    <span className="text-xs text-slate-400">Pin #{selectedFeedback.pin_number}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg truncate max-w-[300px]">{selectedFeedback.text}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedFeedback.screen_name} &middot; {formatDistanceToNow(new Date(selectedFeedback.created_at), { addSuffix: true })}
                  </p>
                </div>
              )}
              <button
                onClick={() => { setSelectedFeedback(null); setReplyText(''); }}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : selectedFeedback && (
                <>
                  {/* Original feedback */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">CL</div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm text-slate-900">Client</span>
                        <span className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(selectedFeedback.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-tr-lg rounded-br-lg rounded-bl-lg border border-slate-100">
                        {selectedFeedback.text}
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {selectedFeedback.replies && selectedFeedback.replies.length > 0 ? (
                    selectedFeedback.replies.map((r) => (
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
            {selectedFeedback && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 shrink-0">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full h-24 p-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none bg-white shadow-sm mb-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleReply(); }
                  }}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-xs font-medium text-slate-500">Set Status:</span>
                    <select
                      value={selectedFeedback.status}
                      onChange={(e) => handleStatusChange(selectedFeedback.id, e.target.value as FeedbackStatus)}
                      className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <button
                    onClick={handleReply}
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
    </div>
  );
}
