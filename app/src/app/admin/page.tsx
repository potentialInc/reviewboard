'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderKanban, MessageSquare, Clock, TrendingUp, Plus } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { formatDistanceToNow } from 'date-fns';

interface DashboardData {
  stats: {
    total_projects: number;
    total_open_feedback: number;
    feedback_today: number;
    feedback_this_week: number;
  };
  recent_activity: {
    id: string;
    comment: string;
    pin_number: number;
    status: 'open' | 'in-progress' | 'resolved';
    created_at: string;
    screen_name: string;
    project_name: string;
  }[];
}

const statCards = [
  {
    key: 'total_projects',
    label: 'Total Projects',
    icon: FolderKanban,
    iconColor: 'text-primary bg-primary-light',
    numberColor: '',
    trend: 'All time',
  },
  {
    key: 'total_open_feedback',
    label: 'Open Feedback',
    icon: MessageSquare,
    iconColor: 'text-red-500 bg-red-50',
    numberColor: 'text-red-500',
    trend: 'Needs attention',
  },
  {
    key: 'feedback_today',
    label: 'Today',
    icon: Clock,
    iconColor: 'text-purple-600 bg-purple-50',
    numberColor: '',
    trend: 'Last 24 hours',
  },
  {
    key: 'feedback_this_week',
    label: 'This Week',
    icon: TrendingUp,
    iconColor: 'text-green-500 bg-green-50',
    numberColor: 'text-green-500',
    trend: 'Last 7 days',
  },
] as const;

export default function AdminDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch dashboard data');
        return r.json();
      })
      .then((d) => { setData(d); setError(null); })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
        toast('Failed to load dashboard', 'error');
      })
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard' }]} />

      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold font-jakarta text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of all active projects and feedback status.</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-hover"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statCards.map(({ key, label, icon: Icon, iconColor, numberColor, trend }) => (
          <div key={key} className="bg-card rounded-2xl border border-border shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <span className="text-sm font-medium text-muted">{label}</span>
              <div className={`p-2 rounded-lg flex items-center justify-center ${iconColor}`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <p className={`text-3xl font-bold font-jakarta ${numberColor}`}>
                {data?.stats[key] ?? 0}
              </p>
            )}
            <p className="text-xs text-muted mt-1">{trend}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-card rounded-2xl border border-border shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold font-jakarta text-slate-900">Recent Activity</h2>
          <Link href="/admin/feedback" className="text-sm text-primary font-medium hover:underline">
            View All
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : data?.recent_activity.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted">
              No recent activity
            </div>
          ) : (
            data?.recent_activity.map((item) => (
              <Link
                key={item.id}
                href="/admin/feedback"
                className="flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center text-xs font-bold">
                  #{item.pin_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.project_name} &gt; {item.screen_name}
                  </p>
                  <p className="text-sm text-muted truncate mt-0.5">{item.comment}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-muted">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
