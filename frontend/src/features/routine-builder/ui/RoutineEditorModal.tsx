import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown, Dumbbell, ArrowLeftRight, Edit3 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { ExercisePickerModal } from '../../exercise-picker/ui/ExercisePickerModal.tsx';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';

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
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSystemRoutine =
    !initialRoutine?.user_id ||
    initialRoutine?.user_id === '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    if (isOpen && initialRoutine) {
      const defaultName = isSystemRoutine
        ? initialRoutine.name?.includes('(Custom)')
          ? initialRoutine.name
          : `${initialRoutine.name || 'PPL Workout'} (Custom)`
        : initialRoutine.name || '';

      setName(defaultName);
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
  }, [isOpen, initialRoutine, isSystemRoutine]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error('Routine name is required');
      }
      if (exercises.length === 0) {
        throw new Error('Add at least one exercise to the routine');
      }

      const payload = {
        name: name.trim(),
        notes: notes.trim() || undefined,
        exercises: exercises.map((ex, idx) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          order_index: idx,
          target_sets: Number(ex.target_sets),
          target_reps_min: Number(ex.target_reps_min),
          target_reps_max: Number(ex.target_reps_max),
        })),
      };

      // If user is editing their existing routine (not a system library routine), update it via PUT
      if (initialRoutine?.id && !isSystemRoutine) {
        return apiClient(`/routines/${initialRoutine.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }

      // Otherwise create a new routine (cloning / customizing)
      return apiClient('/routines', {
        method: 'POST',
        body: JSON.stringify(payload),
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
    if (replacingIndex !== null) {
      setExercises((prev) =>
        prev.map((item, i) =>
          i === replacingIndex
            ? {
                ...item,
                exercise_id: exercise.id,
                exercise_name: exercise.name,
              }
            : item
        )
      );
      setReplacingIndex(null);
      return;
    }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-700 w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-dark-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
              {initialRoutine ? <Edit3 className="w-4 h-4" /> : <Dumbbell className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                {initialRoutine
                  ? isSystemRoutine
                    ? 'Customize Workout Routine'
                    : 'Edit Routine'
                  : 'Create Routine Template'}
              </h2>
              {isSystemRoutine && initialRoutine && (
                <p className="text-[11px] text-brand-400 font-medium">
                  Customizing from {initialRoutine.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
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
                placeholder="e.g. Push Hypertrophy Day"
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
                placeholder="e.g. Focus on chest stretch, RIR 1-2 on last sets"
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
                onClick={() => {
                  setReplacingIndex(null);
                  setIsPickerOpen(true);
                }}
                className="text-xs flex items-center gap-1.5 border-dashed hover:border-brand-500/50"
              >
                <Plus className="w-3.5 h-3.5 text-brand-400" />
                Add Exercise
              </Button>
            </div>

            {exercises.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-dark-800 rounded-2xl p-6 bg-dark-900/30">
                <Dumbbell className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-400">No exercises added yet.</p>
                <p className="text-xs text-zinc-500 mt-1 mb-4">
                  Add movements from the 870+ catalog to build your workout routine.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setReplacingIndex(null);
                    setIsPickerOpen(true);
                  }}
                  className="gap-1.5 text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add First Exercise
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {exercises.map((item, idx) => (
                  <div
                    key={`${item.exercise_id}-${idx}`}
                    className="bg-dark-800/80 border border-dark-700/80 p-3 rounded-2xl space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <ExerciseThumbnail
                          exerciseName={item.exercise_name}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-zinc-500 shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-bold text-white truncate">
                              {item.exercise_name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Controls: Replace, Move Up, Move Down, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setReplacingIndex(idx);
                            setIsPickerOpen(true);
                          }}
                          className="text-zinc-500 hover:text-brand-400 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title="Replace this exercise with another movement"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveExercise(idx, 'up')}
                          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === exercises.length - 1}
                          onClick={() => moveExercise(idx, 'down')}
                          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExercise(idx)}
                          className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title="Remove exercise"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Set and Rep targets */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs bg-dark-900/60 p-2 rounded-xl border border-dark-700/50">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                          Sets
                        </label>
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
                          className="w-full bg-dark-800 border border-dark-600 rounded-lg px-2 py-1 text-center font-mono font-bold text-white focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                          Min Reps
                        </label>
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
                          className="w-full bg-dark-800 border border-dark-600 rounded-lg px-2 py-1 text-center font-mono font-bold text-white focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                          Max Reps
                        </label>
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
                          className="w-full bg-dark-800 border border-dark-600 rounded-lg px-2 py-1 text-center font-mono font-bold text-white focus:outline-none focus:border-brand-500"
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
        <div className="p-4 border-t border-dark-800 flex items-center justify-end gap-2 bg-dark-900/80 shadow-lg">
          <Button variant="ghost" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || exercises.length === 0}
            className="font-bold px-4 shadow-lg shadow-brand-500/20"
          >
            {initialRoutine && !isSystemRoutine ? 'Save Changes' : 'Save as My Routine'}
          </Button>
        </div>
      </div>

      <ExercisePickerModal
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setReplacingIndex(null);
        }}
        onSelectExercise={handleSelectExercise}
      />
    </div>
  );
};
