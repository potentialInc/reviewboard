'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Save, Plus, Upload, Trash2, Copy, Check, Monitor, History,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useToast } from '@/components/ui/toast';
import { CountBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ScreenItem {
  id: string;
  name: string;
  latest_version?: { image_url: string; version: number };
  open_feedback_count: number;
  screenshot_versions: { id: string; version: number; image_url: string; created_at: string }[];
}

interface ProjectDetail {
  id: string;
  name: string;
  slack_channel: string | null;
  client_id: string | null;
  client_password: string;
  screens: ScreenItem[];
  created_at: string;
}

export default function AdminProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState('');
  const [editSlack, setEditSlack] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showAddScreen, setShowAddScreen] = useState(false);
  const [newScreenName, setNewScreenName] = useState('');
  const [showUpload, setShowUpload] = useState<string | null>(null);
  const [showDeleteScreen, setShowDeleteScreen] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<ScreenItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      const data = await res.json();
      setProject(data);
      setEditName(data.name);
      setEditSlack(data.slack_channel || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project');
      toast('Failed to load project', 'error');
    }
  }, [id, toast]);

  useEffect(() => {
    fetchProject().finally(() => setLoading(false));
  }, [fetchProject]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, slack_channel: editSlack || null }),
    });
    if (res.ok) {
      toast('Project updated', 'success');
      await fetchProject();
    }
    setSaving(false);
  };

  const handleAddScreen = async () => {
    if (!newScreenName) return;
    const res = await fetch(`/api/projects/${id}/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newScreenName }),
    });
    if (res.ok) {
      toast('Screen added', 'success');
      setShowAddScreen(false);
      setNewScreenName('');
      await fetchProject();
    }
  };

  const handleUpload = async (screenId: string, file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/projects/${id}/screens/${screenId}/screenshots`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      toast('Screenshot uploaded', 'success');
      setShowUpload(null);
      await fetchProject();
    } else {
      toast('Upload failed', 'error');
    }
    setUploading(false);
  };

  const handleDeleteScreen = async (screenId: string) => {
    const res = await fetch(`/api/screens/${screenId}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Screen deleted', 'success');
      setShowDeleteScreen(null);
      await fetchProject();
    }
  };

  const copyUrl = () => {
    const url = `${window.location.origin}/login`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">Project not found</p>
        <button onClick={() => router.push('/admin/projects')} className="mt-2 text-primary text-sm">
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/admin' },
        { label: 'Projects', href: '/admin/projects' },
        { label: project.name },
      ]} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/projects" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Project Detail</h1>
      </div>

      {/* Project info */}
      <div className="bg-card rounded-2xl border border-border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">Project Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Slack Channel</label>
            <input
              type="text"
              value={editSlack}
              onChange={(e) => setEditSlack(e.target.value)}
              placeholder="Webhook URL"
              className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="flex-1">
            <p className="text-xs text-muted">Client ID</p>
            <p className="text-sm font-mono font-medium">{project.client_id || '-'}</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted">Password</p>
            <p className="text-sm font-mono font-medium">{project.client_password}</p>
          </div>
          <button onClick={copyUrl} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-gray-100">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            Copy URL
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Screens */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Screens ({project.screens.length})</h2>
        <button
          onClick={() => setShowAddScreen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover"
        >
          <Plus className="w-4 h-4" /> Add Screen
        </button>
      </div>

      {project.screens.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <svg className="w-24 h-24 mx-auto mb-4 text-gray-200" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="20" width="80" height="60" rx="8" stroke="currentColor" strokeWidth="2" />
            <rect x="50" y="80" width="20" height="8" rx="2" fill="currentColor" opacity="0.5" />
            <rect x="40" y="88" width="40" height="4" rx="2" fill="currentColor" opacity="0.3" />
            <line x1="40" y1="45" x2="80" y2="45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            <line x1="45" y1="55" x2="75" y2="55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          </svg>
          <p className="text-muted font-medium mb-1">No screens yet</p>
          <p className="text-sm text-muted">Add a screen to start collecting feedback.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {project.screens.map((s) => (
            <div key={s.id} className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="aspect-video bg-gray-100 relative">
                {s.latest_version ? (
                  <Image src={s.latest_version.image_url} alt={s.name} width={640} height={360} sizes="(max-width: 768px) 100vw, 33vw" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <Monitor className="w-10 h-10" />
                  </div>
                )}
                {s.latest_version && (
                  <span className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                    v{s.latest_version.version}
                  </span>
                )}
                {s.open_feedback_count > 0 && (
                  <div className="absolute top-2 right-2">
                    <CountBadge count={s.open_feedback_count} variant="danger" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold mb-3">{s.name}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowUpload(s.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-primary bg-primary-light rounded-lg hover:bg-indigo-100"
                  >
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                  {s.screenshot_versions.length > 1 && (
                    <button
                      onClick={() => setShowHistory(s)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-muted bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <History className="w-3 h-3" /> History
                    </button>
                  )}
                  <button
                    onClick={() => setShowDeleteScreen(s.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100 ml-auto"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Screen Modal */}
      <Modal open={showAddScreen} onClose={() => setShowAddScreen(false)} title="Add Screen" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Screen Name</label>
            <input
              type="text"
              value={newScreenName}
              onChange={(e) => setNewScreenName(e.target.value)}
              placeholder="e.g. Login Page"
              className="w-full px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
          <button
            onClick={handleAddScreen}
            disabled={!newScreenName}
            className="w-full py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
          >
            Add Screen
          </button>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal open={!!showUpload} onClose={() => { setShowUpload(null); setDragging(false); }} title="Upload Screenshot" size="sm">
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && showUpload && file.type.startsWith('image/')) {
                handleUpload(showUpload, file);
              }
            }}
          >
            <Upload className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-muted mb-3">
              {dragging ? 'Drop image here' : 'Drag & drop or click to select'}
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && showUpload) handleUpload(showUpload, file);
              }}
              className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-hover"
            />
          </div>
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Uploading...
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Screen Modal */}
      <Modal open={!!showDeleteScreen} onClose={() => setShowDeleteScreen(null)} title="Delete Screen" size="sm">
        <p className="text-sm text-muted mb-4">This will delete the screen and all its screenshots and feedback.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteScreen(null)} className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => showDeleteScreen && handleDeleteScreen(showDeleteScreen)}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Version History Modal */}
      <Modal open={!!showHistory} onClose={() => setShowHistory(null)} title={`Version History — ${showHistory?.name}`}>
        <div className="grid grid-cols-2 gap-4">
          {showHistory?.screenshot_versions
            .sort((a, b) => b.version - a.version)
            .map((v) => (
              <div key={v.id} className="border border-border rounded-xl overflow-hidden">
                <Image src={v.image_url} alt={`v${v.version}`} width={640} height={360} sizes="50vw" className="w-full aspect-video object-cover" />
                <div className="p-2 flex items-center justify-between">
                  <span className="text-sm font-medium">v{v.version}</span>
                  <span className="text-xs text-muted">{new Date(v.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
        </div>
      </Modal>
    </div>
  );
}
