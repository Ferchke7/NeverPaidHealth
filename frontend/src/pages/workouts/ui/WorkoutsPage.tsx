import React, { useState, useMemo } from 'react';
import {
  Plus,
  Play,
  Trash2,
  FolderPlus,
  Search,
  BookOpen,
  Layers,
  Copy,
  Clock,
  Edit3,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { ActiveExercise, ActiveSet } from '../../../entities/workout/model/types.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { RoutineEditorModal } from '../../../features/routine-builder/ui/RoutineEditorModal.tsx';
import { RoutineDetailModal } from '../../../features/routine-preview/ui/RoutineDetailModal.tsx';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface RoutineExercise {
  exercise_id: string;
  exercise_name: string;
  order_index: number;
  target_sets: number;
  target_reps_min?: number;
  target_reps_max?: number;
}

interface Routine {
  id: string;
  user_id?: string;
  name: string;
  notes?: string;
  exercises: RoutineExercise[];
  created_at: string;
}

interface WorkoutsPageProps {
  onNavigateToPrograms?: () => void;
}

export const WorkoutsPage: React.FC<WorkoutsPageProps> = ({ onNavigateToPrograms }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateRoutineOpen, setIsCreateRoutineOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [selectedRoutinePreview, setSelectedRoutinePreview] = useState<Routine | null>(null);
  const [customRoutineOrder, setCustomRoutineOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('np_my_routines_custom_order');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isReorderMode, setIsReorderMode] = useState(false);

  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

  // Fetch routines (both user + library templates)
  const { data: routines = [], isLoading } = useQuery<Routine[]>({
    queryKey: ['routines'],
    queryFn: () => apiClient<Routine[]>('/routines'),
  });

  // Delete routine mutation
  const deleteRoutineMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/routines/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });

  // Clone routine mutation
  const cloneRoutineMutation = useMutation({
    mutationFn: async (routine: Routine) => {
      return apiClient('/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: `${routine.name} (Copy)`,
          notes: routine.notes,
          exercises: routine.exercises.map((e, idx) => ({
            exercise_id: e.exercise_id,
            exercise_name: e.exercise_name,
            order_index: idx,
            target_sets: e.target_sets || 3,
            target_reps_min: e.target_reps_min || 8,
            target_reps_max: e.target_reps_max || 12,
          })),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });

  const handleMoveRoutine = (routineId: string, direction: 'up' | 'down') => {
    const isSystem = (r: Routine) =>
      !r.user_id || r.user_id === '00000000-0000-0000-0000-000000000000';
    const users = routines.filter((r) => !isSystem(r));
    const sortedUserIds = [...users]
      .sort((a, b) => {
        const idxA = customRoutineOrder.indexOf(a.id);
        const idxB = customRoutineOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .map((r) => r.id);

    const index = sortedUserIds.indexOf(routineId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedUserIds.length) return;

    const updated = [...sortedUserIds];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setCustomRoutineOrder(updated);
    localStorage.setItem('np_my_routines_custom_order', JSON.stringify(updated));
  };

  const handleStartEmptyWorkout = async () => {
    if (activeWorkout) {
      const hasCompletedSets = activeWorkout.exercises.some((e) =>
        e.sets.some((s) => s.completed)
      );
      if (hasCompletedSets) {
        openSheet();
        return;
      }
    }

    const tempId = generateUUID();
    startWorkout(tempId, 'Quick Workout');
    openSheet();

    try {
      const res = await apiClient<{ id: string; name: string }>('/workouts', {
        method: 'POST',
        body: JSON.stringify({ name: 'Quick Workout' }),
      });
      if (res && res.id && res.id !== tempId) {
        const current = useActiveWorkoutStore.getState().workout;
        if (current && current.id === tempId) {
          useActiveWorkoutStore.setState({ workout: { ...current, id: res.id } });
        }
      }
    } catch {
      // Keep running locally
    }
  };

  const handleStartRoutine = async (routine: Routine) => {
    if (activeWorkout) {
      const hasCompletedSets = activeWorkout.exercises.some((e) =>
        e.sets.some((s) => s.completed)
      );
      if (hasCompletedSets) {
        const confirmed = window.confirm(
          `You have an active workout in progress ("${activeWorkout.name}"). Discard it and start "${routine.name}"?`
        );
        if (!confirmed) {
          openSheet();
          return;
        }
      }
    }

    const initialExercises: ActiveExercise[] = (routine.exercises || []).map((ex: any, idx: number) => {
      const exerciseId =
        ex.exercise_id && ex.exercise_id !== '00000000-0000-0000-0000-000000000000'
          ? ex.exercise_id
          : ex.exerciseId || ex.id || `ex-${idx}-${generateUUID()}`;
      const setsCount = Math.max(1, ex.target_sets || ex.targetSets || 3);
      const defaultReps = ex.target_reps_min || ex.targetRepsMin || 10;
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
        exerciseName: ex.exercise_name || ex.exerciseName || ex.name || `Exercise ${idx + 1}`,
        measurementType: ex.measurement_type || ex.measurementType || 'weight_reps',
        sets,
      };
    });

    const tempId = generateUUID();
    startWorkout(tempId, routine.name, routine.id, initialExercises);
    openSheet();

    try {
      const res = await apiClient<{ id: string; name: string }>('/workouts', {
        method: 'POST',
        body: JSON.stringify({ routine_id: routine.id, name: routine.name }),
      });
      if (res && res.id && res.id !== tempId) {
        const current = useActiveWorkoutStore.getState().workout;
        if (current && current.id === tempId) {
          useActiveWorkoutStore.setState({ workout: { ...current, id: res.id } });
        }
      }
    } catch (err) {
      console.warn('Backend start routine sync:', err);
    }
  };

  // Filter user's personal routines
  const userRoutines = useMemo(() => {
    const isSystem = (r: Routine) =>
      !r.user_id || r.user_id === '00000000-0000-0000-0000-000000000000';

    const user = routines.filter((r) => !isSystem(r));
    return [...user].sort((a, b) => {
      const idxA = customRoutineOrder.indexOf(a.id);
      const idxB = customRoutineOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [routines, customRoutineOrder]);

  const filteredRoutines = useMemo(() => {
    return userRoutines.filter((r) => {
      return (
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.exercises.some((e) => e.exercise_name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
  }, [userRoutines, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>{t('workouts.title')}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              Pro Hub
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t('workouts.quickWorkoutDesc')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToPrograms && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex items-center gap-1.5"
              onClick={onNavigateToPrograms}
              title={t('workouts.exploreLibrary')}
            >
              <BookOpen className="w-4 h-4 text-brand-400" />
              <span>{t('workouts.exploreLibrary')}</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            className="text-xs flex items-center gap-1.5"
            onClick={() => {
              setEditingRoutine(null);
              setIsCreateRoutineOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            <span>{t('workouts.newRoutine')}</span>
          </Button>
        </div>
      </div>

      {/* Quick Start Hero Card */}
      <Card className="p-5 border-brand-500/30 bg-gradient-to-br from-brand-950/40 via-dark-900 to-dark-900 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-brand-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-500 text-dark-950 flex items-center justify-center shadow-lg shadow-brand-500/30 shrink-0 font-extrabold">
              <Play className="w-6 h-6 fill-current ml-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {activeWorkout ? t('activeWorkout.title') : t('workouts.quickWorkout')}
                </h2>
                {activeWorkout && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full animate-pulse">
                    ● Live
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {activeWorkout
                  ? `${activeWorkout.name} (${activeWorkout.exercises.length} ${t('workouts.exercisesCount', { count: activeWorkout.exercises.length })})`
                  : t('workouts.quickWorkoutDesc')}
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            className="w-full sm:w-auto font-bold text-xs shadow-md shadow-brand-500/25 px-6"
            onClick={handleStartEmptyWorkout}
          >
            {activeWorkout ? t('workouts.start') : t('workouts.quickWorkout')}
          </Button>
        </div>
      </Card>

      {/* Routines Section Header & Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-dark-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-400" />
            <h2 className="text-sm font-bold text-white">
              {t('workouts.title')} ({userRoutines.length})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {userRoutines.length > 1 && (
              <button
                onClick={() => setIsReorderMode((prev) => !prev)}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all border ${
                  isReorderMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-dark-800 text-zinc-400 border-dark-700 hover:text-white hover:bg-dark-700'
                }`}
                title="Toggle routine reordering mode"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-brand-400" />
                <span>{isReorderMode ? t('workouts.reorderDone') : t('workouts.reorder')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder={t('workouts.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 text-xs"
          />
        </div>
      </div>

      {/* Routines Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 bg-dark-800/60 rounded-2xl border border-dark-700/60 animate-pulse"
            />
          ))}
        </div>
      ) : filteredRoutines.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-dark-800 rounded-2xl p-6 bg-dark-900/40">
          <FolderPlus className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-300">
            {userRoutines.length === 0 ? t('workouts.noRoutines') : t('common.search')}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            {userRoutines.length === 0
              ? t('workouts.noRoutinesDesc')
              : t('common.clearFilters')}
          </p>

          <div className="flex items-center justify-center gap-3">
            {onNavigateToPrograms && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToPrograms}
                className="text-xs"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1 text-brand-400" />
                {t('workouts.exploreLibrary')}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingRoutine(null);
                setIsCreateRoutineOpen(true);
              }}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t('workouts.createFirstRoutine')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRoutines.map((routine) => {
            const orderIndex = userRoutines.findIndex((r) => r.id === routine.id);
            const totalUserRoutines = userRoutines.length;

            return (
              <Card
                key={routine.id}
                onClick={() => setSelectedRoutinePreview(routine)}
                className="p-4 bg-dark-800/90 border border-dark-700/80 hover:border-brand-500/50 transition-all flex flex-col justify-between shadow-lg cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        {orderIndex !== -1 && (
                          <span className="px-2 py-0.5 bg-dark-900 border border-brand-500/40 text-[11px] font-mono font-bold text-brand-400 rounded-lg shrink-0 mt-0.5 shadow-sm">
                            #{orderIndex + 1}
                          </span>
                        )}
                        <h3 className="text-sm sm:text-base font-bold text-white leading-snug group-hover:text-brand-400 transition-colors break-words flex-1">
                          {routine.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-zinc-500" />
                          {routine.exercises?.length || 0} exercises
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                          ~{(routine.exercises?.length || 0) * 10} min
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center bg-dark-900/90 rounded-lg p-0.5 border border-dark-700/80 mr-0.5 shadow-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveRoutine(routine.id, 'up');
                          }}
                          disabled={orderIndex <= 0}
                          className="p-1.5 text-zinc-400 hover:text-brand-400 disabled:opacity-20 disabled:hover:text-zinc-400 transition-colors rounded hover:bg-dark-700"
                          title="Move Routine Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveRoutine(routine.id, 'down');
                          }}
                          disabled={orderIndex === -1 || orderIndex >= totalUserRoutines - 1}
                          className="p-1.5 text-zinc-400 hover:text-brand-400 disabled:opacity-20 disabled:hover:text-zinc-400 transition-colors rounded hover:bg-dark-700"
                          title="Move Routine Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setEditingRoutine(routine);
                          setIsCreateRoutineOpen(true);
                        }}
                        className="text-zinc-500 hover:text-brand-400 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                        title="Edit Routine"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => deleteRoutineMutation.mutate(routine.id)}
                        className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                        title="Delete Routine"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {routine.notes && (
                    <p className="text-xs text-zinc-400 italic line-clamp-2">
                      "{routine.notes}"
                    </p>
                  )}

                  {/* Exercise Thumbnails Row & Chips */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {routine.exercises?.slice(0, 4).map((ex, i) => (
                        <div key={i} className="relative group/thumb" title={ex.exercise_name}>
                          <ExerciseThumbnail
                            exerciseName={ex.exercise_name}
                            size="sm"
                            className="rounded-lg border-dark-700 hover:border-brand-400 transition-colors"
                          />
                        </div>
                      ))}
                      {routine.exercises?.length > 4 && (
                        <div className="w-10 h-10 rounded-lg bg-dark-900 border border-dark-700 flex items-center justify-center text-[11px] font-bold text-zinc-400">
                          +{routine.exercises.length - 4}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {routine.exercises?.slice(0, 4).map((ex, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-dark-900/90 border border-dark-700/80 text-zinc-300 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono"
                        >
                          <span className="text-brand-400 font-bold">{ex.target_sets || 3}×</span>
                          <span className="font-sans truncate max-w-[120px]">{ex.exercise_name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div
                  className="mt-4 pt-3 border-t border-dark-700/60 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingRoutine(routine);
                        setIsCreateRoutineOpen(true);
                      }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/25 transition-all flex items-center gap-1.5 shadow-sm"
                      title="Edit routine"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => cloneRoutineMutation.mutate(routine)}
                      disabled={cloneRoutineMutation.isPending}
                      className="text-xs text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                      title="Clone as duplicate copy"
                    >
                      <Copy className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs font-bold flex items-center justify-center gap-1.5 px-3.5 shadow-sm"
                    onClick={() => handleStartRoutine(routine)}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Routine Detail Modal */}
      <RoutineDetailModal
        isOpen={Boolean(selectedRoutinePreview)}
        routine={selectedRoutinePreview}
        onClose={() => setSelectedRoutinePreview(null)}
        onEditRoutine={(r) => {
          setSelectedRoutinePreview(null);
          setEditingRoutine(r as Routine);
          setIsCreateRoutineOpen(true);
        }}
        onCloneToMyRoutines={(r) => {
          setSelectedRoutinePreview(null);
          cloneRoutineMutation.mutate(r as Routine);
        }}
        onStartWorkout={(r) => {
          setSelectedRoutinePreview(null);
          handleStartRoutine(r as Routine);
        }}
      />

      {/* Routine Creator / Editor Modal */}
      <RoutineEditorModal
        isOpen={isCreateRoutineOpen}
        initialRoutine={editingRoutine}
        onClose={() => {
          setIsCreateRoutineOpen(false);
          setEditingRoutine(null);
        }}
      />
    </div>
  );
};
