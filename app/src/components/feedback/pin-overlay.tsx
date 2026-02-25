'use client';

import { memo, useCallback } from 'react';
import Image from 'next/image';
import type { Comment, FeedbackStatus } from '@/lib/types';

const statusColors: Record<FeedbackStatus, string> = {
  'open': 'bg-status-open text-white',
  'in-progress': 'bg-status-progress text-white',
  'resolved': 'bg-status-resolved text-white',
};

interface PinOverlayProps {
  comments: Comment[];
  selectedPin: string | null;
  onPinClick: (comment: Comment) => void;
  onImageClick: (x: number, y: number) => void;
  imageUrl: string;
}

export const PinOverlay = memo(function PinOverlay({ comments, selectedPin, onPinClick, onImageClick, imageUrl }: PinOverlayProps) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onImageClick(x, y);
  }, [onImageClick]);

  return (
    <div className="relative inline-block w-full cursor-crosshair" onClick={handleClick}>
      <Image
        src={imageUrl}
        alt="Screenshot"
        width={1920}
        height={1080}
        sizes="(max-width: 768px) 100vw, 75vw"
        className="w-full h-auto block"
        draggable={false}
        priority
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
  );
});
