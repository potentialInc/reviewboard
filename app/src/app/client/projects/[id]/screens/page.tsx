'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Monitor, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { CountBadge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';

interface ScreenItem {
  id: string;
  name: string;
  latest_version?: { image_url: string; version: number };
  open_feedback_count: number;
}

interface ProjectDetail {
  id: string;
  name: string;
  screens: ScreenItem[];
}

export default function ClientScreenListPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to load project');
      const data = await res.json();
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
          <div className="w-40 h-6 bg-gray-200 rounded-lg animate-pulse" />
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
        <h2 className="text-xl font-semibold text-foreground mb-2">Failed to load project</h2>
        <p className="text-muted mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchProject(); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!project) return <p>Project not found</p>;

  return (
    <div>
      <Breadcrumb items={[
        { label: 'Projects', href: '/client/projects' },
        { label: project.name },
      ]} />
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/client/projects"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">{project.name}</h1>
      </div>

      {project.screens.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <Monitor className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No screens yet</h2>
          <p className="text-muted">The admin hasn&apos;t uploaded any screens for this project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {project.screens.map((s) => (
            <Link
              key={s.id}
              href={`/client/projects/${id}/screens/${s.id}`}
              className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all group"
            >
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                {s.latest_version ? (
                  <img
                    src={s.latest_version.image_url}
                    alt={s.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <Monitor className="w-12 h-12" />
                  </div>
                )}
                {s.open_feedback_count > 0 && (
                  <div className="absolute top-3 right-3">
                    <CountBadge count={s.open_feedback_count} variant="danger" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold group-hover:text-primary transition-colors">{s.name}</h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted">
                  <MessageSquare className="w-4 h-4" />
                  <span>{s.open_feedback_count} open feedback</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
