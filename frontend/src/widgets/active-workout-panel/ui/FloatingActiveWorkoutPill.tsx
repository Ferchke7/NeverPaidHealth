import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dumbbell,
  Clock,
  Timer,
  GripVertical,
  Maximize2,
} from 'lucide-react';
import { formatDuration } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { ActiveWorkout } from '../../../entities/workout/model/types.ts';

interface FloatingActiveWorkoutPillProps {
  workout: ActiveWorkout;
  elapsedSeconds: number;
  liveVolume: number;
  unitPref: 'kg' | 'lb' | 'metric' | 'imperial';
  isRestTimerActive: boolean;
  restRemaining: number;
  onOpen: () => void;
  t: (key: string, params?: any) => string;
}

const STORAGE_KEY = 'neverpaid_floating_workout_pos';

export const FloatingActiveWorkoutPill: React.FC<FloatingActiveWorkoutPillProps> = ({
  workout,
  elapsedSeconds,
  liveVolume,
  unitPref,
  isRestTimerActive,
  restRemaining,
  onOpen,
  t,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  });

  // Calculate default position (bottom right, above bottom nav bar)
  const getDefaultPosition = useCallback(() => {
    const width = 270;
    const height = 52;
    const padding = 16;
    const bottomNavOffset = 80; // height + safe area of bottom nav

    const x = Math.max(padding, window.innerWidth - width - padding);
    const y = Math.max(padding, window.innerHeight - height - bottomNavOffset);
    return { x, y };
  }, []);

  // Initialize position from localStorage or default
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed?.x === 'number' &&
          typeof parsed?.y === 'number' &&
          parsed.x < window.innerWidth &&
          parsed.y < window.innerHeight
        ) {
          // Clamp to current screen bounds
          const width = containerRef.current?.offsetWidth || 270;
          const height = containerRef.current?.offsetHeight || 52;
          const clampedX = Math.max(8, Math.min(window.innerWidth - width - 8, parsed.x));
          const clampedY = Math.max(8, Math.min(window.innerHeight - height - 60, parsed.y));
          setPosition({ x: clampedX, y: clampedY });
          return;
        }
      }
    } catch {
      // ignore JSON parse error
    }

    setPosition(getDefaultPosition());
  }, [getDefaultPosition]);

  // Adjust position on window resize/orientation change
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return getDefaultPosition();
        const width = containerRef.current?.offsetWidth || 270;
        const height = containerRef.current?.offsetHeight || 52;
        const clampedX = Math.max(8, Math.min(window.innerWidth - width - 8, prev.x));
        const clampedY = Math.max(8, Math.min(window.innerHeight - height - 60, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [getDefaultPosition]);

  // Pointer event handlers for fluid dragging across mouse & touch
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to main click / touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const currentX = position?.x ?? getDefaultPosition().x;
    const currentY = position?.y ?? getDefaultPosition().y;

    dragInfoRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY,
      hasMoved: false,
    };

    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const dx = e.clientX - dragInfoRef.current.startX;
    const dy = e.clientY - dragInfoRef.current.startY;

    if (!dragInfoRef.current.hasMoved && Math.hypot(dx, dy) > 5) {
      dragInfoRef.current.hasMoved = true;
    }

    if (dragInfoRef.current.hasMoved) {
      const width = containerRef.current?.offsetWidth || 270;
      const height = containerRef.current?.offsetHeight || 52;

      const newX = dragInfoRef.current.initialX + dx;
      const newY = dragInfoRef.current.initialY + dy;

      const clampedX = Math.max(8, Math.min(window.innerWidth - width - 8, newX));
      const clampedY = Math.max(8, Math.min(window.innerHeight - height - 60, newY));

      setPosition({ x: clampedX, y: clampedY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was lost
    }

    if (dragInfoRef.current.hasMoved) {
      // Save position to localStorage
      if (position) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
        } catch {
          // ignore
        }
      }
    } else {
      // It was a tap/click -> Open sheet
      onOpen();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  if (!position) return null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      className={`z-40 select-none group cursor-grab active:cursor-grabbing transition-shadow duration-200 ${
        isDragging ? 'scale-[1.03] shadow-brand-500/30 ring-2 ring-brand-500/60' : 'hover:scale-[1.02]'
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-dark-900/95 backdrop-blur-xl border border-brand-500/40 shadow-2xl shadow-black/80 hover:border-brand-400 transition-colors">
        {/* Grip Handle for visual drag cue */}
        <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 -ml-1">
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Pulsing Dumbbell Badge */}
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/40 text-brand-400 flex items-center justify-center font-bold shadow-sm shadow-brand-500/10">
            <Dumbbell className="w-4 h-4 animate-pulse" />
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-dark-900 animate-ping" />
        </div>

        {/* Info text */}
        <div className="min-w-0 pr-1">
          <h4 className="text-[12px] font-extrabold text-white tracking-tight leading-none truncate max-w-[125px] sm:max-w-[160px]">
            {workout.name}
          </h4>
          <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-400 font-mono mt-0.5">
            <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
              <Clock className="w-3 h-3" />
              {formatDuration(elapsedSeconds)}
            </span>
            <span>•</span>
            <span className="text-zinc-300">{formatWeight(liveVolume, unitPref)}</span>
            {isRestTimerActive && (
              <>
                <span>•</span>
                <span className="text-amber-400 font-bold flex items-center gap-0.5 animate-pulse">
                  <Timer className="w-2.5 h-2.5" />
                  {restRemaining}s
                </span>
              </>
            )}
          </div>
        </div>

        {/* Expand Action Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="ml-0.5 shrink-0 px-2.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 font-black text-[11px] flex items-center gap-1 shadow-md shadow-brand-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <span>{t('workouts.start')}</span>
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
