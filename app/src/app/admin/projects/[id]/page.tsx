'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Search, SlidersHorizontal, ArrowUpDown,
} from 'lucide-react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useToast } from '@/components/ui/toast';
import { useTranslation } from '@/lib/i18n/context';
import { Skeleton } from '@/components/ui/skeleton';
import { ScreenCard } from '@/components/admin/project-detail/screen-card';
import {
  AddScreenModal,
  UploadScreenshotModal,
  DeleteScreenModal,
  VersionHistoryModal,
} from '@/components/admin/project-detail/screen-modals';
import type { ProjectDetail, ScreenItem } from '@/lib/types';

export default function AdminProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showAddScreen, setShowAddScreen] = useState(false);
  const [showUpload, setShowUpload] = useState<string | null>(null);
  const [showDeleteScreen, setShowDeleteScreen] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<ScreenItem | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      const data = await res.json();
      setProject(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project');
      toast('Failed to load project', 'error');
    }
  }, [id, toast]);

  useEffect(() => {
    fetchProject().finally(() => setLoading(false));
  }, [fetchProject]);

  const handleAddScreen = async (name: string) => {
    if (!name) return;
    const res = await fetch(`/api/projects/${id}/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      toast(t('toast.screenAdded'), 'success');
      setShowAddScreen(false);
      await fetchProject();
    }
  };

  const handleUpload = async (screenId: string, file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/projects/${id}/screens/${screenId}/screenshots`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        toast(t('toast.screenshotUploaded'), 'success');
        setShowUpload(null);
        await fetchProject();
      } else {
        toast(t('toast.uploadFailed'), 'error');
      }
    } catch {
      // FIX: catch network errors to prevent `uploading` stuck at true
      toast(t('toast.networkError'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteScreen = async (screenId: string) => {
    const res = await fetch(`/api/screens/${screenId}`, { method: 'DELETE' });
    if (res.ok) {
      toast(t('toast.screenDeleted'), 'success');
      setShowDeleteScreen(null);
      await fetchProject();
    }
  };

  const filteredScreens = project?.screens.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

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
        <p className="text-muted">{t('projectDetail.notFound')}</p>
        <button onClick={() => router.push('/admin/projects')} className="mt-2 text-primary text-sm">
          {t('projectDetail.backToProjects')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[
        { label: t('nav.dashboard'), href: '/admin' },
        { label: t('nav.projects'), href: '/admin/projects' },
        { label: project.name },
      ]} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin/projects" className="p-2 rounded-lg hover:bg-gray-100" aria-label="Back to projects">
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-jakarta text-slate-900">{project.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              {project.client_id && (
                <code className="bg-white border border-slate-200 px-2 py-1 rounded text-slate-600 font-mono text-xs flex items-center gap-2">
                  Client ID: {project.client_id}
                </code>
              )}
              {project.slack_channel && (
                <span className="text-sm text-slate-500">Slack: #{project.slack_channel}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowAddScreen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
        >
          <Plus className="w-4 h-4" /> {t('projectDetail.addScreen')}
        </button>
      </div>

      {/* Search / Filter Toolbar */}
      <div className="flex items-center justify-between mb-6 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('projectDetail.searchScreens')}
            aria-label="Search screens"
            className="w-full pl-10 pr-4 py-2 rounded-lg border-none focus:ring-0 text-sm placeholder-slate-400"
          />
        </div>
        <div className="h-6 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-2 px-2">
          <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50" aria-label="Filter options">
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>
          <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50" aria-label="Sort screens">
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Section heading */}
      <p className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">
        {t('projectDetail.projectScreens')}
      </p>

      {project.screens.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <svg className="w-24 h-24 mx-auto mb-4 text-gray-200" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="20" y="20" width="80" height="60" rx="8" stroke="currentColor" strokeWidth="2" />
            <rect x="50" y="80" width="20" height="8" rx="2" fill="currentColor" opacity="0.5" />
            <rect x="40" y="88" width="40" height="4" rx="2" fill="currentColor" opacity="0.3" />
            <line x1="40" y1="45" x2="80" y2="45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            <line x1="45" y1="55" x2="75" y2="55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          </svg>
          <p className="text-muted font-medium mb-1">{t('projectDetail.noScreens')}</p>
          <p className="text-sm text-muted">{t('projectDetail.noScreensHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredScreens.map((s) => (
            <ScreenCard
              key={s.id}
              screen={s}
              onUpload={setShowUpload}
              onHistory={setShowHistory}
              onDelete={setShowDeleteScreen}
            />
          ))}

          {/* Add Screen placeholder card */}
          <button
            onClick={() => setShowAddScreen(true)}
            className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center aspect-[9/16] hover:border-primary hover:bg-indigo-50/10 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
              <Plus className="w-6 h-6 text-slate-400 group-hover:text-primary" />
            </div>
            <span className="text-sm font-medium text-slate-500 group-hover:text-primary">{t('projectDetail.addScreen')}</span>
          </button>
        </div>
      )}

      <AddScreenModal
        open={showAddScreen}
        onClose={() => setShowAddScreen(false)}
        onAdd={handleAddScreen}
      />

      <UploadScreenshotModal
        open={!!showUpload}
        onClose={() => setShowUpload(null)}
        onUpload={(file) => showUpload && handleUpload(showUpload, file)}
        uploading={uploading}
      />

      <DeleteScreenModal
        open={!!showDeleteScreen}
        onClose={() => setShowDeleteScreen(null)}
        onConfirm={() => showDeleteScreen && handleDeleteScreen(showDeleteScreen)}
      />

      <VersionHistoryModal
        screen={showHistory}
        onClose={() => setShowHistory(null)}
      />
    </div>
  );
}
