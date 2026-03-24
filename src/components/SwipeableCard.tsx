import { useState, useRef } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableCardProps {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  isOpen: boolean;
  onSwipeOpen: () => void;
}

export default function SwipeableCard({ children, onEdit, onDelete, isOpen, onSwipeOpen }: SwipeableCardProps) {
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offset, setOffset] = useState(0);
  const swiping = useRef(false);

  const THRESHOLD = 60;
  const BUTTON_WIDTH = 120;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    swiping.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping.current) return;
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    const base = isOpen ? BUTTON_WIDTH : 0;
    const newOffset = Math.max(0, Math.min(BUTTON_WIDTH, base + diff));
    setOffset(newOffset);
  };

  const handleTouchEnd = () => {
    swiping.current = false;
    if (offset > THRESHOLD) {
      setOffset(BUTTON_WIDTH);
      onSwipeOpen();
    } else {
      setOffset(0);
    }
  };

  // Sync with external isOpen state
  const displayOffset = isOpen ? (offset || BUTTON_WIDTH) : offset;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action buttons behind */}
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch" style={{ width: BUTTON_WIDTH }}>
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center bg-accent text-accent-foreground active:opacity-80"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center bg-destructive text-destructive-foreground active:opacity-80"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Card content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-card border border-border rounded-xl transition-transform"
        style={{ transform: `translateX(-${displayOffset}px)`, transitionDuration: swiping.current ? '0ms' : '200ms' }}
      >
        {children}
      </div>
    </div>
  );
}
