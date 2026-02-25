'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FolderKanban, Monitor, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/skeleton';
import { CountBadge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';

interface ProjectItem {
  id: string;
  name: string;
  updated_at: string;
  screen_count: number;
  open_feedback_count: number;
}

export default function ClientProjectsPage() {
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
        <h1 className="text-2xl font-bold mb-6">My Projects</h1>
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
        <h2 className="text-xl font-semibold text-foreground mb-2">Failed to load projects</h2>
        <p className="text-muted mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchProjects(); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <FolderKanban className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No projects assigned yet.</h2>
        <p className="text-muted">Contact your administrator to get access.</p>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Projects' }]} />
      <h1 className="text-2xl font-bold mb-6">My Projects</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/client/projects/${p.id}/screens`}
            className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg hover:border-primary/30 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-primary" />
              </div>
              {p.open_feedback_count > 0 && (
                <CountBadge count={p.open_feedback_count} variant="danger" />
              )}
            </div>
            <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">{p.name}</h3>
            <p className="text-sm text-muted mt-1">
              Updated {new Date(p.updated_at).toLocaleDateString()}
            </p>
            <div className="flex items-center gap-4 mt-4 text-sm text-muted">
              <span className="flex items-center gap-1">
                <Monitor className="w-4 h-4" /> {p.screen_count} screens
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" /> {p.open_feedback_count} open
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
