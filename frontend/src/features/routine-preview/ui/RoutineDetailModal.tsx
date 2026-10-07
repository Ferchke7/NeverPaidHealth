import React, { useState } from 'react';
import { Play, HelpCircle, Edit3, Clock, Layers, Copy } from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Badge } from '../../../shared/ui/card.tsx';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { ExerciseInfoModal } from '../../exercise-detail/ui/ExerciseInfoModal.tsx';
import { getExerciseVisual } from '../../../shared/lib/exerciseImages.ts';

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
          <div className="flex items-center gap-2 flex-wrap">
            <span>{routine.name}</span>
            <Badge variant={isSystemRoutine ? 'brand' : 'success'} size="sm">
              {isSystemRoutine ? 'Библиотека' : 'Моя программа'}
            </Badge>
          </div>
        }
        subtitle={
          routine.last_performed
            ? `Выполнялась: ${routine.last_performed}`
            : 'Еще не выполнялась'
        }
        footer={
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
            {onEditRoutine ? (
              <Button
                variant="outline"
                size="md"
                className="font-bold text-xs flex items-center justify-center gap-1.5"
                onClick={() => {
                  onClose();
                  onEditRoutine(routine);
                }}
              >
                <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                <span>{isSystemRoutine ? 'Настроить под себя' : 'Редактировать'}</span>
              </Button>
            ) : onCloneToMyRoutines ? (
              <Button
                variant="outline"
                size="md"
                className="font-bold text-xs flex items-center justify-center gap-1.5"
                onClick={() => {
                  onClose();
                  onCloneToMyRoutines(routine);
                }}
              >
                <Copy className="w-3.5 h-3.5 text-brand-400" />
                <span>Сохранить в мои</span>
              </Button>
            ) : null}

            <Button
              variant="primary"
              size="md"
              className="font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
              onClick={() => {
                onClose();
                onStartWorkout(routine);
              }}
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Начать тренировку</span>
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Notes */}
          {routine.notes && (
            <div className="bg-dark-800/80 p-3 rounded-xl border border-dark-700/80 text-xs text-zinc-300 italic flex items-center gap-2">
              <span className="text-zinc-500 font-sans not-italic font-semibold">Заметка:</span>
              <span>"{routine.notes}"</span>
            </div>
          )}

          {/* Subheader Stats bar */}
          <div className="p-3 bg-dark-900/80 rounded-xl border border-dark-750 flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-400" />
              <strong className="text-zinc-200">{totalExercises}</strong> упражнений
            </span>

            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              ~{estimatedDuration} минут
            </span>
          </div>

          {/* Exercise Items List */}
          <div className="space-y-2 divide-y divide-dark-750">
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
                    className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group"
                  >
                    <div
                      className="cursor-pointer shrink-0"
                      onClick={() =>
                        setInspectingExercise({
                          name: exName,
                          muscle: primaryMuscle,
                        })
                      }
                      title="Посмотреть технику"
                    >
                      <ExerciseThumbnail
                        exerciseName={exName}
                        fallbackMuscle={primaryMuscle}
                        size="md"
                        className="rounded-xl border border-dark-700/80 group-hover:border-brand-500/60 transition-colors shadow-sm"
                      />
                    </div>

                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() =>
                        setInspectingExercise({
                          name: exName,
                          muscle: primaryMuscle,
                        })
                      }
                    >
                      <div className="text-sm font-bold text-zinc-100 group-hover:text-brand-400 transition-colors truncate">
                        <span className="text-brand-400 font-extrabold mr-1.5">
                          {targetSets} ×
                        </span>
                        <span>{exName}</span>
                      </div>
                      <div className="text-xs text-zinc-400 capitalize mt-0.5 flex items-center gap-2">
                        <span className="text-zinc-300 font-medium">{primaryMuscle}</span>
                        {ex.target_reps_min && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-400 font-mono text-[11px]">
                              {ex.target_reps_min}
                              {ex.target_reps_max && ex.target_reps_max !== ex.target_reps_min
                                ? `-${ex.target_reps_max}`
                                : ''}{' '}
                              повт.
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setInspectingExercise({
                          name: exName,
                          muscle: primaryMuscle,
                        })
                      }
                      className="w-8 h-8 rounded-xl border border-dark-700 text-zinc-400 hover:text-white hover:border-dark-600 hover:bg-dark-800 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                      title="Техника упражнения"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-xs text-zinc-500">
                В этой программе пока нет упражнений.
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
