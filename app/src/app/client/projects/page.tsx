'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FolderKanban, Monitor, MessageSquare, AlertCircle, RefreshCw, ImageIcon } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useTranslation } from '@/lib/i18n/context';

interface ProjectItem {
  id: string;
  name: string;
  updated_at: string;
  screen_count: number;
  open_feedback_count: number;
}

export default function ClientProjectsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold font-jakarta">{t('clientProjects.title')}</h1>
          <p className="text-muted mt-1">{t('clientProjects.subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-status-open mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('clientProjects.loadFailed')}</h2>
        <p className="text-muted mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchProjects(); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> {t('common.retry')}
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <FolderKanban className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('clientProjects.noProjects')}</h2>
        <p className="text-muted">{t('clientProjects.noProjectsHint')}</p>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: t('nav.projects') }]} />
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-jakarta">{t('clientProjects.title')}</h1>
        <p className="text-muted mt-1">{t('clientProjects.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/client/projects/${p.id}/screens`}
            className="relative overflow-hidden bg-card rounded-2xl border border-border p-6 hover:shadow-xl hover:border-primary/30 transition-all duration-300 group"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-primary flex items-center justify-center">
                <Monitor className="w-6 h-6" />
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200">{t('clientProjects.active')}</span>
            </div>
            <h3 className="text-lg font-bold font-jakarta text-slate-900 group-hover:text-primary transition-colors">{p.name}</h3>
            <div className="flex items-center justify-between mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-400" /> {p.screen_count} {t('clientProjects.screens')}
              </span>
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-400" /> {p.open_feedback_count} {t('clientProjects.openItems')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              {t('clientProjects.updated')} {new Date(p.updated_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
