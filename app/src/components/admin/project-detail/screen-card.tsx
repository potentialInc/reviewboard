'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Monitor, RefreshCw, Trash2 } from 'lucide-react';
import type { ScreenItem } from '@/lib/types';
import { useTranslation } from '@/lib/i18n/context';

interface ScreenCardProps {
  screen: ScreenItem;
  projectId: string;
  onUpload: (screenId: string) => void;
  onHistory?: (screen: ScreenItem) => void;
  onDelete: (screenId: string) => void;
}

export function ScreenCard({ screen, projectId, onUpload, onDelete }: ScreenCardProps) {
  const { t } = useTranslation();
  return (
    <div className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
      <Link href={`/admin/projects/${projectId}/screens/${screen.id}`} className="block aspect-[9/16] bg-slate-100 relative">
        {screen.latest_version ? (
          <Image src={screen.latest_version.image_url} alt={screen.name} width={360} height={640} sizes="(max-width: 768px) 100vw, 25vw" className="w-full h-full object-cover" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Monitor className="w-10 h-10" aria-hidden="true" />
          </div>
        )}
        {/* Hover overlay with action buttons */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <span className="px-4 py-2 bg-white rounded-lg text-slate-900 text-sm font-medium shadow-lg">
            {t('projectDetail.viewFeedback')}
          </span>
        </div>
        {screen.latest_version && (
          <div className="absolute top-2 left-2">
            <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
              v{screen.latest_version.version}
            </span>
          </div>
        )}
        {screen.open_feedback_count > 0 && (
          <div className="absolute top-2 right-2">
            <span className="bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
              {screen.open_feedback_count}
            </span>
          </div>
        )}
      </Link>
      <div className="p-4 border-t border-slate-100">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-slate-900 text-sm truncate flex-1">{screen.name}</h3>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <button
              onClick={(e) => { e.preventDefault(); onUpload(screen.id); }}
              className="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-slate-50 transition-colors"
              title="Update Version"
              aria-label={`Upload new version for ${screen.name}`}
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onDelete(screen.id); }}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete"
              aria-label={`Delete ${screen.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
