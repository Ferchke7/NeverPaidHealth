import React, { useState, useMemo } from 'react';
import {
  History,
  Clock,
  Flame,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
  Calendar,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { formatDate, formatDuration } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { WorkoutHistoryItem, ActiveExercise, ActiveSet } from '../../../entities/workout/model/types.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { WorkoutCalendar } from '../../../features/workout-calendar/ui/WorkoutCalendar.tsx';

interface HistoryResponse {
  items: WorkoutHistoryItem[];
  next_cursor?: string | null;
}

export const HistoryPage: React.FC = () => {
  const unitPref = useAuthStore((s) => s.unitPreference);
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ['workouts'],
    queryFn: () => apiClient<HistoryResponse>('/workouts?limit=50'),
  });

  const workouts = data?.items || [];

  // Delete workout mutation
  const deleteWorkoutMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/workouts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workouts'] });
      void queryClient.invalidateQueries({ queryKey: ['records'] });
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      setDeletingId(null);
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleRepeatWorkout = (w: WorkoutHistoryItem) => {
    if (activeWorkout) {
      const hasCompletedSets = activeWorkout.exercises.some((e) =>
        e.sets.some((s) => s.completed)
      );
      if (hasCompletedSets) {
        const confirmed = window.confirm(
          `You have an active workout in progress ("${activeWorkout.name}"). Discard it and start "${w.name}"?`
        );
        if (!confirmed) {
          openSheet();
          return;
        }
      }
    }

    const initialExercises: ActiveExercise[] = (w.exercises || []).map((ex: any, idx: number) => {
      const exerciseId = ex.exercise_id || ex.exerciseId || `ex-${idx}-${generateUUID()}`;
      const sets: ActiveSet[] = (ex.sets || []).map((s: any, sIdx: number) => ({
        id: generateUUID(),
        setNumber: s.set_number || s.setNumber || sIdx + 1,
        setType: s.set_type || s.setType || 'normal',
        weightKg: s.weight_kg || s.weightKg || 0,
        reps: s.reps || 10,
        completed: false,
      }));

      return {
        exerciseId,
        exerciseName: ex.exercise_name || ex.exerciseName || `Exercise ${idx + 1}`,
        measurementType: 'weight_reps',
        sets: sets.length > 0 ? sets : Array.from({ length: 3 }, (_, i) => ({
          id: generateUUID(),
          setNumber: i + 1,
          setType: 'normal' as const,
          weightKg: 0,
          reps: 10,
          completed: false,
        })),
      };
    });

    const newId = generateUUID();
    startWorkout(newId, `${w.name}`, undefined, initialExercises);
    openSheet();
  };

  // High-level statistics
  const stats = useMemo(() => {
    let totalVol = 0;
    let totalSecs = 0;
    let totalSets = 0;

    for (const w of workouts) {
      totalVol += w.total_volume_kg || 0;
      totalSecs += w.duration_seconds || 0;
      totalSets += w.completed_sets_count || 0;
    }

    return {
      totalWorkouts: workouts.length,
      totalVolumeKg: totalVol,
      totalHours: Math.round((totalSecs / 3600) * 10) / 10,
      totalSets,
    };
  }, [workouts]);

  return (
    <div className="space-y-6">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Training History & Logs</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              {stats.totalWorkouts} Logged
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Detailed log of all your previous training sessions, volume, and set performance.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-dark-850 rounded-xl border border-dark-700 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'list'
                ? 'bg-brand-500 text-dark-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'calendar'
                ? 'bg-brand-500 text-dark-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar
          </button>
        </div>
      </div>

      {/* If Calendar view is active */}
      {viewMode === 'calendar' ? (
        <WorkoutCalendar workouts={workouts} />
      ) : (
        <>
          {/* Analytics Highlights Banner */}
          {workouts.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3.5 bg-dark-800/80 border-dark-700/80 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-medium">
                  <History className="w-3.5 h-3.5 text-brand-400" />
                  <span>Total Sessions</span>
                </div>
                <div className="text-lg font-extrabold text-white font-mono">
                  {stats.totalWorkouts}
                </div>
              </Card>

              <Card className="p-3.5 bg-dark-800/80 border-dark-700/80 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-medium">
                  <Flame className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Total Volume</span>
                </div>
                <div className="text-lg font-extrabold text-emerald-400 font-mono">
                  {formatWeight(stats.totalVolumeKg, unitPref)}
                </div>
              </Card>

              <Card className="p-3.5 bg-dark-800/80 border-dark-700/80 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-medium">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Time Trained</span>
                </div>
                <div className="text-lg font-extrabold text-sky-400 font-mono">
                  {stats.totalHours} hrs
                </div>
              </Card>
            </div>
          )}

      {/* Workouts History List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-dark-800/60 rounded-2xl border border-dark-700 animate-pulse"
            />
          ))}
        </div>
      ) : workouts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-dark-800 rounded-2xl p-6 bg-dark-900/40">
          <History className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-300">No workout logs recorded yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            Finish your first workout session to start building your training history, volume graphs, and PR records.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {workouts.map((workout) => {
            const isExpanded = expandedId === workout.id;
            return (
              <Card
                key={workout.id}
                className="bg-dark-800/90 border-dark-700/80 hover:border-dark-600 transition-all overflow-hidden shadow-lg"
              >
                {/* Header Row */}
                <div
                  className="p-4 cursor-pointer flex items-center justify-between gap-3 select-none"
                  onClick={() => toggleExpand(workout.id)}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white leading-snug">{workout.name}</h3>
                      <span className="text-[10px] bg-dark-700/90 text-zinc-300 px-2 py-0.5 rounded font-mono border border-dark-600/50 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        {formatDate(workout.started_at)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400">
                      {workout.duration_seconds && workout.duration_seconds > 0 ? (
                        <span className="flex items-center gap-1 text-sky-400">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(workout.duration_seconds)}
                        </span>
                      ) : null}

                      {workout.total_volume_kg !== undefined && workout.total_volume_kg > 0 ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <Flame className="w-3.5 h-3.5" />
                          {formatWeight(workout.total_volume_kg, unitPref)}
                        </span>
                      ) : null}

                      <span className="flex items-center gap-1 text-zinc-300">
                        <Dumbbell className="w-3.5 h-3.5 text-zinc-500" />
                        {workout.completed_sets_count || 0} sets
                      </span>

                      <span className="text-zinc-500">
                        {workout.exercises?.length || 0} exercises
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRepeatWorkout(workout);
                      }}
                      className="p-2 rounded-xl text-zinc-400 hover:text-brand-400 hover:bg-dark-700 transition-colors"
                      title="Repeat this workout"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingId(workout.id);
                      }}
                      className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-dark-700 transition-colors"
                      title="Delete workout log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="text-zinc-500 p-1">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-dark-700/60 bg-dark-900/50 space-y-4 animate-in fade-in duration-200">
                    {workout.exercises && workout.exercises.length > 0 ? (
                      workout.exercises.map((ex, i) => (
                        <div key={i} className="space-y-2 bg-dark-850/60 p-3 rounded-xl border border-dark-750">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-white flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-dark-700 text-brand-400 flex items-center justify-center text-[10px] font-mono">
                                {i + 1}
                              </span>
                              <span>{ex.exercise_name}</span>
                            </h4>
                            <span className="text-[10px] font-mono text-zinc-400">
                              {ex.sets?.length || 0} sets
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {ex.sets?.map((set, sIdx) => (
                              <div
                                key={sIdx}
                                className="flex items-center justify-between bg-dark-900/80 px-3 py-2 rounded-lg text-xs font-mono border border-dark-700/60"
                              >
                                <span className="text-zinc-500 font-bold">Set {set.set_number || sIdx + 1}</span>
                                <span className="text-zinc-200 font-semibold">
                                  {formatWeight(set.weight_kg, unitPref)} × {set.reps} reps
                                </span>
                                {set.set_type && set.set_type !== 'normal' && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase font-bold">
                                    {set.set_type}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 italic">No exercise details recorded.</p>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs flex items-center gap-1.5"
                        onClick={() => handleRepeatWorkout(workout)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-brand-400" />
                        <span>Log Again</span>
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Delete Workout Log?</h3>
            <p className="text-xs text-zinc-400">
              Are you sure you want to permanently delete this workout from your training history?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteWorkoutMutation.isPending}
                onClick={() => deleteWorkoutMutation.mutate(deletingId)}
              >
                Delete Log
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
