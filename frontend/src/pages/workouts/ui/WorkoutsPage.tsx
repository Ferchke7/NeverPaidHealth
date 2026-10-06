import React, { useState, useMemo } from 'react';
import {
  Plus,
  Play,
  Dumbbell,
  Trash2,
  FolderPlus,
  Search,
  BookOpen,
  Layers,
  Copy,
  Clock,
  Edit3,
  Star,
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

const PROGRAM_CATEGORIES = [
  { id: 'all', label: 'All Programs' },
  { id: 'ppl', label: 'Push / Pull / Legs' },
  { id: 'arnold', label: 'Arnold Golden Era' },
  { id: 'upper_lower', label: 'Upper / Lower' },
  { id: 'full_body', label: 'Full Body' },
  { id: 'bro_split', label: '5-Day Bro Split' },
];

export const WorkoutsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'library' | 'my_routines'>('library');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateRoutineOpen, setIsCreateRoutineOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [selectedRoutinePreview, setSelectedRoutinePreview] = useState<Routine | null>(null);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(() => {
    return localStorage.getItem('np_active_program_id') || null;
  });

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
          name: `${routine.name} (Custom)`,
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
      setActiveTab('my_routines');
    },
  });

  const handleToggleActiveProgram = (routine: Routine) => {
    if (activeProgramId === routine.id) {
      setActiveProgramId(null);
      localStorage.removeItem('np_active_program_id');
    } else {
      setActiveProgramId(routine.id);
      localStorage.setItem('np_active_program_id', routine.id);
    }
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

  // Filter routines based on tab, category, and search query
  const { libraryRoutines, userRoutines } = useMemo(() => {
    const isSystem = (r: Routine) =>
      !r.user_id || r.user_id === '00000000-0000-0000-0000-000000000000';

    const lib = routines.filter(isSystem);
    const user = routines.filter((r) => !isSystem(r));

    return { libraryRoutines: lib, userRoutines: user };
  }, [routines]);

  const currentList = activeTab === 'library' ? libraryRoutines : userRoutines;

  const filteredRoutines = useMemo(() => {
    return currentList.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.exercises.some((e) => e.exercise_name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (activeTab === 'library' && selectedCategory !== 'all') {
        const nameLower = r.name.toLowerCase();
        if (selectedCategory === 'ppl' && !nameLower.includes('ppl') && !nameLower.includes('push') && !nameLower.includes('pull') && !nameLower.includes('legs')) return false;
        if (selectedCategory === 'arnold' && !nameLower.includes('arnold')) return false;
        if (selectedCategory === 'upper_lower' && !nameLower.includes('upper') && !nameLower.includes('lower')) return false;
        if (selectedCategory === 'full_body' && !nameLower.includes('full body')) return false;
        if (selectedCategory === 'bro_split' && !nameLower.includes('bro split')) return false;
      }

      return matchesSearch;
    });
  }, [currentList, searchQuery, activeTab, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Workouts & Routines</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              Pro Hub
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Browse science-backed splits in the Library, or build and customize your personal workout routines.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="text-xs flex items-center gap-1.5"
          onClick={() => {
            setEditingRoutine(null);
            setIsCreateRoutineOpen(true);
          }}
        >
          <Plus className="w-4 h-4 text-brand-400" />
          <span>New Routine</span>
        </Button>
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
                  {activeWorkout ? 'Workout In Progress' : 'Quick Empty Workout'}
                </h2>
                {activeWorkout && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full animate-pulse">
                    ● Live
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {activeWorkout
                  ? `Currently logging "${activeWorkout.name}" with ${activeWorkout.exercises.length} exercises.`
                  : 'Start from a clean slate and add exercises freely on the fly.'}
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            className="w-full sm:w-auto font-bold text-xs shadow-md shadow-brand-500/25 px-6"
            onClick={handleStartEmptyWorkout}
          >
            {activeWorkout ? 'Resume Active Session' : 'Start Empty Workout'}
          </Button>
        </div>
      </Card>

      {/* Tabs Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-dark-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'library'
                  ? 'bg-brand-500 text-dark-950 shadow-md shadow-brand-500/20'
                  : 'text-zinc-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Program Library ({libraryRoutines.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('my_routines')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'my_routines'
                  ? 'bg-brand-500 text-dark-950 shadow-md shadow-brand-500/20'
                  : 'text-zinc-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>My Routines ({userRoutines.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Subtitle Notice */}
        {activeTab === 'library' ? (
          <p className="text-[11px] text-zinc-400 italic">
            📚 <strong>Program Library</strong> contains reference templates. Tap any program to preview exercises, or click <strong>«+ Add to My Routines»</strong> to copy and customize sets and reps for yourself.
          </p>
        ) : (
          <p className="text-[11px] text-zinc-400 italic">
            ⭐ <strong>My Routines</strong> contains your personal customized splits. You can edit, reorder, and adjust them anytime.
          </p>
        )}

        {/* Search & Category Filter Pills */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder={`Search in ${activeTab === 'library' ? 'Programs Library' : 'My Routines'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-xs"
            />
          </div>

          {activeTab === 'library' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {PROGRAM_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-dark-700 text-brand-400 border border-brand-500/40 font-bold shadow-sm'
                      : 'bg-dark-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-dark-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
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
            {activeTab === 'library' ? 'No programs found' : 'No personal routines yet'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            {activeTab === 'library'
              ? 'Try selecting another split filter category or clearing your search term.'
              : 'Browse the Program Library and tap «Add to My Routines» to adopt a split, or build one from scratch.'}
          </p>
          {activeTab === 'my_routines' && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('library')}
                className="text-xs"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1 text-brand-400" />
                Browse Library
              </Button>
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
                Create Custom
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRoutines.map((routine) => {
            const isSystem =
              !routine.user_id || routine.user_id === '00000000-0000-0000-0000-000000000000';
            const isActive = activeProgramId === routine.id;

            return (
              <Card
                key={routine.id}
                onClick={() => setSelectedRoutinePreview(routine)}
                className={`p-4 bg-dark-800/90 border transition-all flex flex-col justify-between shadow-lg cursor-pointer group ${
                  isActive
                    ? 'border-brand-500/80 ring-1 ring-brand-500/30'
                    : 'border-dark-700/80 hover:border-brand-500/50'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-dark-700/80 text-brand-400 flex items-center justify-center border border-dark-600/40 group-hover:scale-105 transition-transform shrink-0">
                        <Dumbbell className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-white leading-snug group-hover:text-brand-400 transition-colors truncate">
                            {routine.name}
                          </h3>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-mono shrink-0">
                              <Star className="w-2.5 h-2.5 fill-amber-300" />
                              <span>Active Split</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-zinc-500" />
                            {routine.exercises?.length || 0} exercises
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            ~{(routine.exercises?.length || 0) * 10} min
                          </span>
                          {isSystem && (
                            <>
                              <span>•</span>
                              <span className="text-[10px] text-brand-400 font-semibold bg-brand-500/10 px-1.5 py-0.2 rounded border border-brand-500/20">
                                Official Template
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleActiveProgram(routine)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isActive
                            ? 'text-amber-400 bg-amber-500/15'
                            : 'text-zinc-500 hover:text-amber-400 hover:bg-dark-700'
                        }`}
                        title={isActive ? 'Unmark active split' : 'Mark as my active program split'}
                      >
                        <Star className={`w-3.5 h-3.5 ${isActive ? 'fill-amber-400' : ''}`} />
                      </button>

                      {!isSystem && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>

                  {routine.notes && (
                    <p className="text-xs text-zinc-400 italic line-clamp-2">
                      "{routine.notes}"
                    </p>
                  )}

                  {/* Exercise Thumbnails Row & Chips */}
                  <div className="space-y-2 pt-1">
                    {/* Visual Thumbnails Bar */}
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

                    {/* Exercise Chips */}
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
                      title={isSystem ? "Customize exercises, sets and reps for this routine" : "Edit routine"}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                      <span>{isSystem ? 'Customize' : 'Edit'}</span>
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

      {/* Routine Detail Modal (Hevy Style Preview Matching User Screenshot) */}
      <RoutineDetailModal
        isOpen={Boolean(selectedRoutinePreview)}
        routine={selectedRoutinePreview}
        isActiveProgram={activeProgramId === selectedRoutinePreview?.id}
        onToggleActiveProgram={(r) => handleToggleActiveProgram(r as Routine)}
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
