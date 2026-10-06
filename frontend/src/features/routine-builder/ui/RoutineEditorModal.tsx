import React, { useState } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown, Dumbbell } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { ExercisePickerModal } from '../../exercise-picker/ui/ExercisePickerModal.tsx';
import { Exercise } from '../../../entities/exercise/model/types.ts';

interface RoutineExerciseFormItem {
  exercise_id: string;
  exercise_name: string;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
}

interface RoutineEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (routineId: string) => void;
  initialRoutine?: {
    id?: string;
    name?: string;
    notes?: string;
    user_id?: string;
    exercises?: Array<{
      exercise_id?: string;
      exerciseId?: string;
      id?: string;
      exercise_name?: string;
      exerciseName?: string;
      name?: string;
      target_sets?: number;
      targetSets?: number;
      target_reps_min?: number;
      target_reps_max?: number;
    }>;
  } | null;
}

export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialRoutine,
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<RoutineExerciseFormItem[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && initialRoutine) {
      setName(initialRoutine.name || '');
      setNotes(initialRoutine.notes || '');
      const initialExs = (initialRoutine.exercises || []).map((e) => ({
        exercise_id: e.exercise_id || e.exerciseId || e.id || '',
        exercise_name: e.exercise_name || e.exerciseName || e.name || 'Exercise',
        target_sets: e.target_sets || e.targetSets || 3,
        target_reps_min: e.target_reps_min || 8,
        target_reps_max: e.target_reps_max || 12,
      }));
      setExercises(initialExs);
    } else if (isOpen && !initialRoutine) {
      setName('');
      setNotes('');
      setExercises([]);
    }
  }, [isOpen, initialRoutine]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error('Routine name is required');
      }
      if (exercises.length === 0) {
        throw new Error('Add at least one exercise to the routine');
      }

      return apiClient('/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          notes: notes.trim() || undefined,
          exercises: exercises.map((ex) => ({
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            target_sets: Number(ex.target_sets),
            target_reps_min: Number(ex.target_reps_min),
            target_reps_max: Number(ex.target_reps_max),
          })),
        }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      setName('');
      setNotes('');
      setExercises([]);
      setError(null);
      onClose();
      if (onSaved && data?.id) {
        onSaved(data.id);
      }
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save routine');
    },
  });

  if (!isOpen) return null;

  const handleSelectExercise = (exercise: Exercise) => {
    if (exercises.some((e) => e.exercise_id === exercise.id)) {
      return;
    }
    setExercises((prev) => [
      ...prev,
      {
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        target_sets: 3,
        target_reps_min: 8,
        target_reps_max: 12,
      },
    ]);
  };

  const updateExercise = (index: number, updates: Partial<RoutineExerciseFormItem>) => {
    setExercises((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= exercises.length) return;
    setExercises((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-700 w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-dark-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Create Routine Template</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Routine Name *
              </label>
              <Input
                placeholder="e.g. Upper Body Push A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Notes (optional)
              </label>
              <Input
                placeholder="e.g. Focus on chest stretch and progressive overload"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Exercises Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Exercises ({exercises.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPickerOpen(true)}
                className="text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Exercise
              </Button>
            </div>

            {exercises.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-dark-700 rounded-xl">
                <p className="text-sm text-zinc-500">No exercises added yet.</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Add exercises to define targets and rep ranges.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {exercises.map((item, idx) => (
                  <div
                    key={item.exercise_id}
                    className="bg-dark-800 border border-dark-700 p-3 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-500 w-4">
                          {idx + 1}.
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {item.exercise_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveExercise(idx, 'up')}
                          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 p-1"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === exercises.length - 1}
                          onClick={() => moveExercise(idx, 'down')}
                          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 p-1"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExercise(idx)}
                          className="text-zinc-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Set and Rep targets */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                      <div>
                        <label className="text-zinc-400 block mb-1">Target Sets</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={item.target_sets}
                          onChange={(e) =>
                            updateExercise(idx, {
                              target_sets: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="w-full bg-dark-900 border border-dark-600 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-white focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 block mb-1">Min Reps</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={item.target_reps_min}
                          onChange={(e) =>
                            updateExercise(idx, {
                              target_reps_min: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="w-full bg-dark-900 border border-dark-600 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-white focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 block mb-1">Max Reps</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={item.target_reps_max}
                          onChange={(e) =>
                            updateExercise(idx, {
                              target_reps_max: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="w-full bg-dark-900 border border-dark-600 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-white focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-800 flex items-center justify-end gap-2 bg-dark-900/50">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || exercises.length === 0}
          >
            Save Routine
          </Button>
        </div>
      </div>

      <ExercisePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectExercise={handleSelectExercise}
      />
    </div>
  );
};
