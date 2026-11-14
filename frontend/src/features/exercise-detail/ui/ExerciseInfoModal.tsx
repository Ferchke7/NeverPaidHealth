import React, { useState, useEffect } from 'react';
import { Dumbbell, Play, Pause, Plus, Check } from 'lucide-react';
import { getExerciseVisual } from '../../../shared/lib/exerciseImages.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

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
  const { t } = useTranslation();
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
        <div className="w-10 h-10 rounded-[10px] bg-[#022c22] text-[#34d399] border border-[#064e3b] flex items-center justify-center shrink-0">
          <Dumbbell className="w-4 h-4" />
        </div>
      }
      title={meta.name || exerciseName}
      subtitle={`${meta.primaryMuscles[0] || fallbackMuscle || 'Strength'} • ${meta.equipment ? meta.equipment.replace('_', ' ') : 'Barbell / Dumbbell'}`}
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose}>
            {t('common.close')}
          </Button>

          {canAddToWorkout && onAddToWorkout && (
            <Button
              variant="primary"
              size="md"
              className="flex items-center gap-1.5"
              onClick={() => {
                onAddToWorkout();
                setAdded(true);
                setTimeout(() => setAdded(false), 1500);
              }}
            >
              {added ? (
                <>
                  <Check className="w-4 h-4 text-[#0a0a0a]" />
                  <span>{t('common.saved')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{t('exercises.addToWorkout')}</span>
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
          <div className="relative rounded-[14px] overflow-hidden bg-[#0a0a0a] border border-[#404040] aspect-[4/3] flex items-center justify-center">
            <img
              src={currentImage}
              alt={exerciseName}
              crossOrigin="anonymous"
              className="w-full h-full object-contain p-2 transition-all duration-300"
            />

            {/* Frame Indicator and Controls */}
            {hasMultipleFrames && (
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-[#0a0a0a] px-2.5 py-1 rounded-lg border border-[#404040] text-[11px]">
                <button
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="text-[#a3a3a3] hover:text-[#34d399] flex items-center gap-1 font-medium"
                  title={isAutoPlaying ? t('exercises.pause') : t('exercises.animation')}
                >
                  {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isAutoPlaying ? t('exercises.animation') : t('exercises.pause')}</span>
                </button>
                <span className="text-[#404040]">|</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveFrame(0);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      activeFrame === 0
                        ? 'bg-[#34d399] text-[#0a0a0a]'
                        : 'bg-[#171717] text-[#a3a3a3] hover:text-[#fafafa]'
                    }`}
                  >
                    {t('exercises.startPhase')}
                  </button>
                  <button
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveFrame(1);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      activeFrame === 1
                        ? 'bg-[#34d399] text-[#0a0a0a]'
                        : 'bg-[#171717] text-[#a3a3a3] hover:text-[#fafafa]'
                    }`}
                  >
                    {t('exercises.peakPhase')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[14px] bg-[#0a0a0a] border border-[#262626] h-36 flex flex-col items-center justify-center text-[#a3a3a3] gap-2">
            <Dumbbell className="w-7 h-7 text-[#34d399]" />
            <span className="text-xs">{t('exercises.visualComingSoon')}</span>
          </div>
        )}

        {/* Target Anatomy */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            {t('exercises.targetMuscleGroups')}
          </span>
          <div className="bg-[#0a0a0a] p-3.5 rounded-[12px] border border-[#262626] space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#a3a3a3]">{t('exercises.mainFocus')}</span>
              <div className="flex flex-wrap gap-1.5">
                {meta.primaryMuscles.map((m, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#022c22] text-[#34d399] border border-[#064e3b] capitalize"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {meta.secondaryMuscles && meta.secondaryMuscles.length > 0 && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#262626]">
                <span className="text-xs text-[#a3a3a3]">{t('exercises.synergists')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {meta.secondaryMuscles.map((m, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#171717] border border-[#262626] text-[#fafafa] capitalize"
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
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            {t('exercises.executionTechnique')}
          </span>
          <div className="bg-[#0a0a0a] p-3.5 rounded-[12px] border border-[#262626] space-y-2.5">
            {meta.instructions && meta.instructions.length > 0 ? (
              meta.instructions.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs leading-relaxed">
                  <span className="w-5 h-5 rounded-md bg-[#171717] text-[#34d399] font-semibold flex items-center justify-center shrink-0 text-[11px] border border-[#404040]">
                    {idx + 1}
                  </span>
                  <span className="text-[#fafafa] pt-0.5">{step}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#a3a3a3]">
                {t('exercises.defaultTechniqueTip')}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
