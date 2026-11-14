import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Badge } from '../../../shared/ui/card.tsx';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { ExerciseInfoModal } from '../../exercise-detail/ui/ExerciseInfoModal.tsx';
import { getExerciseVisual } from '../../../shared/lib/exerciseImages.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

export interface RoutineExercise {
  exercise_id?: string;
  exerciseId?: string;
  id?: string;
  exercise_name?: string;
  exerciseName?: string;
  name?: string;
  order_index?: number;
  target_sets?: number;
  targetSets?: number;
  target_reps_min?: number;
  target_reps_max?: number;
  primary_muscle_group?: string;
  primaryMuscle?: string;
}

export interface RoutineDetail {
  id: string;
  name: string;
  notes?: string;
  user_id?: string;
  exercises: RoutineExercise[];
  last_performed?: string;
}

interface RoutineDetailModalProps {
  isOpen: boolean;
  routine: RoutineDetail | null;
  onClose: () => void;
  onStartWorkout: (routine: RoutineDetail) => void;
  onEditRoutine?: (routine: RoutineDetail) => void;
  onCloneToMyRoutines?: (routine: RoutineDetail) => void;
}

export const RoutineDetailModal: React.FC<RoutineDetailModalProps> = ({
  isOpen,
  routine,
  onClose,
  onStartWorkout,
  onEditRoutine,
  onCloneToMyRoutines,
}) => {
  const { t } = useTranslation();
  const [inspectingExercise, setInspectingExercise] = useState<{
    name: string;
    muscle?: string;
  } | null>(null);

  if (!isOpen || !routine) return null;

  const isSystemRoutine =
    !routine.user_id || routine.user_id === '00000000-0000-0000-0000-000000000000';

  const totalExercises = routine.exercises?.length || 0;
  const estimatedDuration = Math.max(15, totalExercises * 8);

  const getExerciseName = (ex: RoutineExercise) =>
    ex.exercise_name || ex.exerciseName || ex.name || 'Exercise';

  const getTargetSets = (ex: RoutineExercise) =>
    ex.target_sets || ex.targetSets || 3;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        title={
          <div className="flex items-center gap-2.5 flex-wrap">
            <span>{routine.name}</span>
            <Badge variant={isSystemRoutine ? 'brand' : 'success'} size="sm">
              {isSystemRoutine ? t('routines.systemLibrary') : t('routines.customRoutines')}
            </Badge>
          </div>
        }
        subtitle={
          routine.last_performed
            ? t('routines.lastPerformed', { date: routine.last_performed })
            : t('routines.neverPerformed')
        }
        footer={
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {onEditRoutine ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  onClose();
                  onEditRoutine(routine);
                }}
              >
                {isSystemRoutine ? t('routines.customize') : t('common.edit')}
              </Button>
            ) : onCloneToMyRoutines ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  onClose();
                  onCloneToMyRoutines(routine);
                }}
              >
                {t('routines.saveToMy')}
              </Button>
            ) : null}

            <Button
              variant="primary"
              size="md"
              onClick={() => {
                onClose();
                onStartWorkout(routine);
              }}
            >
              {t('routines.startWorkout')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {routine.notes && (
            <div className="bg-[#0a0a0a] p-3.5 rounded-[10px] border border-[#262626] text-[13px] text-[#a3a3a3]">
              <span className="font-medium text-[#fafafa] mr-1.5">{t('routines.note')}</span>
              <span>{routine.notes}</span>
            </div>
          )}

          <div className="p-3 bg-[#0a0a0a] rounded-[10px] border border-[#262626] flex items-center justify-between text-[13px] text-[#a3a3a3]">
            <span>{t('routines.exercisesCount', { count: totalExercises })}</span>
            <span>{t('routines.estimatedDuration', { mins: estimatedDuration })}</span>
          </div>

          <div className="divide-y divide-[#262626]">
            {routine.exercises && routine.exercises.length > 0 ? (
              routine.exercises.map((ex, idx) => {
                const exName = getExerciseName(ex);
                const targetSets = getTargetSets(ex);
                const visual = getExerciseVisual(
                  exName,
                  ex.primary_muscle_group || ex.primaryMuscle
                );
                const primaryMuscle = visual.primaryMuscles[0] || 'Strength';

                return (
                  <div
                    key={ex.exercise_id || ex.id || idx}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group"
                  >
                    <button
                      type="button"
                      className="cursor-pointer shrink-0"
                      onClick={() =>
                        setInspectingExercise({
                          name: exName,
                          muscle: primaryMuscle,
                        })
                      }
                      title={t('routines.viewTechnique')}
                    >
                      <ExerciseThumbnail
                        exerciseName={exName}
                        fallbackMuscle={primaryMuscle}
                        size="md"
                        className="rounded-[10px] border border-[#404040]"
                      />
                    </button>

                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left cursor-pointer"
                      onClick={() =>
                        setInspectingExercise({
                          name: exName,
                          muscle: primaryMuscle,
                        })
                      }
                    >
                      <div className="text-[14px] font-medium text-[#fafafa] group-hover:text-[#34d399] transition-colors truncate">
                        {targetSets} × {exName}
                      </div>
                      <div className="text-[12px] text-[#a3a3a3] mt-0.5 flex items-center gap-2">
                        <span>{primaryMuscle}</span>
                        {ex.target_reps_min && (
                          <span>
                            · {ex.target_reps_min}
                            {ex.target_reps_max && ex.target_reps_max !== ex.target_reps_min
                              ? `–${ex.target_reps_max}`
                              : ''}{' '}
                            {t('activeWorkout.reps')}
                          </span>
                        )}
                      </div>
                    </button>

                    <Button
                      isIconOnly
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setInspectingExercise({
                          name: exName,
                          muscle: primaryMuscle,
                        })
                      }
                      title={t('routines.techniqueTooltip')}
                      aria-label={t('routines.techniqueTooltip')}
                    >
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-[13px] text-[#a3a3a3]">
                {t('routines.emptyExercises')}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {inspectingExercise && (
        <ExerciseInfoModal
          isOpen={true}
          onClose={() => setInspectingExercise(null)}
          exerciseName={inspectingExercise.name}
          fallbackMuscle={inspectingExercise.muscle}
        />
      )}
    </>
  );
};
