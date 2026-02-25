'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Trash2, Copy, Check, Eye } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useToast } from '@/components/ui/toast';
import { TableSkeleton } from '@/components/ui/skeleton';

interface ProjectItem {
  id: string;
  name: string;
  client_id: string | null;
  screen_count: number;
  open_feedback_count: number;
  slack_channel: string | null;
  created_at: string;
}

export default function AdminProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ name: '', slack_channel: '' });
  const [createdCreds, setCreatedCreds] = useState<{ login_id: string; password: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = () => {
    fetch('/api/projects')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch projects');
        return r.json();
      })
      .then((data) => { setProjects(data); setError(null); })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch projects');
        toast('Failed to load projects', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newProject.name) return;
    setCreating(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject),
    });
    const data = await res.json();
    if (res.ok) {
      setCreatedCreds(data.client_account);
      toast('Project created!', 'success');
      fetchProjects();
    } else {
      toast(data.error || 'Failed to create', 'error');
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Project deleted', 'success');
      setShowDeleteModal(null);
      fetchProjects();
    }
  };

  const handleBulkDelete = async () => {
    await Promise.all(
      Array.from(selected).map((id) =>
        fetch(`/api/projects/${id}`, { method: 'DELETE' })
      )
    );
    toast(`${selected.size} project(s) deleted`, 'success');
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
      <Breadcrumb items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Projects' }]} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Projects</h1>
          <p className="text-muted mt-1">Manage client projects and access credentials.</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setCreatedCreds(null); setNewProject({ name: '', slack_channel: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Search + Actions */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <button
          onClick={() => setShowBulkDeleteModal(true)}
          disabled={selected.size === 0}
          className="flex items-center gap-2 px-3 py-2 text-red-600 bg-red-50 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" /> Bulk Delete{selected.size > 0 && ` (${selected.size})`}
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={8} /></div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-24 h-24 mx-auto mb-4 text-gray-200" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="25" y="25" width="70" height="55" rx="6" stroke="currentColor" strokeWidth="2" />
              <path d="M25 40h70" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <rect x="35" y="50" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
              <rect x="35" y="58" width="50" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
              <rect x="35" y="66" width="35" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
              <circle cx="60" cy="95" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M57 95h6M60 92v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
            </svg>
            <p className="text-muted font-medium mb-1">No projects found</p>
            <p className="text-sm text-muted">Create a new project to get started.</p>
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
                    className="rounded"
                  />
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Project Name</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Slack Channel</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Client ID</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Created</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Screens</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Open Feedback</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-muted uppercase">Actions</th>
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
                  <td className="px-6 py-4 text-sm text-muted">{p.client_id || '-'}</td>
                  <td className="px-6 py-4 text-sm text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">{p.screen_count}</td>
                  <td className="px-6 py-4">
                    {p.open_feedback_count > 0 ? (
                      <span className="bg-red-100 text-red-800 rounded-full px-2.5 py-0.5 text-xs font-medium">{p.open_feedback_count}</span>
                    ) : (
                      <span className="text-sm text-muted">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="p-2 text-muted hover:text-primary hover:bg-primary-light rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setShowDeleteModal(p.id)}
                        className="p-2 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Project">
        {createdCreds ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">Project created. Share these credentials with the client:</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">Client ID</p>
                  <p className="text-sm font-mono font-medium">{createdCreds.login_id}</p>
                </div>
                <button onClick={() => copyToClipboard(createdCreds.login_id, 'id')} className="p-1.5 hover:bg-gray-200 rounded-lg">
                  {copiedField === 'id' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">Password</p>
                  <p className="text-sm font-mono font-medium">{createdCreds.password}</p>
                </div>
                <button onClick={() => copyToClipboard(createdCreds.password, 'pw')} className="p-1.5 hover:bg-gray-200 rounded-lg">
                  {copiedField === 'pw' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted" />}
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(false)}
              className="w-full py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Project Name *</label>
              <input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Acme Redesign"
                className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Slack Channel (optional)</label>
              <input
                type="text"
                value={newProject.slack_channel}
                onChange={(e) => setNewProject((p) => ({ ...p, slack_channel: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!newProject.name || creating}
              className="w-full py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!showDeleteModal} onClose={() => setShowDeleteModal(null)} title="Delete Project" size="sm">
        <p className="text-sm text-muted mb-4">Are you sure? This will permanently delete the project and all its data.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteModal(null)}
            className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => showDeleteModal && handleDelete(showDeleteModal)}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Bulk delete confirmation */}
      <Modal open={showBulkDeleteModal} onClose={() => setShowBulkDeleteModal(false)} title="Delete Projects" size="sm">
        <p className="text-sm text-muted mb-4">
          Are you sure you want to delete {selected.size} project(s)? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkDeleteModal(false)}
            className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
          >
            Delete All
          </button>
        </div>
      </Modal>
    </div>
  );
}
