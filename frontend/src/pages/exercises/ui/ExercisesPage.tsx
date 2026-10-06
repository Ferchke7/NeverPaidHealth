import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  BookOpen,
  X,
  Info,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Exercise, MuscleGroup, Equipment, MeasurementType } from '../../../entities/exercise/model/types.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { ExerciseInfoModal } from '../../../features/exercise-detail/ui/ExerciseInfoModal.tsx';

const MUSCLE_GROUPS: { label: string; value: MuscleGroup | 'all' }[] = [
  { label: 'All Muscles', value: 'all' },
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Quads & Legs', value: 'quads' },
  { label: 'Hamstrings & Glutes', value: 'hamstrings' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Biceps', value: 'biceps' },
  { label: 'Triceps', value: 'triceps' },
  { label: 'Core / Abs', value: 'core' },
  { label: 'Calves', value: 'calves' },
];

const EQUIPMENT_LIST: { label: string; value: Equipment | 'all' }[] = [
  { label: 'All Equipment', value: 'all' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Cable', value: 'cable' },
  { label: 'Machine', value: 'machine' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Kettlebell', value: 'kettlebell' },
  { label: 'Smith Machine', value: 'smith_machine' },
];

export const ExercisesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | 'all'>('all');
  const [selectedExerciseDetail, setSelectedExerciseDetail] = useState<Exercise | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Active workout hooks
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const addExerciseToActive = useActiveWorkoutStore((s) => s.addExercise);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

  // Custom exercise form state
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('chest');
  const [customEquipment, setCustomEquipment] = useState<Equipment>('barbell');
  const [customType, setCustomType] = useState<MeasurementType>('weight_reps');
  const [customInstructions, setCustomInstructions] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: exercises = [], isLoading } = useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: () => apiClient<Exercise[]>('/exercises'),
  });

  const createExerciseMutation = useMutation({
    mutationFn: async () => {
      if (!customName.trim()) {
        throw new Error('Exercise name is required');
      }
      return apiClient('/exercises', {
        method: 'POST',
        body: JSON.stringify({
          name: customName.trim(),
          primary_muscle_group: customMuscle,
          equipment: customEquipment,
          measurement_type: customType,
          instructions: customInstructions.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setCustomName('');
      setCustomInstructions('');
      setFormError(null);
      setIsCustomModalOpen(false);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create exercise');
    },
  });

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      const muscle = (ex.primary_muscle || ex.primary_muscle_group || '').toLowerCase();
      const equip = (ex.equipment || '').toLowerCase();
      const name = ex.name.toLowerCase();
      const query = search.toLowerCase();

      const matchesSearch =
        name.includes(query) ||
        muscle.includes(query) ||
        equip.includes(query);

      const matchesMuscle =
        selectedMuscle === 'all' ||
        muscle === selectedMuscle ||
        (selectedMuscle === 'quads' && (muscle === 'quads' || muscle === 'legs')) ||
        (selectedMuscle === 'hamstrings' && (muscle === 'hamstrings' || muscle === 'glutes'));

      const matchesEquipment =
        selectedEquipment === 'all' || equip === selectedEquipment;

      return matchesSearch && matchesMuscle && matchesEquipment;
    });
  }, [exercises, search, selectedMuscle, selectedEquipment]);

  const handleAddToActiveWorkout = (exercise: Exercise) => {
    addExerciseToActive(
      exercise.id,
      exercise.name,
      typeof exercise.measurement_type === 'string'
        ? exercise.measurement_type
        : 'weight_reps'
    );
    openSheet();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Exercise Library</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              {exercises.length} Movements
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Browse standard gym movements, target muscles, equipment, or create custom exercises.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="text-xs flex items-center gap-1.5"
          onClick={() => setIsCustomModalOpen(true)}
        >
          <Plus className="w-4 h-4 text-brand-400" />
          <span>Custom Exercise</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search exercises by name, muscle, or equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 text-xs"
          />
        </div>

        {/* Muscle group filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m.value}
              onClick={() => setSelectedMuscle(m.value)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                selectedMuscle === m.value
                  ? 'bg-brand-500 text-dark-950 font-bold shadow-md shadow-brand-500/20'
                  : 'bg-dark-800 text-zinc-400 hover:text-zinc-200 hover:bg-dark-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Equipment filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {EQUIPMENT_LIST.map((eq) => (
            <button
              key={eq.value}
              onClick={() => setSelectedEquipment(eq.value)}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
                selectedEquipment === eq.value
                  ? 'bg-dark-700 text-brand-400 border border-brand-500/40 font-bold'
                  : 'bg-dark-900/60 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {eq.label}
            </button>
          ))}
        </div>
      </div>

      {/* Exercises Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-20 bg-dark-800/60 rounded-xl border border-dark-700 animate-pulse"
            />
          ))}
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-dark-800 rounded-2xl p-6 bg-dark-900/40">
          <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-300">No exercises found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search query or filters, or create a custom exercise.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCustomModalOpen(true)}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1 text-brand-400" />
            Create Custom Exercise
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredExercises.map((exercise) => {
            const muscle = exercise.primary_muscle || exercise.primary_muscle_group || 'General';

            return (
              <div
                key={exercise.id}
                onClick={() => setSelectedExerciseDetail(exercise)}
                className="bg-dark-800/90 border border-dark-700/80 hover:border-dark-600 rounded-xl p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-dark-750/90 shadow-md group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ExerciseThumbnail
                    exerciseName={exercise.name}
                    fallbackMuscle={muscle as string}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white truncate leading-snug group-hover:text-brand-400 transition-colors">
                      {exercise.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                      <span className="capitalize text-brand-400 font-semibold">{muscle}</span>
                      <span>•</span>
                      <span className="capitalize text-zinc-500">{exercise.equipment ? exercise.equipment.replace('_', ' ') : 'Barbell'}</span>
                      {exercise.is_custom && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400 font-bold text-[9px] bg-amber-400/10 px-1 py-0.2 rounded">
                            Custom
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {activeWorkout && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToActiveWorkout(exercise);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-brand-500 text-dark-950 font-bold text-[11px] shadow-sm hover:brightness-110 flex items-center gap-1"
                      title="Add to current active workout"
                    >
                      <Plus className="w-3 h-3 stroke-[3]" />
                      <span>Add</span>
                    </button>
                  )}
                  <div className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300">
                    <Info className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exercise Detail Modal with Animation & Form Guide */}
      {selectedExerciseDetail && (
        <ExerciseInfoModal
          isOpen={true}
          onClose={() => setSelectedExerciseDetail(null)}
          exerciseName={selectedExerciseDetail.name}
          fallbackMuscle={selectedExerciseDetail.primary_muscle || selectedExerciseDetail.primary_muscle_group}
          canAddToWorkout={Boolean(activeWorkout)}
          onAddToWorkout={() => {
            handleAddToActiveWorkout(selectedExerciseDetail);
            setSelectedExerciseDetail(null);
          }}
        />
      )}

      {/* Custom Exercise Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-dark-900 border border-dark-700 w-full max-w-md rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-dark-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Create Custom Exercise</h3>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-dark-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {formError && (
                <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-red-300 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Exercise Name *
                </label>
                <Input
                  placeholder="e.g. Incline Cable Flyes"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                    Primary Muscle
                  </label>
                  <select
                    value={customMuscle}
                    onChange={(e) => setCustomMuscle(e.target.value as MuscleGroup)}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="chest">Chest</option>
                    <option value="back">Back</option>
                    <option value="quads">Quads</option>
                    <option value="hamstrings">Hamstrings / Glutes</option>
                    <option value="shoulders">Shoulders</option>
                    <option value="biceps">Biceps</option>
                    <option value="triceps">Triceps</option>
                    <option value="core">Core / Abs</option>
                    <option value="calves">Calves</option>
                    <option value="full_body">Full Body</option>
                    <option value="cardio">Cardio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                    Equipment
                  </label>
                  <select
                    value={customEquipment}
                    onChange={(e) => setCustomEquipment(e.target.value as Equipment)}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="barbell">Barbell</option>
                    <option value="dumbbell">Dumbbell</option>
                    <option value="cable">Cable</option>
                    <option value="machine">Machine</option>
                    <option value="bodyweight">Bodyweight</option>
                    <option value="kettlebell">Kettlebell</option>
                    <option value="smith_machine">Smith Machine</option>
                    <option value="band">Band</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Measurement Type
                </label>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as MeasurementType)}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="weight_reps">Weight & Reps</option>
                  <option value="bodyweight_reps">Bodyweight Reps</option>
                  <option value="duration">Duration Only</option>
                  <option value="distance_duration">Distance & Duration</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Instructions (optional)
                </label>
                <Input
                  placeholder="Form cues and setup instructions"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 border-t border-dark-800 flex items-center justify-end gap-2 bg-dark-900/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCustomModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={createExerciseMutation.isPending}
                onClick={() => createExerciseMutation.mutate()}
                disabled={!customName.trim()}
              >
                Create Exercise
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
