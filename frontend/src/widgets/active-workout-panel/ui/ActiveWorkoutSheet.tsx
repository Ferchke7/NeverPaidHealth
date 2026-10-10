import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  Clock,
  Plus,
  Trash2,
  Dumbbell,
  Timer,
  AlertTriangle,
  Trophy,
  CheckCircle2,
  Flame,
  ArrowLeftRight,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { useRestTimerStore } from '../../../entities/workout/model/restTimerStore.ts';
import { SetRow, PreviousSetData } from '../../../entities/workout/ui/SetRow.tsx';
import { ExercisePickerModal } from '../../../features/exercise-picker/ui/ExercisePickerModal.tsx';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { formatDuration } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { apiClient } from '../../../shared/api/client.ts';
import { WorkoutSummaryModal, FinishedWorkoutSummary } from '../../workout-summary-modal/ui/WorkoutSummaryModal.tsx';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { ExerciseInfoModal } from '../../../features/exercise-detail/ui/ExerciseInfoModal.tsx';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { FloatingActiveWorkoutPill } from './FloatingActiveWorkoutPill.tsx';

export const ActiveWorkoutSheet: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const workout = useActiveWorkoutStore((s) => s.workout);
  const isOpen = useActiveWorkoutStore((s) => s.isOpen);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);
  const closeSheet = useActiveWorkoutStore((s) => s.closeSheet);
  const addExercise = useActiveWorkoutStore((s) => s.addExercise);
  const replaceExercise = useActiveWorkoutStore((s) => s.replaceExercise);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const updateSet = useActiveWorkoutStore((s) => s.updateSet);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const finishWorkoutLocal = useActiveWorkoutStore((s) => s.finishWorkoutLocal);
  const discardWorkout = useActiveWorkoutStore((s) => s.discardWorkout);
  const liveVolume = useActiveWorkoutStore((s) => s.calculateLiveVolume());

  const unitPref = useAuthStore((s) => s.unitPreference);

  const isRestTimerActive = useRestTimerStore((s) => s.isActive);
  const stopRestTimer = useRestTimerStore((s) => s.stopTimer);
  const addRestSeconds = useRestTimerStore((s) => s.addSeconds);
  const getRemainingSeconds = useRestTimerStore((s) => s.getRemainingSeconds);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<FinishedWorkoutSummary | null>(null);
  const [inspectingExerciseName, setInspectingExerciseName] = useState<string | null>(null);

  // Fetch previous workout history for accurate previous set benchmarks & PR lookup
  const { data: historyData } = useQuery<{ items: WorkoutHistoryItem[] }>({
    queryKey: ['workouts'],
    queryFn: () => apiClient<{ items: WorkoutHistoryItem[] }>('/workouts?limit=50'),
  });

  // Build lookup maps for previous completed exercise sets and all-time PRs
  const { previousExerciseMap, prMap } = useMemo(() => {
    const prevMap = new Map<string, PreviousSetData[]>();
    const personalRecordMap = new Map<string, PreviousSetData>();

    const items: WorkoutHistoryItem[] = Array.isArray(historyData)
      ? historyData
      : (historyData?.items || []);

    if (!items.length) return { previousExerciseMap: prevMap, prMap: personalRecordMap };

    // Sort finished workouts newest first
    const sorted = [...items].sort(
      (a, b) =>
        new Date(b.started_at || (b as any).startedAt || 0).getTime() -
        new Date(a.started_at || (a as any).startedAt || 0).getTime()
    );

    for (const w of sorted) {
      if (!w.exercises) continue;
      for (const ex of w.exercises) {
        const rawId = (ex as any).exercise_id || (ex as any).exerciseId || (ex as any).id;
        const keyId = rawId ? String(rawId).toLowerCase() : null;
        const rawName = (ex as any).exercise_name || (ex as any).exerciseName || (ex as any).name || '';
        const keyName = rawName.toLowerCase().trim();
        const cleanKeyName = keyName.replace(/[^a-z0-9]/g, '');

        const setsArray = (ex as any).sets || [];
        const validSets: PreviousSetData[] = setsArray
          .filter(
            (s: any) =>
              s.completed ||
              Number(s.weight_kg ?? s.weightKg ?? s.weight ?? 0) > 0 ||
              Number(s.reps ?? s.target_reps ?? s.targetReps ?? 0) > 0
          )
          .map((s: any) => ({
            weightKg: Number(s.weight_kg ?? s.weightKg ?? s.weight ?? 0) || 0,
            reps: Number(s.reps ?? s.target_reps ?? s.targetReps ?? 0) || 0,
          }));

        if (validSets.length > 0) {
          // Record most recent session's sets for the previous column
          if (keyId && !prevMap.has(keyId)) prevMap.set(keyId, validSets);
          if (keyName && !prevMap.has(keyName)) prevMap.set(keyName, validSets);
          if (cleanKeyName && !prevMap.has(cleanKeyName)) prevMap.set(cleanKeyName, validSets);

          // Update all-time max PR for this exercise
          for (const s of validSets) {
            const currentPR =
              (keyId && personalRecordMap.get(keyId)) ||
              (keyName && personalRecordMap.get(keyName)) ||
              (cleanKeyName && personalRecordMap.get(cleanKeyName));
            if (
              !currentPR ||
              s.weightKg > currentPR.weightKg ||
              (s.weightKg === currentPR.weightKg && s.reps > currentPR.reps)
            ) {
              if (keyId) personalRecordMap.set(keyId, s);
              if (keyName) personalRecordMap.set(keyName, s);
              if (cleanKeyName) personalRecordMap.set(cleanKeyName, s);
            }
          }
        }
      }
    }

    return { previousExerciseMap: prevMap, prMap: personalRecordMap };
  }, [historyData]);

  // Elapsed workout stopwatch
  useEffect(() => {
    if (!workout) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(workout.startedAt).getTime();
    const updateElapsed = () => {
      const diff = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      setElapsedSeconds(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [workout?.startedAt]);

  // Rest timer tick
  useEffect(() => {
    if (!isRestTimerActive) {
      setRestRemaining(0);
      return;
    }

    const updateRest = () => {
      setRestRemaining(getRemainingSeconds());
    };

    updateRest();
    const interval = setInterval(updateRest, 500);
    return () => clearInterval(interval);
  }, [isRestTimerActive, getRemainingSeconds]);

  if (!workout && !summary) return null;

  const handleFinishWorkout = async () => {
    if (!workout) return;
    setIsSubmitting(true);
    try {
      let completedSetsCount = 0;
      for (const ex of workout.exercises) {
        for (const s of ex.sets) {
          if (s.completed || Number(s.reps) > 0) completedSetsCount++;
        }
      }

      const payloadExercises = workout.exercises.map((ex) => ({
        exercise_id: ex.exerciseId,
        exercise_name: ex.exerciseName,
        measurement_type: ex.measurementType,
        sets: ex.sets.map((s) => ({
          id: s.id,
          set_number: s.setNumber,
          set_type: s.setType,
          weight_kg: Number(s.weightKg) || 0,
          reps: Number(s.reps) || 0,
          rpe: s.rpe ? Number(s.rpe) : undefined,
          duration_seconds: s.durationSeconds,
          completed: s.completed || Number(s.reps) > 0,
        })),
      }));

      // 1. Sync finished workout to training service
      try {
        await apiClient(`/workouts/${workout.id}/finish`, {
          method: 'POST',
          body: JSON.stringify({
            duration_seconds: elapsedSeconds,
            exercises: payloadExercises,
          }),
        });
      } catch (err) {
        console.warn('Finish workout API call:', err);
      }

      // 2. Sync to progress analytics service
      try {
        await apiClient('/progress/workouts', {
          method: 'POST',
          body: JSON.stringify({
            workout_id: workout.id,
            duration_seconds: elapsedSeconds,
            total_volume_kg: liveVolume,
            completed_sets_count: completedSetsCount,
            exercises: payloadExercises,
          }),
        });
      } catch (err) {
        console.warn('Progress service sync:', err);
      }

      setSummary({
        id: workout.id,
        name: workout.name,
        durationSeconds: elapsedSeconds,
        totalVolumeKg: liveVolume,
        completedSetsCount,
        exerciseCount: workout.exercises.length,
      });

      stopRestTimer();
      finishWorkoutLocal();
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    if (!workout) return;
    try {
      await apiClient(`/workouts/${workout.id}/cancel`, { method: 'POST' });
    } catch {
      // Ignore
    }
    stopRestTimer();
    discardWorkout();
    setIsDiscardConfirmOpen(false);
  };

  const handleSelectExercise = (exercise: Exercise) => {
    const measType =
      typeof exercise.measurement_type === 'string'
        ? exercise.measurement_type
        : 'weight_reps';

    if (replacingExerciseId) {
      replaceExercise(replacingExerciseId, exercise.id, exercise.name, measType);
      setReplacingExerciseId(null);
    } else {
      addExercise(exercise.id, exercise.name, measType);
    }
  };

  return (
    <>
      {/* 1. Minimized Floating Draggable Pill Widget */}
      {workout && !isOpen && (
        <FloatingActiveWorkoutPill
          workout={workout}
          elapsedSeconds={elapsedSeconds}
          liveVolume={liveVolume}
          unitPref={unitPref}
          isRestTimerActive={isRestTimerActive}
          restRemaining={restRemaining}
          onOpen={openSheet}
          t={t}
        />
      )}

      {/* 2. Full-Screen Workout Sheet */}
      {workout && isOpen && (
        <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
          {/* Top Sticky Header */}
          <header className="sticky top-0 z-20 bg-dark-900/95 backdrop-blur-md border-b border-dark-800 px-3 py-2.5 sm:px-4 sm:py-3 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] shadow-lg">
            <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
              {/* Left: Minimize & Title */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={closeSheet}
                  className="w-8 h-8 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
                  title="Minimize workout"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-tight truncate">
                      {workout.name}
                    </h1>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-950/30 text-xs px-2.5 sm:px-3 h-8"
                  onClick={() => setIsDiscardConfirmOpen(true)}
                >
                  {t('common.discard')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="font-extrabold text-xs px-3 sm:px-5 h-8 shadow-lg shadow-brand-500/25 bg-emerald-500 hover:bg-emerald-400 text-dark-950 flex items-center gap-1 shrink-0"
                  isLoading={isSubmitting}
                  onClick={handleFinishWorkout}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('common.done')}</span>
                </Button>
              </div>
            </div>

            {/* Stats Sub-Bar */}
            <div className="flex items-center gap-2.5 text-[11px] sm:text-xs text-zinc-400 font-mono mt-1.5 pl-10 max-w-3xl mx-auto overflow-x-auto scrollbar-none whitespace-nowrap">
              <span className="flex items-center gap-1 text-emerald-400 font-bold shrink-0">
                <Clock className="w-3 h-3" />
                {formatDuration(elapsedSeconds)}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-300 shrink-0">{formatWeight(liveVolume, unitPref)} volume</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400 shrink-0">{workout.exercises.length} exercises</span>
            </div>
          </header>

          {/* Active Rest Timer Banner */}
          {isRestTimerActive && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 sm:px-4 py-2 flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-xs font-semibold text-amber-300">
                  Rest Timer: <strong className="font-mono text-sm ml-1 text-white">{restRemaining}s</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => addRestSeconds(30)}
                  className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold px-2.5 py-1 rounded-lg transition-colors border border-amber-500/30"
                >
                  +30s
                </button>
                <button
                  onClick={stopRestTimer}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Main Scrollable Exercise List */}
          <main className="flex-1 overflow-y-auto p-2.5 sm:p-4 max-w-3xl w-full mx-auto space-y-4 pb-36">
            {workout.exercises.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-dark-800 rounded-3xl p-8 bg-dark-900/30">
                <div className="w-14 h-14 rounded-2xl bg-dark-800 text-zinc-500 flex items-center justify-center mx-auto mb-3">
                  <Dumbbell className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-zinc-200">No exercises yet</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-5">
                  Select exercises from the comprehensive movement catalog to start tracking weights, sets, and reps.
                </p>
                <Button variant="primary" size="md" onClick={() => setIsPickerOpen(true)} className="gap-2 font-bold text-xs">
                  <Plus className="w-4 h-4" />
                  Add First Exercise
                </Button>
              </div>
            ) : (
              workout.exercises.map((exercise, exIndex) => {
                const keyId = exercise.exerciseId?.toLowerCase();
                const keyName = exercise.exerciseName?.toLowerCase().trim();
                const cleanKeyName = keyName ? keyName.replace(/[^a-z0-9]/g, '') : null;
                const prevList =
                  (keyId && previousExerciseMap.get(keyId)) ||
                  (keyName && previousExerciseMap.get(keyName)) ||
                  (cleanKeyName && previousExerciseMap.get(cleanKeyName));
                const prRecord =
                  (keyId && prMap.get(keyId)) ||
                  (keyName && prMap.get(keyName)) ||
                  (cleanKeyName && prMap.get(cleanKeyName));

                return (
                  <div
                    key={exercise.exerciseId || exIndex}
                    className="bg-dark-900/90 border border-dark-800/90 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xl backdrop-blur-sm"
                  >
                    {/* Exercise Card Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-dark-800/80 pb-3">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <ExerciseThumbnail
                          exerciseName={exercise.exerciseName}
                          size="sm"
                          onClick={() => setInspectingExerciseName(exercise.exerciseName)}
                          className="cursor-pointer hover:border-brand-500/50 shrink-0"
                        />
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              onClick={() => setInspectingExerciseName(exercise.exerciseName)}
                              className="text-sm font-extrabold text-white tracking-tight hover:text-brand-400 cursor-pointer transition-colors truncate"
                            >
                              {exercise.exerciseName}
                            </h3>
                            {prRecord && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-mono shrink-0">
                                <Trophy className="w-2.5 h-2.5 text-amber-400" />
                                <span>PR: {formatWeight(prRecord.weightKg, unitPref)} × {prRecord.reps}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            <span className="px-1.5 py-0.2 rounded bg-dark-800 text-zinc-400 border border-dark-700/60">
                              {exercise.measurementType.replace('_', ' ')}
                            </span>
                            <span>•</span>
                            <span>{exercise.sets.length} sets</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setReplacingExerciseId(exercise.exerciseId);
                            setIsPickerOpen(true);
                          }}
                          className="text-zinc-500 hover:text-brand-400 p-1.5 rounded-xl hover:bg-dark-800 transition-colors"
                          title="Replace Exercise / Swap Movement"
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectingExerciseName(exercise.exerciseName)}
                          className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-xl hover:bg-dark-800 transition-colors"
                          title="Exercise Form Guide & Visual"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeExercise(exercise.exerciseId)}
                          className="text-zinc-500 hover:text-red-400 p-1.5 rounded-xl hover:bg-dark-800 transition-colors"
                          title="Remove Exercise"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Table Column Headers: SET | PREVIOUS | +KG | REPS | ✓ */}
                    <div className="grid grid-cols-12 gap-1.5 sm:gap-2 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 px-2 sm:px-2.5 pb-1 border-b border-dark-800/60 items-center">
                      <span className="col-span-2 text-center">{t('activeWorkout.set')}</span>
                      <span className="col-span-3 text-center">{t('activeWorkout.previous')}</span>
                      <span className="col-span-3 text-center">{unitPref === 'lb' ? '+LBS' : '+KG'}</span>
                      <span className="col-span-2 text-center">{t('activeWorkout.reps')}</span>
                      <span className="col-span-2 text-center">✓</span>
                    </div>

                    {/* Set Rows List */}
                    <div className="space-y-1.5">
                      {exercise.sets.map((set, sIdx) => {
                        const prevSet = prevList && prevList[sIdx]
                          ? prevList[sIdx]
                          : prevList && prevList.length > 0
                          ? prevList[prevList.length - 1]
                          : null;

                        return (
                          <SetRow
                            key={set.id || sIdx}
                            set={set}
                            previousSet={prevSet}
                            onUpdate={(updates) => updateSet(exercise.exerciseId, set.id, updates)}
                            onDelete={() => removeSet(exercise.exerciseId, set.id)}
                            onCompleteToggle={() => {
                              const willBeCompleted = !set.completed;
                              updateSet(exercise.exerciseId, set.id, { completed: willBeCompleted });
                              if (willBeCompleted) {
                                useRestTimerStore.getState().startTimer(90);
                              }
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Add Set & Warmup Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => addSet(exercise.exerciseId, 'normal')}
                        className="flex-1 py-2 bg-dark-800/80 hover:bg-dark-700 text-zinc-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-dark-700/80 active:scale-[0.98]"
                      >
                        <Plus className="w-3.5 h-3.5 text-brand-400" />
                        <span>{t('activeWorkout.addSet')}</span>
                      </button>

                      <button
                        onClick={() => addSet(exercise.exerciseId, 'warmup')}
                        className="py-2 px-3.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all border border-amber-500/25 active:scale-[0.98]"
                        title="Add Warmup Set"
                      >
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>+ Warmup</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Bottom Add Exercise Bar */}
            {workout.exercises.length > 0 && (
              <Button
                variant="outline"
                className="w-full py-3.5 border-dashed border-dark-700/80 bg-dark-900/40 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 rounded-2xl hover:border-brand-500/50 hover:bg-brand-500/5 transition-all shadow-sm"
                onClick={() => setIsPickerOpen(true)}
              >
                <Plus className="w-4 h-4 text-brand-400" />
                {t('activeWorkout.addExercise')}
              </Button>
            )}
          </main>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      <Modal
        isOpen={isDiscardConfirmOpen}
        onClose={() => setIsDiscardConfirmOpen(false)}
        title={t('activeWorkout.discardWorkout')}
        size="sm"
        headerIcon={<AlertTriangle className="w-5 h-5 text-red-400" />}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDiscardConfirmOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDiscard}
            >
              {t('common.discard')}
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-400 leading-relaxed">
          {t('activeWorkout.discardConfirm')}
        </p>
      </Modal>

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectExercise={handleSelectExercise}
      />

      {/* Exercise Info Form Guide Modal */}
      {inspectingExerciseName && (
        <ExerciseInfoModal
          isOpen={true}
          onClose={() => setInspectingExerciseName(null)}
          exerciseName={inspectingExerciseName}
        />
      )}

      {/* Workout Summary Celebration Modal */}
      <WorkoutSummaryModal
        summary={summary}
        onClose={() => setSummary(null)}
      />
    </>
  );
};
