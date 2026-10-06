import React, { useState } from 'react';
import {
  X,
  Play,
  HelpCircle,
  Edit3,
  Clock,
  Layers,
  Plus,
  Copy,
  Star,
} from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
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
  isActiveProgram?: boolean;
  onToggleActiveProgram?: (routine: RoutineDetail) => void;
}

export const RoutineDetailModal: React.FC<RoutineDetailModalProps> = ({
  isOpen,
  routine,
  onClose,
  onStartWorkout,
  onEditRoutine,
  onCloneToMyRoutines,
  isActiveProgram = false,
  onToggleActiveProgram,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
        <div className="bg-dark-900 border border-dark-700 w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in-95">
          {/* Top Header */}
          <div className="p-4 border-b border-dark-800 flex items-center justify-between">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center px-2 flex-1 min-w-0">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <h2 className="text-base font-extrabold text-white truncate">{routine.name}</h2>
                {isSystemRoutine ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-brand-500/15 text-brand-400 border border-brand-500/30 shrink-0">
                    Library Template
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                    My Routine
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 flex items-center justify-center gap-1.5 font-medium">
                <span>
                  {routine.last_performed
                    ? `Last Performed: ${routine.last_performed}`
                    : 'Last Performed: Never'}
                </span>
              </div>
            </div>

            {/* Top Right Action: Edit or Customize */}
            {onEditRoutine ? (
              <button
                onClick={() => {
                  onClose();
                  onEditRoutine(routine);
                }}
                className="px-3 py-1.5 rounded-xl bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 font-bold text-xs flex items-center gap-1 border border-brand-500/30 transition-colors"
                title={isSystemRoutine ? "Customize this workout routine" : "Edit workout routine"}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isSystemRoutine ? 'Customize' : 'Edit'}</span>
              </button>
            ) : isSystemRoutine && onCloneToMyRoutines ? (
              <button
                onClick={() => {
                  onClose();
                  onCloneToMyRoutines(routine);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 font-bold text-xs flex items-center gap-1 border border-brand-500/30 transition-colors"
                title="Save a customizable copy to My Routines"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to My</span>
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>

          {/* Routine Notes Banner (if any) */}
          {routine.notes && (
            <div className="bg-dark-800/60 px-4 py-2.5 border-b border-dark-800 text-xs text-zinc-300 italic flex items-center gap-2">
              <span className="text-zinc-500 font-sans not-italic font-semibold">Notes:</span>
              <span>"{routine.notes}"</span>
            </div>
          )}

          {/* Subheader Stats bar */}
          <div className="px-4 py-2 bg-dark-950/40 border-b border-dark-800/80 flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-400" />
              <strong className="text-zinc-200">{totalExercises}</strong> exercises
            </span>

            <div className="flex items-center gap-3">
              {onToggleActiveProgram && (
                <button
                  onClick={() => onToggleActiveProgram(routine)}
                  className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                    isActiveProgram
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-dark-800 text-zinc-400 border-dark-700 hover:text-white'
                  }`}
                >
                  <Star className={`w-3 h-3 ${isActiveProgram ? 'fill-amber-400 text-amber-400' : ''}`} />
                  <span>{isActiveProgram ? 'Active Split' : 'Set as Active'}</span>
                </button>
              )}

              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                ~{estimatedDuration} min
              </span>
            </div>
          </div>

          {/* Exercise Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-dark-800/50">
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
                    {/* Left: Thumbnail */}
                    <div
                      className="cursor-pointer shrink-0"
                      onClick={() =>
                        setInspectingExercise({
                          name: exName,
                          muscle: primaryMuscle,
                        })
                      }
                      title="View exercise form & cues"
                    >
                      <ExerciseThumbnail
                        exerciseName={exName}
                        fallbackMuscle={primaryMuscle}
                        size="md"
                        className="rounded-xl border border-dark-700/80 group-hover:border-brand-500/60 transition-colors shadow-sm"
                      />
                    </div>

                    {/* Middle: Sets count × Exercise Name + Muscle */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() =>
                        setInspectingExercise({
                          name: exName,
                          muscle: primaryMuscle,
                        })
                      }
                    >
                      <div className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors truncate">
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
                              reps
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Help/Info '?' Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setInspectingExercise({
                          name: exName,
                          muscle: primaryMuscle,
                        })
                      }
                      className="w-7 h-7 rounded-full border border-zinc-600/80 text-zinc-400 hover:text-white hover:border-zinc-300 hover:bg-dark-800 flex items-center justify-center transition-all shrink-0"
                      title="Exercise Form & Instructions"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-xs text-zinc-500">
                No exercises found in this routine.
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-dark-800 bg-dark-900/90 shadow-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {onEditRoutine ? (
                <Button
                  variant="outline"
                  size="md"
                  className="font-bold text-xs flex items-center justify-center gap-1.5 border-dark-700 hover:border-brand-500/50 hover:bg-brand-500/10 text-zinc-200 hover:text-white"
                  onClick={() => {
                    onClose();
                    onEditRoutine(routine);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                  <span>{isSystemRoutine ? 'Customize Routine' : 'Edit Routine'}</span>
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
                  <span>Save as My Routine</span>
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
                <span>Start Workout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Inspecting Exercise Modal */}
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
