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
      className={`z-40 select-none group cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-95' : ''
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-[14px] bg-[#171717] border border-[#404040] hover:border-[#34d399] transition-colors">
        <div className="text-[#737373] group-hover:text-[#a3a3a3] transition-colors shrink-0 -ml-0.5">
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        <div className="w-8 h-8 rounded-[10px] bg-[#022c22] border border-[#064e3b] text-[#34d399] flex items-center justify-center shrink-0">
          <Dumbbell className="w-4 h-4" />
        </div>

        <div className="min-w-0 pr-1">
          <h4 className="text-xs font-semibold text-[#fafafa] tracking-tight leading-none truncate max-w-[125px] sm:max-w-[160px]">
            {workout.name}
          </h4>
          <div className="flex items-center gap-1.5 text-[11px] text-[#a3a3a3] tabular-nums mt-1">
            <span className="flex items-center gap-0.5 text-[#34d399] font-semibold">
              <Clock className="w-3 h-3" />
              {formatDuration(elapsedSeconds)}
            </span>
            <span>·</span>
            <span>{formatWeight(liveVolume, unitPref)}</span>
            {isRestTimerActive && (
              <>
                <span>·</span>
                <span className="text-[#34d399] font-semibold flex items-center gap-0.5">
                  <Timer className="w-3 h-3" />
                  {restRemaining}s
                </span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="ml-0.5 shrink-0 h-9 px-3 rounded-[10px] bg-[#34d399] hover:bg-[#10b981] text-[#0a0a0a] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>{t('workouts.startShort') || t('workouts.start')}</span>
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
