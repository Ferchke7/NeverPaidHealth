import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Dumbbell, ArrowLeftRight, Edit3 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Input, Textarea } from '../../../shared/ui/input.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { ExercisePickerModal } from '../../exercise-picker/ui/ExercisePickerModal.tsx';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

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
  const { t } = useTranslation();
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
      const customSuffix = t('routines.customSuffix');
      const defaultName = isSystemRoutine
        ? initialRoutine.name?.includes(customSuffix)
          ? initialRoutine.name
          : `${initialRoutine.name || t('routines.defaultName')} ${customSuffix}`
        : initialRoutine.name || '';

      setName(defaultName);
      setNotes(initialRoutine.notes || '');
      const initialExs = (initialRoutine.exercises || []).map((e) => ({
        exercise_id: e.exercise_id || e.exerciseId || e.id || '',
        exercise_name: e.exercise_name || e.exerciseName || e.name || t('routines.defaultName'),
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
  }, [isOpen, initialRoutine, isSystemRoutine, t]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error(t('routines.nameRequired'));
      }
      if (exercises.length === 0) {
        throw new Error(t('routines.addAtLeastOneExercise'));
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

      if (initialRoutine?.id && !isSystemRoutine) {
        return apiClient(`/routines/${initialRoutine.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }

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
      setError(err.message || t('routines.saveError'));
    },
  });

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
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        icon={
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0">
            {initialRoutine ? <Edit3 className="w-4 h-4" /> : <Dumbbell className="w-4 h-4" />}
          </div>
        }
        title={
          initialRoutine
            ? isSystemRoutine
              ? t('routines.editorCustomizing')
              : t('routines.editorEditing')
            : t('routines.editorCreating')
        }
        subtitle={
          isSystemRoutine && initialRoutine
            ? t('routines.basedOn', { name: initialRoutine.name || '' })
            : t('routines.editorSubtitle')
        }
        footer={
          <>
            <Button variant="ghost" onClick={onClose} size="sm">
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || exercises.length === 0}
              className="font-bold px-4 shadow-lg shadow-brand-500/20"
            >
              {initialRoutine && !isSystemRoutine ? t('routines.saveChanges') : t('routines.saveRoutine')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Input
              label={t('routines.nameLabel')}
              placeholder={t('routines.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <Textarea
              label={t('routines.notesLabel')}
              placeholder={t('routines.notesPlaceholder')}
              value={notes}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Exercises Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {t('routines.exercisesCount', { count: exercises.length })}
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
                {t('routines.addExercise')}
              </Button>
            </div>

            {exercises.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-dark-750 rounded-2xl p-6 bg-dark-900/40">
                <Dumbbell className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-400">{t('routines.noExercisesAdded')}</p>
                <p className="text-xs text-zinc-500 mt-1 mb-4">
                  {t('routines.noExercisesDesc')}
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
                  {t('routines.selectExercise')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {exercises.map((item, idx) => (
                  <div
                    key={`${item.exercise_id}-${idx}`}
                    className="bg-dark-800/90 border border-dark-700/80 p-3 rounded-2xl space-y-2.5 shadow-sm"
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
                            <span className="text-xs font-bold text-brand-400 shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-bold text-white truncate">
                              {item.exercise_name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setReplacingIndex(idx);
                            setIsPickerOpen(true);
                          }}
                          className="text-zinc-500 hover:text-brand-400 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title={t('routines.replaceExercise')}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveExercise(idx, 'up')}
                          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title={t('routines.moveUp')}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === exercises.length - 1}
                          onClick={() => moveExercise(idx, 'down')}
                          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title={t('routines.moveDown')}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExercise(idx)}
                          className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-dark-700 transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Set and Rep targets */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs bg-dark-900/80 p-2.5 rounded-xl border border-dark-750">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                          {t('routines.sets')}
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
                          {t('routines.minReps')}
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
                          {t('routines.maxReps')}
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
      </Modal>

      <ExercisePickerModal
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setReplacingIndex(null);
        }}
        onSelectExercise={handleSelectExercise}
      />
    </>
  );
};
