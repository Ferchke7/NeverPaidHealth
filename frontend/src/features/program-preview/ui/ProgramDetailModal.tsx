import React, { useState } from 'react';
import {
  Play,
  HelpCircle,
  Edit3,
  Calendar,
  Layers,
  Check,
  Users,
  Award,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Badge } from '../../../shared/ui/card.tsx';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { ExerciseInfoModal } from '../../exercise-detail/ui/ExerciseInfoModal.tsx';
import { getExerciseVisual } from '../../../shared/lib/exerciseImages.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { Program, ProgramDay, ProgramDayExercise } from '../../../entities/program/model/types.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { ActiveExercise, ActiveSet } from '../../../entities/workout/model/types.ts';

interface ProgramDetailModalProps {
  isOpen: boolean;
  program: Program | null;
  onClose: () => void;
  isActiveProgram?: boolean;
  isInstalled?: boolean;
  onEditProgram?: (program: Program) => void;
  onProgramInstalled?: () => void;
}

export const ProgramDetailModal: React.FC<ProgramDetailModalProps> = ({
  isOpen,
  program,
  onClose,
  isActiveProgram = false,
  isInstalled = false,
  onEditProgram,
  onProgramInstalled,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [inspectingExercise, setInspectingExercise] = useState<{
    name: string;
    muscle?: string;
  } | null>(null);

  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

  const installMutation = useMutation({
    mutationFn: async ({ setActive }: { setActive: boolean }) => {
      if (!program) return;
      return apiClient(`/programs/${program.id}/install`, {
        method: 'POST',
        body: JSON.stringify({ set_active: setActive }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'installed'] });
      if (onProgramInstalled) {
        onProgramInstalled();
      }
    },
  });

  if (!isOpen || !program) return null;

  const days: ProgramDay[] = program.days || [];
  const currentDay: ProgramDay | undefined = days[selectedDayIndex] || days[0];

  const handleStartDayWorkout = async (day: ProgramDay) => {
    if (activeWorkout) {
      const hasCompletedSets = activeWorkout.exercises.some((e) =>
        e.sets.some((s) => s.completed)
      );
      if (hasCompletedSets) {
        const confirmed = window.confirm(
          `You have an active workout in progress ("${activeWorkout.name}"). Discard it and start "${day.name}"?`
        );
        if (!confirmed) {
          openSheet();
          return;
        }
      }
    }

    const initialExercises: ActiveExercise[] = (day.exercises || []).map((ex: ProgramDayExercise, idx: number) => {
      const exerciseId =
        ex.exercise_id && ex.exercise_id !== '00000000-0000-0000-0000-000000000000'
          ? ex.exercise_id
          : `ex-${idx}-${generateUUID()}`;
      const setsCount = Math.max(1, ex.target_sets || 3);
      const defaultReps = ex.target_reps_min || 10;
      const sets: ActiveSet[] = Array.from({ length: setsCount }, (_, i) => ({
        id: generateUUID(),
        setNumber: i + 1,
        setType: 'normal',
        weightKg: 0,
        reps: defaultReps,
        completed: false,
      }));

      return {
        exerciseId,
        exerciseName: ex.exercise_name || `Exercise ${idx + 1}`,
        measurementType: 'weight_reps',
        sets,
      };
    });

    const tempId = generateUUID();
    const workoutTitle = `${program.name} - ${day.name}`;
    startWorkout(tempId, workoutTitle, undefined, initialExercises);
    onClose();
    openSheet();

    try {
      const res = await apiClient<{ id: string; name: string }>('/workouts', {
        method: 'POST',
        body: JSON.stringify({ name: workoutTitle }),
      });
      if (res && res.id && res.id !== tempId) {
        const current = useActiveWorkoutStore.getState().workout;
        if (current && current.id === tempId) {
          useActiveWorkoutStore.setState({ workout: { ...current, id: res.id } });
        }
      }
    } catch (err) {
      console.warn('Backend start day workout sync:', err);
    }
  };

  const getSplitLabel = (type: string) => {
    switch (type) {
      case 'ppl':
        return t('programs.splitPpl');
      case 'upper_lower':
        return t('programs.splitUpperLower');
      case 'full_body':
        return t('programs.splitFullBody');
      case 'bro_split':
        return t('programs.splitBroSplit');
      default:
        return t('programs.splitCustom');
    }
  };

  const getLevelLabel = (lvl: string) => {
    switch (lvl) {
      case 'beginner':
        return t('programs.levelBeginner');
      case 'advanced':
        return t('programs.levelAdvanced');
      default:
        return t('programs.levelIntermediate');
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-white">{program.name}</span>
            <Badge variant="brand" size="sm">
              {getSplitLabel(program.split_type)}
            </Badge>
            <Badge variant="neutral" size="sm">
              {getLevelLabel(program.level)}
            </Badge>
            {isActiveProgram && (
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                {t('programs.activeSplit')}
              </span>
            )}
          </div>
        }
        subtitle={
          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
            <span>
              {program.author_name ? t('programs.byAuthor', { author: program.author_name }) : t('programs.officialSplit')}
            </span>
            <span>•</span>
            <span>{t('programs.daysPerWeekCount', { count: program.days_per_week || days.length })}</span>
            {program.installs_count > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <Users className="w-3 h-3 text-zinc-500" />
                  {program.installs_count}
                </span>
              </>
            )}
          </div>
        }
        footer={
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              {onEditProgram && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold text-xs flex items-center justify-center gap-1.5"
                  onClick={() => {
                    onClose();
                    onEditProgram(program);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                  <span>{t('common.edit')}</span>
                </Button>
              )}

              {!isActiveProgram && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={installMutation.isPending}
                  className="font-bold text-xs flex items-center justify-center gap-1.5 border-brand-500/30 text-brand-400 hover:bg-brand-500/10"
                  onClick={() => installMutation.mutate({ setActive: true })}
                >
                  <Award className="w-3.5 h-3.5 text-brand-400" />
                  <span>{isInstalled ? t('programs.setActiveProgram') : t('programs.installAndSetActive')}</span>
                </Button>
              )}
            </div>

            {currentDay && (
              <Button
                variant="primary"
                size="sm"
                className="font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                onClick={() => handleStartDayWorkout(currentDay)}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {t('programs.startDayWorkout', {
                    day: currentDay.name || `${t('programs.dayShort')} ${selectedDayIndex + 1}`,
                  })}
                </span>
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* Program Description */}
          {program.description && (
            <div className="bg-dark-800/80 p-3 rounded-xl border border-dark-700/80 text-xs text-zinc-300 italic flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <p className="not-italic">{program.description}</p>
            </div>
          )}

          {/* Days Tabs Header */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-400" />
                <span>{t('programs.splitDaysOverview')}</span>
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {days.length} {t('programs.daysCount')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {days.map((d, idx) => {
                const isSelected = idx === selectedDayIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayIndex(idx)}
                    className={`text-xs px-3.5 py-2 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                      isSelected
                        ? 'bg-dark-700 text-brand-400 border border-brand-500/50 font-bold shadow-md'
                        : 'bg-dark-900 text-zinc-400 hover:text-zinc-200 hover:bg-dark-800 border border-dark-800'
                    }`}
                  >
                    <span className="font-mono text-brand-400">#{idx + 1}</span>
                    <span className="truncate max-w-[140px]">{d.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ({d.exercises?.length || 0})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Day Exercise List */}
          {currentDay && (
            <div className="bg-dark-900/90 border border-dark-750 p-4 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-dark-800 pb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-brand-400 font-mono">Day {selectedDayIndex + 1}:</span>
                    <span>{currentDay.name}</span>
                  </h4>
                  {currentDay.notes && (
                    <p className="text-xs text-zinc-400 mt-0.5 italic">"{currentDay.notes}"</p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    {currentDay.exercises?.length || 0} {t('programs.exercises')}
                  </span>
                </div>
              </div>

              <div className="space-y-2 divide-y divide-dark-800">
                {currentDay.exercises && currentDay.exercises.length > 0 ? (
                  currentDay.exercises.map((ex, exIdx) => {
                    const exName = ex.exercise_name || 'Exercise';
                    const targetSets = ex.target_sets || 3;
                    const visual = getExerciseVisual(exName);
                    const primaryMuscle = visual.primaryMuscles[0] || 'Strength';

                    return (
                      <div
                        key={ex.exercise_id || exIdx}
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
                          title={t('routines.viewTechnique')}
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
                                  {t('activeWorkout.reps')}
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
                          title={t('routines.techniqueTooltip')}
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-xs text-zinc-500">
                    {t('programs.noExercisesInDay')}
                  </div>
                )}
              </div>
            </div>
          )}
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
