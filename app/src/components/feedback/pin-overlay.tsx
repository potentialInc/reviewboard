'use client';

import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import Image from 'next/image';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Crosshair, Hand } from 'lucide-react';
import type { Comment, FeedbackStatus } from '@/lib/types';
import { useTranslation } from '@/lib/i18n/context';

const statusColors: Record<FeedbackStatus, string> = {
  'open': 'bg-status-open text-white',
  'in-progress': 'bg-status-progress text-white',
  'resolved': 'bg-status-resolved text-white',
};

interface PinOverlayProps {
  comments: Comment[];
  selectedPin: string | null;
  onPinClick: (comment: Comment) => void;
  onImageClick?: (x: number, y: number) => void;
  imageUrl: string;
  readOnly?: boolean;
}

export const PinOverlay = memo(function PinOverlay({ comments, selectedPin, onPinClick, onImageClick, imageUrl, readOnly }: PinOverlayProps) {
  const { t } = useTranslation();
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const [scale, setScale] = useState(1);
  const [pinMode, setPinMode] = useState(false);

  // Toggle pin mode with C key (disabled in readOnly mode)
  useEffect(() => {
    if (readOnly) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'KeyC' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Don't toggle if user is typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        setPinMode(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode || readOnly || !onImageClick) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onImageClick(x, y);
  }, [onImageClick, pinMode, readOnly]);

  return (
    <div className="relative">
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.25}
        maxScale={4}
        centerOnInit
        wheel={{ step: 0.1 }}
        panning={{ disabled: pinMode, velocityDisabled: true }}
        onTransformed={(_, state) => setScale(state.scale)}
      >
        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-auto !h-auto">
          <div
            className={`relative inline-block ${pinMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
            onClick={handleClick}
          >
            <Image
              src={imageUrl}
              alt="Screenshot"
              width={1920}
              height={1080}
              sizes="(max-width: 768px) 100vw, 75vw"
              className="w-auto h-auto block"
              draggable={false}
              priority
              unoptimized
            />
            {comments.map((c) => (
              <button
                key={c.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onPinClick(c);
                }}
                className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg hover:scale-110 ${
                  selectedPin === c.id
                    ? 'ring-2 ring-white ring-offset-2 scale-110'
                    : ''
                } ${statusColors[c.status]} animate-pin-drop`}
                style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)' }}
                title={`#${c.pin_number}: ${c.text.slice(0, 50)}`}
                aria-label={`Pin ${c.pin_number}: ${c.text.slice(0, 30)}`}
              >
                {c.pin_number}
              </button>
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Toolbar */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-border p-1 z-20">
        {/* Mode toggle (hidden in readOnly) */}
        {!readOnly && (
          <>
            <button
              onClick={() => setPinMode(prev => !prev)}
              className={`p-2 rounded-lg transition-colors ${
                pinMode
                  ? 'bg-primary text-white'
                  : 'hover:bg-gray-100 text-slate-600'
              }`}
              aria-label={pinMode ? 'Switch to pan mode' : 'Switch to pin mode'}
              title={pinMode ? t('viewer.panModeKey') : t('viewer.pinModeKey')}
            >
              {pinMode ? <Crosshair className="w-4 h-4" /> : <Hand className="w-4 h-4" />}
            </button>
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
          </>
        )}

        {/* Zoom controls */}
        <button
          onClick={() => transformRef.current?.zoomIn(0.3)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-slate-600" />
        </button>
        <span className="text-xs font-medium text-slate-500 min-w-[3rem] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => transformRef.current?.zoomOut(0.3)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-slate-600" />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-0.5" />
        <button
          onClick={() => transformRef.current?.resetTransform()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Reset zoom"
        >
          <RotateCcw className="w-4 h-4 text-slate-600" />
        </button>
        <button
          onClick={() => transformRef.current?.centerView(1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Fit to screen"
        >
          <Maximize2 className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Mode indicator (hidden in readOnly) */}
      {!readOnly && (
        pinMode ? (
          <div className="absolute top-4 left-4 bg-primary text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg z-20 animate-fade-in flex items-center gap-1.5">
            <Crosshair className="w-3 h-3" />
            {t('viewer.pinModeHint')}
          </div>
        ) : (
          <div className="absolute top-4 left-4 bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg z-20 animate-fade-in flex items-center gap-1.5">
            <Hand className="w-3 h-3" />
            {t('viewer.panModeHint')}
          </div>
        )
      )}
    </div>
  );
});
