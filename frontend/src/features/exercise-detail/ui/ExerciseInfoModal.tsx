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
        <div className="w-10 h-10 rounded-[12px] bg-[#F0EFFE] text-[#6D28D9] border border-[#DDD6FE] flex items-center justify-center shrink-0">
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
                  <Check className="w-4 h-4 text-white" />
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
          <div className="relative rounded-[16px] overflow-hidden bg-[#F8F7FC] border border-[#ECEAF6] aspect-[4/3] flex items-center justify-center">
            <img
              src={currentImage}
              alt={exerciseName}
              crossOrigin="anonymous"
              className="w-full h-full object-contain p-2 transition-all duration-300"
            />

            {/* Frame Indicator and Controls */}
            {hasMultipleFrames && (
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-xl border border-[#ECEAF6] shadow-xs text-[11px]">
                <button
                  onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                  className="text-[#6B7280] hover:text-[#6D28D9] flex items-center gap-1 font-medium cursor-pointer"
                  title={isAutoPlaying ? t('exercises.pause') : t('exercises.animation')}
                >
                  {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isAutoPlaying ? t('exercises.animation') : t('exercises.pause')}</span>
                </button>
                <span className="text-[#ECEAF6]">|</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveFrame(0);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                      activeFrame === 0
                        ? 'bg-[#6D28D9] text-white'
                        : 'bg-[#F4F3FA] text-[#6B7280] hover:text-[#1E1B4B]'
                    }`}
                  >
                    {t('exercises.startPhase')}
                  </button>
                  <button
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveFrame(1);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                      activeFrame === 1
                        ? 'bg-[#6D28D9] text-white'
                        : 'bg-[#F4F3FA] text-[#6B7280] hover:text-[#1E1B4B]'
                    }`}
                  >
                    {t('exercises.peakPhase')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[16px] bg-[#F8F7FC] border border-[#ECEAF6] h-36 flex flex-col items-center justify-center text-[#6B7280] gap-2">
            <Dumbbell className="w-7 h-7 text-[#6D28D9]" />
            <span className="text-xs">{t('exercises.visualComingSoon')}</span>
          </div>
        )}

        {/* Target Anatomy */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
            {t('exercises.targetMuscleGroups')}
          </span>
          <div className="bg-[#F8F7FC] p-3.5 rounded-[14px] border border-[#ECEAF6] space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#6B7280]">{t('exercises.mainFocus')}</span>
              <div className="flex flex-wrap gap-1.5">
                {meta.primaryMuscles.map((m, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#F0EFFE] text-[#6D28D9] border border-[#DDD6FE] capitalize"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {meta.secondaryMuscles && meta.secondaryMuscles.length > 0 && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#ECEAF6]">
                <span className="text-xs text-[#6B7280]">{t('exercises.synergists')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {meta.secondaryMuscles.map((m, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-[#ECEAF6] text-[#1E1B4B] capitalize"
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
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
            {t('exercises.executionTechnique')}
          </span>
          <div className="bg-[#F8F7FC] p-3.5 rounded-[14px] border border-[#ECEAF6] space-y-2.5">
            {meta.instructions && meta.instructions.length > 0 ? (
              meta.instructions.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs leading-relaxed">
                  <span className="w-5 h-5 rounded-md bg-[#F0EFFE] text-[#6D28D9] font-semibold flex items-center justify-center shrink-0 text-[11px] border border-[#DDD6FE]">
                    {idx + 1}
                  </span>
                  <span className="text-[#1E1B4B] pt-0.5">{step}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#6B7280]">
                {t('exercises.defaultTechniqueTip')}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
