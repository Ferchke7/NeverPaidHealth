import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Clock,
  Layers,
  Play,
  Copy,
  Plus,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { ActiveExercise, ActiveSet } from '../../../entities/workout/model/types.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { RoutineDetailModal } from '../../../features/routine-preview/ui/RoutineDetailModal.tsx';
import { RoutineEditorModal } from '../../../features/routine-builder/ui/RoutineEditorModal.tsx';
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

interface ProgramsPageProps {
  onNavigateToWorkouts?: () => void;
}

export const ProgramsPage: React.FC<ProgramsPageProps> = ({ onNavigateToWorkouts }) => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoutinePreview, setSelectedRoutinePreview] = useState<Routine | null>(null);
  const [customizingRoutine, setCustomizingRoutine] = useState<Routine | null>(null);
  const [copiedRoutineId, setCopiedRoutineId] = useState<string | null>(null);

  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

  // Fetch all routines from API
  const { data: routines = [], isLoading } = useQuery<Routine[]>({
    queryKey: ['routines'],
    queryFn: () => apiClient<Routine[]>('/routines'),
  });

  // Only system / library templates
  const libraryRoutines = useMemo(() => {
    const isSystem = (r: Routine) =>
      !r.user_id || r.user_id === '00000000-0000-0000-0000-000000000000';
    return routines.filter(isSystem);
  }, [routines]);

  // Clone template into user's personal routines
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
    onSuccess: (_, routine) => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      setCopiedRoutineId(routine.id);
      setTimeout(() => setCopiedRoutineId(null), 3000);
    },
  });

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

  const filteredPrograms = useMemo(() => {
    return libraryRoutines.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.exercises.some((e) => e.exercise_name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (selectedCategory !== 'all') {
        const nameLower = r.name.toLowerCase();
        if (selectedCategory === 'ppl' && !nameLower.includes('ppl') && !nameLower.includes('push') && !nameLower.includes('pull') && !nameLower.includes('legs')) return false;
        if (selectedCategory === 'arnold' && !nameLower.includes('arnold')) return false;
        if (selectedCategory === 'upper_lower' && !nameLower.includes('upper') && !nameLower.includes('lower')) return false;
        if (selectedCategory === 'full_body' && !nameLower.includes('full body')) return false;
        if (selectedCategory === 'bro_split' && !nameLower.includes('bro split')) return false;
      }

      return matchesSearch;
    });
  }, [libraryRoutines, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-400" />
            <span>Program Library</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              Official Splits
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Science-backed training programs, Arnold splits, PPL routines, and hypertrophy templates. Tap to preview or copy into your routines.
          </p>
        </div>

        {onNavigateToWorkouts && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 self-start sm:self-auto"
            onClick={onNavigateToWorkouts}
          >
            <span>My Routines</span>
            <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
          </Button>
        )}
      </div>

      {/* Search & Category Filter Pills */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search programs by name or exercise (e.g. Incline Bench, Arnold, Pull)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 text-xs"
          />
        </div>

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
      </div>

      {/* Programs Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 bg-dark-800/60 rounded-2xl border border-dark-700/60 animate-pulse"
            />
          ))}
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-dark-800 rounded-2xl p-6 bg-dark-900/40">
          <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-300">No programs found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            Try choosing a different split category filter or clearing your search keywords.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="text-xs"
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPrograms.map((routine) => {
            const isJustCopied = copiedRoutineId === routine.id;

            return (
              <Card
                key={routine.id}
                onClick={() => setSelectedRoutinePreview(routine)}
                className="p-4 bg-dark-800/90 border border-dark-700/80 hover:border-brand-500/50 transition-all flex flex-col justify-between shadow-lg cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-bold text-white leading-snug group-hover:text-brand-400 transition-colors break-words">
                        {routine.name}
                      </h3>

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
                        <span>•</span>
                        <span className="text-[10px] text-brand-400 font-semibold bg-brand-500/10 px-1.5 py-0.2 rounded border border-brand-500/20">
                          Template
                        </span>
                      </div>
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
                        setCustomizingRoutine(routine);
                      }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/25 transition-all flex items-center gap-1.5 shadow-sm"
                      title="Customize sets, reps and exercises in editor"
                    >
                      <Plus className="w-3.5 h-3.5 text-brand-400" />
                      <span>Customize</span>
                    </button>

                    <button
                      onClick={() => cloneRoutineMutation.mutate(routine)}
                      disabled={cloneRoutineMutation.isPending}
                      className={`text-xs px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-sm ${
                        isJustCopied
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-dark-900 hover:bg-dark-700 text-zinc-300 border-dark-700'
                      }`}
                      title="Add direct copy to My Routines"
                    >
                      {isJustCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Added!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Add to My Routines</span>
                        </>
                      )}
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
          setCustomizingRoutine(r as Routine);
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

      {/* Routine Creator / Editor Modal (for customizing) */}
      <RoutineEditorModal
        isOpen={Boolean(customizingRoutine)}
        initialRoutine={customizingRoutine}
        onClose={() => {
          setCustomizingRoutine(null);
        }}
      />
    </div>
  );
};
