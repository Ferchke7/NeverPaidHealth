import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, ArrowLeftRight, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Input, Textarea } from '../../../shared/ui/input.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { ExercisePickerModal } from '../../exercise-picker/ui/ExercisePickerModal.tsx';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { WeeklyPlanResponse, weeklyPlanApi } from '../../../entities/workout/api/weeklyPlanApi.ts';

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
  defaultWeekdays?: number[];
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

function normalizeRoutineBaseName(raw?: string): string {
  let s = (raw || '').toLowerCase().trim();
  const suffixes = ['(custom)', '(своя)', '(shaxsiy)'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (s.endsWith(suffix)) {
        s = s.slice(0, -suffix.length).trim();
        changed = true;
      }
    }
  }
  return s;
}

export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  defaultWeekdays,
  initialRoutine,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<RoutineExerciseFormItem[]>([]);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [weekdaysTouched, setWeekdaysTouched] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSystemRoutine =
    !initialRoutine?.user_id ||
    initialRoutine?.user_id === '00000000-0000-0000-0000-000000000000';

  const existingPersonalCopy = React.useMemo(() => {
    if (!isOpen || !initialRoutine || !isSystemRoutine) return null;
    const cached = queryClient.getQueryData<any[]>(['routines']);
    if (!Array.isArray(cached)) return null;
    const base = normalizeRoutineBaseName(initialRoutine.name);
    if (!base) return null;
    return (
      cached.find(
        (r) =>
          r?.user_id &&
          r.user_id !== '00000000-0000-0000-0000-000000000000' &&
          normalizeRoutineBaseName(r.name) === base
      ) || null
    );
  }, [isOpen, initialRoutine, isSystemRoutine, queryClient]);

  const effectiveSource = existingPersonalCopy || initialRoutine;

  useEffect(() => {
    if (isOpen && effectiveSource) {
      const customSuffix = t('routines.customSuffix');
      const isEditingSystemDirectly = isSystemRoutine && !existingPersonalCopy;
      const defaultName = isEditingSystemDirectly
        ? effectiveSource.name?.includes(customSuffix)
          ? effectiveSource.name
          : `${effectiveSource.name || t('routines.defaultName')} ${customSuffix}`
        : effectiveSource.name || '';

      setName(defaultName);
      setNotes(effectiveSource.notes || '');
      const initialExs = (effectiveSource.exercises || []).map((e: any) => ({
        exercise_id: e.exercise_id || e.exerciseId || e.id || '',
        exercise_name: e.exercise_name || e.exerciseName || e.name || t('routines.defaultName'),
        target_sets: e.target_sets || e.targetSets || 3,
        target_reps_min: e.target_reps_min || 8,
        target_reps_max: e.target_reps_max || 12,
      }));
      setExercises(initialExs);
      const cachedPlan = queryClient.getQueryData<WeeklyPlanResponse>(['workouts', 'weekly-plan']);
      const targetId = existingPersonalCopy?.id || initialRoutine?.id;
      const mappedDays = (cachedPlan?.items || [])
        .filter((it) => it.item_type === 'routine' && it.routine_id === targetId)
        .map((it) => it.day_of_week);
      setSelectedWeekdays(Array.from(new Set(mappedDays)).sort((a, b) => a - b));
      setWeekdaysTouched(false);
    } else if (isOpen && !initialRoutine) {
      setName('');
      setNotes('');
      setExercises([]);
      const preset = (defaultWeekdays || []).filter((d) => d >= 1 && d <= 7);
      setSelectedWeekdays(preset);
      setWeekdaysTouched(preset.length > 0);
    }
  }, [isOpen, initialRoutine, effectiveSource, existingPersonalCopy, isSystemRoutine, defaultWeekdays, queryClient, t]);

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
        notes: notes.trim(),
        exercises: exercises.map((ex, idx) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          order_index: idx,
          target_sets: Number(ex.target_sets),
          target_reps_min: Number(ex.target_reps_min),
          target_reps_max: Number(ex.target_reps_max),
        })),
      };

      const targetId = existingPersonalCopy?.id || initialRoutine?.id;
      let saved: any;
      if (targetId && !targetId.startsWith('prebuilt-')) {
        saved = await apiClient(`/routines/${targetId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        saved = await apiClient('/routines', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (saved?.id && (weekdaysTouched || selectedWeekdays.length > 0)) {
        try {
          const planRes = await weeklyPlanApi.setRoutineWeekdays(
            saved.id,
            selectedWeekdays,
            saved.name || name.trim()
          );
          queryClient.setQueryData(['workouts', 'weekly-plan'], planRes);
        } catch {
          // ignore non-blocking schedule sync error
        }
      }
      return saved;
    },
    onSuccess: (data: any) => {
      if (data?.id) {
        queryClient.setQueryData<any[] | undefined>(['routines'], (old) => {
          if (!Array.isArray(old)) return old;
          const idx = old.findIndex((r) => r.id === data.id);
          if (idx >= 0) {
            return old.map((r, i) => (i === idx ? data : r));
          }
          return [data, ...old];
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['routines'] });
      void queryClient.invalidateQueries({ queryKey: ['workouts', 'weekly-plan'] });
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
            <Button variant="outline" onClick={onClose} size="md">
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="md"
              isLoading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || exercises.length === 0}
            >
              {initialRoutine && !isSystemRoutine ? t('routines.saveChanges') : t('routines.saveRoutine')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[12px] text-[#DC2626] text-xs font-medium">
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

            <div className="space-y-1.5 pt-1">
              <div className="text-[12px] font-semibold text-[#1E1B4B]">
                {t('weeklyPlan.editorDaysLabel')}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {[
                  { day: 1, label: t('weeklyPlan.monShort') },
                  { day: 2, label: t('weeklyPlan.tueShort') },
                  { day: 3, label: t('weeklyPlan.wedShort') },
                  { day: 4, label: t('weeklyPlan.thuShort') },
                  { day: 5, label: t('weeklyPlan.friShort') },
                  { day: 6, label: t('weeklyPlan.satShort') },
                  { day: 7, label: t('weeklyPlan.sunShort') },
                ].map((wd) => {
                  const active = selectedWeekdays.includes(wd.day);
                  return (
                    <button
                      key={wd.day}
                      type="button"
                      onClick={() => {
                        setWeekdaysTouched(true);
                        setSelectedWeekdays((prev) =>
                          prev.includes(wd.day)
                            ? prev.filter((d) => d !== wd.day)
                            : [...prev, wd.day].sort((a, b) => a - b)
                        );
                      }}
                      className={`h-9 rounded-[10px] border text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        active
                          ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
                          : 'bg-[#F8F7FC] border-[#ECEAF6] text-[#1E1B4B] hover:border-[#C4B5FD]'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      <span>{wd.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Exercises Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#6B7280]">
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
              >
                <Plus className="w-3.5 h-3.5" />
                {t('routines.addExercise')}
              </Button>
            </div>

            {exercises.length === 0 ? (
              <div className="text-center py-8 border border-[#ECEAF6] rounded-[16px] p-6 bg-[#F8F7FC]">
                <p className="text-[14px] font-semibold text-[#1E1B4B]">{t('routines.noExercisesAdded')}</p>
                <p className="text-[13px] text-[#6B7280] mt-1 mb-4">
                  {t('routines.noExercisesDesc')}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setReplacingIndex(null);
                    setIsPickerOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {t('routines.selectExercise')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {exercises.map((item, idx) => (
                  <div
                    key={`${item.exercise_id}-${idx}`}
                    className="bg-[#F8F7FC] border border-[#ECEAF6] p-3.5 rounded-[16px] space-y-3"
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
                            <span className="text-xs font-bold text-[#6D28D9] shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-[14px] font-semibold text-[#1E1B4B] truncate">
                              {item.exercise_name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setReplacingIndex(idx);
                            setIsPickerOpen(true);
                          }}
                          className="text-[#6B7280] hover:text-[#6D28D9] p-2 rounded-[8px] hover:bg-[#F0EFFE] transition-colors cursor-pointer"
                          title={t('routines.replaceExercise')}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveExercise(idx, 'up')}
                          className="text-[#6B7280] hover:text-[#1E1B4B] disabled:opacity-30 p-2 rounded-[8px] hover:bg-white transition-colors cursor-pointer"
                          title={t('routines.moveUp')}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === exercises.length - 1}
                          onClick={() => moveExercise(idx, 'down')}
                          className="text-[#6B7280] hover:text-[#1E1B4B] disabled:opacity-30 p-2 rounded-[8px] hover:bg-white transition-colors cursor-pointer"
                          title={t('routines.moveDown')}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExercise(idx)}
                          className="text-[#6B7280] hover:text-[#EF4444] p-2 rounded-[8px] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#ECEAF6]">
                      <div>
                        <label className="text-[11px] font-medium text-[#6B7280] block mb-1">
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
                          className="w-full h-10 bg-white border border-[#E2E0F0] rounded-[10px] px-2 text-center font-mono text-[14px] text-[#1E1B4B] focus:outline-none focus:border-[#6D28D9]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[#6B7280] block mb-1">
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
                          className="w-full h-10 bg-white border border-[#E2E0F0] rounded-[10px] px-2 text-center font-mono text-[14px] text-[#1E1B4B] focus:outline-none focus:border-[#6D28D9]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[#6B7280] block mb-1">
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
                          className="w-full h-10 bg-white border border-[#E2E0F0] rounded-[10px] px-2 text-center font-mono text-[14px] text-[#1E1B4B] focus:outline-none focus:border-[#6D28D9]"
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
