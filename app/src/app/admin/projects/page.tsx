'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Trash2, Copy, Check, Eye } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useToast } from '@/components/ui/toast';
import { useTranslation } from '@/lib/i18n/context';
import { TableSkeleton } from '@/components/ui/skeleton';
import { CreateProjectModal, DeleteConfirmModal } from '@/components/admin/projects/project-modals';
import type { ProjectListItem } from '@/lib/types';

export default function AdminProjectsPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ login_id: string; initial_password: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(() => {
    fetch('/api/projects')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch projects');
        return r.json();
      })
      .then((data) => { setProjects(data); setError(null); })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch projects');
        toast(t('projects.loadFailed'), 'error');
      })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (projectData: { name: string; slack_channel: string }) => {
    if (!projectData.name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedCreds(data.client_account);
        toast(t('toast.projectCreated'), 'success');
        fetchProjects();
      } else {
        toast(data.error || 'Failed to create', 'error');
      }
    } catch {
      // FIX: catch network errors to prevent `creating` stuck at true
      toast(t('toast.networkError'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast(t('toast.projectDeleted'), 'success');
      setShowDeleteModal(null);
      fetchProjects();
    }
  };

  const handleBulkDelete = async () => {
    const res = await fetch('/api/projects/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    if (res.ok) {
      toast(`${selected.size} project(s) deleted`, 'success');
    } else {
      toast('Failed to delete some projects', 'error');
    }
    setSelected(new Set());
    setShowBulkDeleteModal(false);
    fetchProjects();
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div>
      <Breadcrumb items={[{ label: t('nav.dashboard'), href: '/admin' }, { label: t('nav.projects') }]} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">{t('projects.title')}</h1>
          <p className="text-muted mt-1">{t('projects.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setCreatedCreds(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> {t('projects.newProject')}
        </button>
      </div>

      {/* Search + Actions */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('projects.searchPlaceholder')}
            aria-label="Search projects"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <button
          onClick={() => setShowBulkDeleteModal(true)}
          disabled={selected.size === 0}
          className="flex items-center gap-2 px-3 py-2 text-red-600 bg-red-50 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" /> {t('projects.bulkDelete')}{selected.size > 0 && ` (${selected.size})`}
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={8} /></div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-24 h-24 mx-auto mb-4 text-gray-200" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="25" y="25" width="70" height="55" rx="6" stroke="currentColor" strokeWidth="2" />
              <path d="M25 40h70" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <rect x="35" y="50" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
              <rect x="35" y="58" width="50" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
              <rect x="35" y="66" width="35" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
              <circle cx="60" cy="95" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M57 95h6M60 92v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
            </svg>
            <p className="text-muted font-medium mb-1">{t('projects.noProjects')}</p>
            <p className="text-sm text-muted">{t('projects.noProjectsHint')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(filtered.map((p) => p.id)));
                      else setSelected(new Set());
                    }}
                    aria-label="Select all projects"
                    className="rounded"
                  />
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">{t('projects.colName')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">{t('projects.colSlack')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">{t('projects.colClientId')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">{t('projects.colCreated')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">{t('projects.colScreens')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">{t('projects.colOpenFeedback')}</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">{t('projects.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="group cursor-pointer hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(p.id); else next.delete(p.id);
                        setSelected(next);
                      }}
                      aria-label={`Select ${p.name}`}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/admin/projects/${p.id}`} className="text-sm font-medium text-foreground group-hover:text-primary">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {p.slack_channel ? (
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs">#{p.slack_channel}</span>
                    ) : (
                      <span className="text-sm text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {p.client_id ? (
                      <div className="flex items-center gap-2">
                        <code className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-mono text-xs">{p.client_id}</code>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(p.client_id!, `client-${p.id}`); }}
                          className="text-slate-400 hover:text-slate-600"
                          aria-label={`Copy Client ID ${p.client_id}`}
                        >
                          {copiedField === `client-${p.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">{p.screen_count}</td>
                  <td className="px-6 py-4">
                    {p.open_feedback_count > 0 ? (
                      <span className="inline-flex items-center bg-red-100 text-red-800 rounded-full px-2.5 py-0.5 text-xs font-medium">{p.open_feedback_count} {t('common.open')}</span>
                    ) : (
                      <span className="text-sm text-muted">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="p-2 text-muted hover:text-primary hover:bg-primary-light rounded-lg transition-colors"
                        aria-label={`View ${p.name}`}
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <button
                        onClick={() => setShowDeleteModal(p.id)}
                        className="p-2 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
        creating={creating}
        createdCreds={createdCreds}
      />

      <DeleteConfirmModal
        open={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        onConfirm={() => showDeleteModal && handleDelete(showDeleteModal)}
        message={t('projects.deleteConfirm')}
      />

      <DeleteConfirmModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        message={t('projects.bulkDeleteConfirm', selected.size)}
        confirmLabel={t('projects.deleteAll')}
      />
    </div>
  );
}
