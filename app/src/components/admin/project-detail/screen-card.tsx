'use client';

import Image from 'next/image';
import { Monitor, RefreshCw, Trash2 } from 'lucide-react';
import type { ScreenItem } from '@/lib/types';
import { useTranslation } from '@/lib/i18n/context';

interface ScreenCardProps {
  screen: ScreenItem;
  onUpload: (screenId: string) => void;
  onHistory?: (screen: ScreenItem) => void;
  onDelete: (screenId: string) => void;
}

export function ScreenCard({ screen, onUpload, onDelete }: ScreenCardProps) {
  const { t } = useTranslation();
  return (
    <div className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
      <div className="aspect-[9/16] bg-slate-100 relative">
        {screen.latest_version ? (
          <Image src={screen.latest_version.image_url} alt={screen.name} width={360} height={640} sizes="(max-width: 768px) 100vw, 25vw" className="w-full h-full object-cover" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Monitor className="w-10 h-10" aria-hidden="true" />
          </div>
        )}
        {/* Hover overlay with action buttons */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onUpload(screen.id)}
            className="p-2 bg-white rounded-lg text-slate-700 hover:text-primary"
            title="Update Version"
            aria-label={`Upload new version for ${screen.name}`}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => onDelete(screen.id)}
            className="p-2 bg-white rounded-lg text-slate-700 hover:text-red-600"
            title="Delete"
            aria-label={`Delete ${screen.name}`}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {screen.latest_version && (
          <div className="absolute top-2 left-2">
            <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
              v{screen.latest_version.version}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-slate-100">
        <div className="flex justify-between items-start">
          <h3 className="font-medium text-slate-900 text-sm truncate">{screen.name}</h3>
          {screen.open_feedback_count > 0 && (
            <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
              {screen.open_feedback_count} {t('common.open')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
