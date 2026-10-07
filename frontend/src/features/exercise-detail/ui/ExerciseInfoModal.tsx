import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, Pause, Plus, Check } from 'lucide-react';
import { getExerciseVisual } from '../../../shared/lib/exerciseImages.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';

interface ExerciseInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  fallbackMuscle?: string;
  onAddToWorkout?: () => void;
  canAddToWorkout?: boolean;
}

export const ExerciseInfoModal: React.FC<ExerciseInfoModalProps> = ({
  isOpen,
  onClose,
  exerciseName,
  fallbackMuscle,
  onAddToWorkout,
  canAddToWorkout = false,
}) => {
  const [activeFrame, setActiveFrame] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [added, setAdded] = useState(false);

  const meta = getExerciseVisual(exerciseName, fallbackMuscle);
  const hasMultipleFrames = meta.images && meta.images.length > 1;

  // Auto-play animation between frame 0 (start) and frame 1 (finish)
  useEffect(() => {
    if (!isOpen || !hasMultipleFrames || !isAutoPlaying) return;

    const interval = setInterval(() => {
      setActiveFrame((prev) => (prev === 0 ? 1 : 0));
    }, 1200);

    return () => clearInterval(interval);
  }, [isOpen, hasMultipleFrames, isAutoPlaying]);

  const currentImage =
    meta.images && meta.images.length > 0 ? meta.images[activeFrame] || meta.images[0] : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      icon={
        <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0">
          <Dumbbell className="w-4 h-4" />
        </div>
      }
      title={meta.name || exerciseName}
      subtitle={`${meta.primaryMuscles[0] || fallbackMuscle || 'Strength'} • ${meta.equipment ? meta.equipment.replace('_', ' ') : 'Barbell / Dumbbell'}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-zinc-400">
            Закрыть
          </Button>

          {canAddToWorkout && onAddToWorkout && (
            <Button
              variant="primary"
              size="sm"
              className="text-xs font-bold flex items-center gap-1.5"
              onClick={() => {
                onAddToWorkout();
                setAdded(true);
                setTimeout(() => setAdded(false), 1500);
              }}
            >
              {added ? (
                <>
                  <Check className="w-3.5 h-3.5 text-black" />
                  <span>Добавлено!</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>В текущую тренировку</span>
                </>
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Animated Illustration Preview Card */}
        {currentImage ? (
          <div className="relative rounded-2xl overflow-hidden bg-black/60 border border-dark-700/80 aspect-[4/3] flex items-center justify-center group shadow-inner">
            <img
              src={currentImage}
              alt={exerciseName}
              crossOrigin="anonymous"
              className="w-full h-full object-contain p-2 transition-all duration-300"
            />

            {/* Frame Indicator and Controls */}
            {hasMultipleFrames && (
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-dark-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-dark-700/80 text-[10px]">
                <button
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="text-zinc-400 hover:text-brand-400 flex items-center gap-1 font-medium"
                  title={isAutoPlaying ? 'Пауза' : 'Воспроизведение'}
                >
                  {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isAutoPlaying ? 'Анимация' : 'Пауза'}</span>
                </button>
                <span className="text-zinc-600">|</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveFrame(0);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      activeFrame === 0
                        ? 'bg-brand-500 text-dark-950'
                        : 'bg-dark-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Старт
                  </button>
                  <button
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveFrame(1);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      activeFrame === 1
                        ? 'bg-brand-500 text-dark-950'
                        : 'bg-dark-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Пик
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-dark-800/60 border border-dark-700/80 h-36 flex flex-col items-center justify-center text-zinc-500 gap-2">
            <Dumbbell className="w-8 h-8 text-brand-400/60" />
            <span className="text-xs">Визуализация скоро появится</span>
          </div>
        )}

        {/* Target Anatomy */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Целевые мышечные группы
          </span>
          <div className="bg-dark-800/80 p-3 rounded-xl border border-dark-700/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Основной фокус:</span>
              <div className="flex flex-wrap gap-1">
                {meta.primaryMuscles.map((m, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 capitalize"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {meta.secondaryMuscles && meta.secondaryMuscles.length > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-dark-700/60">
                <span className="text-xs text-zinc-500">Синергисты / Стабилизаторы:</span>
                <div className="flex flex-wrap gap-1">
                  {meta.secondaryMuscles.map((m, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-dark-700 text-zinc-300 capitalize"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Guide & Execution */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Техника выполнения
          </span>
          <div className="bg-dark-800/40 p-3.5 rounded-xl border border-dark-700/60 space-y-2.5">
            {meta.instructions && meta.instructions.length > 0 ? (
              meta.instructions.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-dark-700 text-brand-400 font-bold flex items-center justify-center shrink-0 text-[10px] border border-dark-600">
                    {idx + 1}
                  </span>
                  <span className="text-zinc-300 pt-0.5">{step}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-400">
                Выполняйте в подконтрольном темпе с акцентом на сокращение в пиковой точке и плавную негативную фазу.
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
