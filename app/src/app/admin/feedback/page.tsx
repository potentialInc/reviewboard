'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Search, Filter, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { Drawer } from '@/components/ui/drawer';
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
      <h1 className="text-2xl font-bold mb-6">Feedback Management</h1>

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
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search feedback..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted" />
          {['all', 'open', 'in-progress', 'resolved'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-muted hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'All' : s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
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
                <th className="px-4 py-3">
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
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Project</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Screen</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Pin</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Comment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Author</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {feedback.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-sm">{f.project_name}</td>
                  <td className="px-4 py-3 text-sm">{f.screen_name}</td>
                  <td className="px-4 py-3 text-sm font-medium">#{f.pin_number}</td>
                  <td className="px-4 py-3 text-sm text-muted max-w-[200px] truncate">{f.text}</td>
                  <td className="px-4 py-3 text-sm text-muted">{f.author_id}</td>
                  <td className="px-4 py-3">
                    <select
                      value={f.status}
                      onChange={(e) => handleStatusChange(f.id, e.target.value as FeedbackStatus)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${
                        f.status === 'open' ? 'bg-status-open-bg text-status-open' :
                        f.status === 'in-progress' ? 'bg-status-progress-bg text-status-progress' :
                        'bg-status-resolved-bg text-status-resolved'
                      }`}
                    >
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewDetail(f)}
                      className="px-2 py-1 text-xs text-primary hover:bg-primary-light rounded-lg"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
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
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm px-3">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer
        open={!!selectedFeedback}
        onClose={() => { setSelectedFeedback(null); setReplyText(''); }}
        title="Feedback Detail"
        width="w-[600px]"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : selectedFeedback && (
          <div className="flex flex-col gap-6">
            {/* Screenshot preview */}
            <div>
              {selectedFeedback.screenshot_version?.image_url ? (
                <div className="relative rounded-xl overflow-hidden bg-gray-100">
                  <Image
                    src={selectedFeedback.screenshot_version.image_url}
                    alt="Screenshot"
                    width={1200}
                    height={800}
                    sizes="600px"
                    className="w-full"
                  />
                  <div
                    className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-lg ring-2 ring-white"
                    style={{ left: `${selectedFeedback.x}%`, top: `${selectedFeedback.y}%` }}
                  >
                    {selectedFeedback.pin_number}
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center text-muted">
                  No screenshot
                </div>
              )}
            </div>

            {/* Comment + Replies */}
            <div className="flex flex-col">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted">Pin #{selectedFeedback.pin_number}</span>
                  <StatusBadge status={selectedFeedback.status} />
                </div>
                <p className="text-sm mb-2">{selectedFeedback.text}</p>
                <p className="text-xs text-muted">
                  by {selectedFeedback.author_id} &middot; ({selectedFeedback.x.toFixed(1)}%, {selectedFeedback.y.toFixed(1)}%)
                </p>
              </div>

              {/* Status changer */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-muted mb-1">Status</label>
                <select
                  value={selectedFeedback.status}
                  onChange={(e) => handleStatusChange(selectedFeedback.id, e.target.value as FeedbackStatus)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border text-sm"
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              {/* Replies */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                <p className="text-xs font-medium text-muted">Replies</p>
                {selectedFeedback.replies && selectedFeedback.replies.length > 0 ? (
                  selectedFeedback.replies.map((r) => (
                    <div key={r.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                      <span className={`text-xs font-medium ${r.author_type === 'admin' ? 'text-primary' : 'text-muted'}`}>
                        {r.author_type === 'admin' ? 'Admin' : 'Client'}
                      </span>
                      <p className="mt-1">{r.text}</p>
                      <p className="text-xs text-muted mt-1">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted">No replies yet</p>
                )}
              </div>

              {/* Reply input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
                  }}
                />
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim() || sending}
                  className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
