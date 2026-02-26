'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useToast } from '@/components/ui/toast';
import { useTranslation } from '@/lib/i18n/context';
import { TableSkeleton } from '@/components/ui/skeleton';
import { FeedbackTable } from '@/components/admin/feedback/feedback-table';
import type { FeedbackStatus, FeedbackListItem } from '@/lib/types';

const PER_PAGE_OPTIONS = [10, 25, 50];

export default function AdminFeedbackPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<FeedbackListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
      toast(t('toast.bulkUpdateFailed'), 'error');
    }
  };

  const handleViewDetail = (item: FeedbackListItem) => {
    if (item.project_id && item.screen_id) {
      router.push(`/admin/projects/${item.project_id}/screens/${item.screen_id}?pin=${item.id}`);
    }
  };

  const handleStatusChange = async (id: string, status: FeedbackStatus) => {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast(t('toast.statusUpdated'), 'success');
      fetchFeedback();
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <Breadcrumb items={[{ label: t('nav.dashboard'), href: '/admin' }, { label: t('nav.feedback') }]} />
      <header className="mb-8">
        <h1 className="text-2xl font-bold font-jakarta text-slate-900">{t('feedbackMgr.title')}</h1>
        <p className="text-slate-500 mt-1">{t('feedbackMgr.subtitle')}</p>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary/5 rounded-xl">
          <span className="text-sm font-medium">{t('feedbackMgr.selected', selected.size)}</span>
          <button onClick={() => handleBulkStatus('open')} className="px-3 py-1 text-xs font-medium bg-status-open-bg text-status-open rounded-full">{t('feedbackMgr.markOpen')}</button>
          <button onClick={() => handleBulkStatus('in-progress')} className="px-3 py-1 text-xs font-medium bg-status-progress-bg text-status-progress rounded-full">{t('common.inProgress')}</button>
          <button onClick={() => handleBulkStatus('resolved')} className="px-3 py-1 text-xs font-medium bg-status-resolved-bg text-status-resolved rounded-full">{t('common.resolved')}</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted hover:text-foreground">{t('feedbackMgr.clear')}</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('feedbackMgr.searchPlaceholder')}
            aria-label={t('feedbackMgr.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Filter by status"
            className="px-3 py-2 bg-slate-50 border border-border rounded-lg text-sm text-slate-700 outline-none focus:border-primary cursor-pointer"
          >
            <option value="all">{t('common.allStatuses')}</option>
            <option value="open">{t('common.open')}</option>
            <option value="in-progress">{t('common.inProgress')}</option>
            <option value="resolved">{t('common.resolved')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>
        ) : feedback.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-24 h-24 mx-auto mb-4 text-gray-200" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="15" y="30" width="90" height="65" rx="8" stroke="currentColor" strokeWidth="2" />
              <circle cx="60" cy="55" r="12" stroke="currentColor" strokeWidth="2" opacity="0.4" />
              <path d="M56 55l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
              <line x1="30" y1="78" x2="90" y2="78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
              <line x1="35" y1="85" x2="85" y2="85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
            </svg>
            <p className="text-muted font-medium mb-1">{t('feedbackMgr.noFeedback')}</p>
            <p className="text-sm text-muted">{t('feedbackMgr.noFeedbackHint')}</p>
          </div>
        ) : (
          <FeedbackTable
            feedback={feedback}
            selected={selected}
            onSelectionChange={setSelected}
            onStatusChange={handleStatusChange}
            onViewDetail={handleViewDetail}
          />
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-slate-50/50">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>{t('common.show')}</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                aria-label="Items per page"
                className="px-2 py-1 border border-border rounded-lg text-sm"
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>{t('common.of')} {total}</span>
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

    </div>
  );
}
