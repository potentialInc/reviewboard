'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Monitor, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
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

  const totalOpenFeedback = project.screens.reduce((sum, s) => sum + s.open_feedback_count, 0);

  return (
    <div>
      <Breadcrumb items={[
        { label: 'Projects', href: '/client/projects' },
        { label: project.name },
      ]} />

      <Link
        href="/client/projects"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Projects
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-jakarta text-slate-900">{project.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
            <span>{project.screens.length} {project.screens.length === 1 ? 'Screen' : 'Screens'}</span>
          </div>
        </div>
        {totalOpenFeedback > 0 && (
          <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-sm">
            {totalOpenFeedback} Open Feedbacks
          </span>
        )}
      </div>

      {project.screens.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <Monitor className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No screens yet</h2>
          <p className="text-muted">The admin hasn&apos;t uploaded any screens for this project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {project.screens.map((s) => (
            <Link
              key={s.id}
              href={`/client/projects/${id}/screens/${s.id}`}
              className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group"
            >
              <div className="aspect-[9/16] bg-gray-100 relative overflow-hidden">
                {s.latest_version ? (
                  <Image
                    src={s.latest_version.image_url}
                    alt={s.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <Monitor className="w-12 h-12" />
                  </div>
                )}
                {s.open_feedback_count > 0 && (
                  <div className="absolute top-3 right-3">
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md border border-red-400">
                      {s.open_feedback_count}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="px-4 py-2 bg-white rounded-full text-sm font-semibold text-slate-900 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    View Design
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100 p-4">
                <h3 className="font-medium text-slate-900 truncate group-hover:text-primary transition-colors">{s.name}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {s.latest_version ? `Version ${s.latest_version.version}` : 'No version uploaded'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
