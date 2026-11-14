import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowLeftRight,
  Globe,
  Lock,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Input, Textarea } from '../../../shared/ui/input.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { ExercisePickerModal } from '../../exercise-picker/ui/ExercisePickerModal.tsx';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { Program, ProgramDay, ProgramDayExercise, SplitType, ProgramLevel } from '../../../entities/program/model/types.ts';

interface ProgramEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (programId: string) => void;
  initialProgram?: Program | null;
}

export const ProgramEditorModal: React.FC<ProgramEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialProgram,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('ppl');
  const [level, setLevel] = useState<ProgramLevel>('intermediate');
  const [isPublic, setIsPublic] = useState(false);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingExerciseIndex, setReplacingExerciseIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialProgram) {
      setName(initialProgram.name || '');
      setDescription(initialProgram.description || '');
      setSplitType(initialProgram.split_type || 'ppl');
      setLevel(initialProgram.level || 'intermediate');
      setIsPublic(Boolean(initialProgram.is_public));

      if (initialProgram.days && initialProgram.days.length > 0) {
        setDays(
          initialProgram.days.map((d, idx) => ({
            day_number: idx + 1,
            name: d.name || `${t('programs.day')} ${idx + 1}`,
            notes: d.notes || '',
            exercises: (d.exercises || []).map((e, exIdx) => ({
              exercise_id: e.exercise_id,
              exercise_name: e.exercise_name,
              order_index: exIdx,
              target_sets: e.target_sets || 3,
              target_reps_min: e.target_reps_min || 8,
              target_reps_max: e.target_reps_max || 12,
            })),
          }))
        );
      } else {
        setDays([
          {
            day_number: 1,
            name: `${t('programs.day')} 1: Push`,
            notes: '',
            exercises: [],
          },
        ]);
      }
      setActiveDayIndex(0);
      setError(null);
    } else if (isOpen && !initialProgram) {
      setName('');
      setDescription('');
      setSplitType('ppl');
      setLevel('intermediate');
      setIsPublic(false);
      setDays([
        {
          day_number: 1,
          name: `${t('programs.day')} 1: Push`,
          notes: '',
          exercises: [],
        },
        {
          day_number: 2,
          name: `${t('programs.day')} 2: Pull`,
          notes: '',
          exercises: [],
        },
        {
          day_number: 3,
          name: `${t('programs.day')} 3: Legs`,
          notes: '',
          exercises: [],
        },
      ]);
      setActiveDayIndex(0);
      setError(null);
    }
  }, [isOpen, initialProgram, t]);

  const currentDay = days[activeDayIndex] || days[0];

  const handleAddDay = () => {
    const nextNum = days.length + 1;
    const newDay: ProgramDay = {
      day_number: nextNum,
      name: `${t('programs.day')} ${nextNum}`,
      notes: '',
      exercises: [],
    };
    setDays((prev) => [...prev, newDay]);
    setActiveDayIndex(days.length);
  };

  const handleRemoveDay = (dayIndex: number) => {
    if (days.length <= 1) {
      return;
    }
    const updated = days
      .filter((_, idx) => idx !== dayIndex)
      .map((d, idx) => ({
        ...d,
        day_number: idx + 1,
      }));
    setDays(updated);
    if (activeDayIndex >= updated.length) {
      setActiveDayIndex(updated.length - 1);
    }
  };

  const updateCurrentDay = (updates: Partial<ProgramDay>) => {
    setDays((prev) =>
      prev.map((d, idx) => (idx === activeDayIndex ? { ...d, ...updates } : d))
    );
  };

  const handleSelectExercise = (exercise: Exercise) => {
    if (!currentDay) return;

    if (replacingExerciseIndex !== null) {
      const updatedExercises = currentDay.exercises.map((item, i) =>
        i === replacingExerciseIndex
          ? {
              ...item,
              exercise_id: exercise.id,
              exercise_name: exercise.name,
            }
          : item
      );
      updateCurrentDay({ exercises: updatedExercises });
      setReplacingExerciseIndex(null);
      return;
    }

    if (currentDay.exercises.some((e) => e.exercise_id === exercise.id)) {
      return;
    }

    const newEx: ProgramDayExercise = {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      order_index: currentDay.exercises.length,
      target_sets: 3,
      target_reps_min: 8,
      target_reps_max: 12,
    };

    updateCurrentDay({
      exercises: [...currentDay.exercises, newEx],
    });
  };

  const updateExercise = (exerciseIndex: number, updates: Partial<ProgramDayExercise>) => {
    if (!currentDay) return;
    const updatedExercises = currentDay.exercises.map((item, i) =>
      i === exerciseIndex ? { ...item, ...updates } : item
    );
    updateCurrentDay({ exercises: updatedExercises });
  };

  const removeExercise = (exerciseIndex: number) => {
    if (!currentDay) return;
    const updatedExercises = currentDay.exercises
      .filter((_, i) => i !== exerciseIndex)
      .map((item, idx) => ({ ...item, order_index: idx }));
    updateCurrentDay({ exercises: updatedExercises });
  };

  const moveExercise = (exerciseIndex: number, direction: 'up' | 'down') => {
    if (!currentDay) return;
    const targetIndex = direction === 'up' ? exerciseIndex - 1 : exerciseIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentDay.exercises.length) return;

    const copy = [...currentDay.exercises];
    const temp = copy[exerciseIndex];
    copy[exerciseIndex] = copy[targetIndex];
    copy[targetIndex] = temp;

    const reindexed = copy.map((ex, idx) => ({ ...ex, order_index: idx }));
    updateCurrentDay({ exercises: reindexed });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error(t('programs.nameRequired'));
      }
      if (days.length === 0) {
        throw new Error(t('programs.addAtLeastOneDay'));
      }
      for (const day of days) {
        if (day.exercises.length === 0) {
          throw new Error(
            t('programs.dayNeedsExercise', { day: day.name || `${day.day_number}` })
          );
        }
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        split_type: splitType,
        days_per_week: days.length,
        level,
        is_public: isPublic,
        days: days.map((d, dIdx) => ({
          day_number: dIdx + 1,
          name: d.name.trim() || `${t('programs.day')} ${dIdx + 1}`,
          notes: d.notes?.trim() || undefined,
          exercises: d.exercises.map((ex, eIdx) => ({
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            order_index: eIdx,
            target_sets: Number(ex.target_sets),
            target_reps_min: Number(ex.target_reps_min || 8),
            target_reps_max: Number(ex.target_reps_max || 12),
          })),
        })),
      };

      if (initialProgram?.id) {
        return apiClient<Program>(`/programs/${initialProgram.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }

      return apiClient<Program>('/programs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'user'] });
      void queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
      setError(null);
      onClose();
      if (onSaved && data?.id) {
        onSaved(data.id);
      }
    },
    onError: (err: any) => {
      setError(err.message || t('programs.saveError'));
    },
  });

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        title={initialProgram ? t('programs.editProgram') : t('programs.createProgram')}
        subtitle={t('programs.editorSubtitle')}
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
              disabled={!name.trim() || days.length === 0}
            >
              {initialProgram ? t('programs.saveChanges') : t('programs.saveAndPublish')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-[#262626] border border-red-500/40 rounded-[10px] text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Input
              label={t('programs.nameLabel')}
              placeholder={t('programs.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <Textarea
              label={t('programs.descLabel')}
              placeholder={t('programs.descPlaceholder')}
              value={description}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[12px] font-medium text-[#a3a3a3] block mb-1.5">
                  {t('programs.splitType')}
                </label>
                <select
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value as SplitType)}
                  className="w-full h-11 bg-[#0a0a0a] border border-[#404040] rounded-[10px] px-3 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#34d399]"
                >
                  <option value="ppl">{t('programs.splitPpl')}</option>
                  <option value="upper_lower">{t('programs.splitUpperLower')}</option>
                  <option value="full_body">{t('programs.splitFullBody')}</option>
                  <option value="bro_split">{t('programs.splitBroSplit')}</option>
                  <option value="custom">{t('programs.splitCustom')}</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#a3a3a3] block mb-1.5">
                  {t('programs.level')}
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as ProgramLevel)}
                  className="w-full h-11 bg-[#0a0a0a] border border-[#404040] rounded-[10px] px-3 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#34d399]"
                >
                  <option value="beginner">{t('programs.levelBeginner')}</option>
                  <option value="intermediate">{t('programs.levelIntermediate')}</option>
                  <option value="advanced">{t('programs.levelAdvanced')}</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#a3a3a3] block mb-1.5">
                  {t('programs.sharing')}
                </label>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`w-full h-11 flex items-center justify-between px-3 rounded-[10px] border text-[13px] font-medium transition-colors cursor-pointer ${
                    isPublic
                      ? 'bg-[#022c22] border-[#34d399]/30 text-[#34d399]'
                      : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {isPublic ? (
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{isPublic ? t('programs.publicCommunity') : t('programs.privatePersonal')}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Multi-Day Split Section */}
          <div className="pt-3 border-t border-[#262626] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                {t('programs.trainingDays', { count: days.length })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddDay}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('programs.addDay')}</span>
              </Button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {days.map((d, idx) => {
                const isActive = idx === activeDayIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveDayIndex(idx)}
                    className={`h-[40px] px-3.5 rounded-[8px] text-[13px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#022c22] text-[#34d399]'
                        : 'bg-[#0a0a0a] border border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                    }`}
                  >
                    <span>
                      {t('programs.dayShort')} {idx + 1}
                    </span>
                    <span className="text-[11px] opacity-75">
                      ({d.exercises.length})
                    </span>
                  </button>
                );
              })}
            </div>

            {currentDay && (
              <div className="bg-[#0a0a0a] border border-[#404040] p-4 rounded-[14px] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={currentDay.name}
                      onChange={(e) => updateCurrentDay({ name: e.target.value })}
                      placeholder={t('programs.dayNamePlaceholder')}
                      className="h-11 bg-[#171717] border border-[#404040] rounded-[10px] px-3 text-[13px] text-[#fafafa] font-medium focus:outline-none focus:border-[#34d399]"
                    />
                    <input
                      type="text"
                      value={currentDay.notes || ''}
                      onChange={(e) => updateCurrentDay({ notes: e.target.value })}
                      placeholder={t('programs.dayNotesPlaceholder')}
                      className="h-11 bg-[#171717] border border-[#404040] rounded-[10px] px-3 text-[13px] text-[#a3a3a3] focus:outline-none focus:border-[#34d399]"
                    />
                  </div>

                  {days.length > 1 && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveDay(activeDayIndex)}
                      title={t('programs.deleteDay')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('programs.deleteDay')}</span>
                    </Button>
                  )}
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#a3a3a3]">
                      {t('programs.exercisesForDay', { count: currentDay.exercises.length })}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReplacingExerciseIndex(null);
                        setIsPickerOpen(true);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('routines.addExercise')}</span>
                    </Button>
                  </div>

                  {currentDay.exercises.length === 0 ? (
                    <div className="text-center py-6 border border-[#404040] rounded-[12px] p-4 bg-[#171717]">
                      <p className="text-[13px] font-medium text-[#fafafa]">
                        {t('programs.noExercisesInDay')}
                      </p>
                      <p className="text-[12px] text-[#a3a3a3] mt-1 mb-3">
                        {t('programs.noExercisesInDayDesc')}
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setReplacingExerciseIndex(null);
                          setIsPickerOpen(true);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('routines.selectExercise')}</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {currentDay.exercises.map((item, exIdx) => (
                        <div
                          key={`${item.exercise_id}-${exIdx}`}
                          className="bg-[#171717] border border-[#404040] p-3 rounded-[12px] space-y-2.5"
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
                                  <span className="text-xs font-medium text-[#34d399] shrink-0">
                                    #{exIdx + 1}
                                  </span>
                                  <span className="text-[14px] font-medium text-[#fafafa] truncate">
                                    {item.exercise_name}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplacingExerciseIndex(exIdx);
                                  setIsPickerOpen(true);
                                }}
                                className="text-[#a3a3a3] hover:text-[#34d399] p-2 rounded-[8px] hover:bg-[#262626] transition-colors cursor-pointer"
                                title={t('routines.replaceExercise')}
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={exIdx === 0}
                                onClick={() => moveExercise(exIdx, 'up')}
                                className="text-[#a3a3a3] hover:text-[#fafafa] disabled:opacity-30 p-2 rounded-[8px] hover:bg-[#262626] transition-colors cursor-pointer"
                                title={t('routines.moveUp')}
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={exIdx === currentDay.exercises.length - 1}
                                onClick={() => moveExercise(exIdx, 'down')}
                                className="text-[#a3a3a3] hover:text-[#fafafa] disabled:opacity-30 p-2 rounded-[8px] hover:bg-[#262626] transition-colors cursor-pointer"
                                title={t('routines.moveDown')}
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeExercise(exIdx)}
                                className="text-[#a3a3a3] hover:text-red-400 p-2 rounded-[8px] hover:bg-[#262626] transition-colors cursor-pointer"
                                title={t('common.delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#262626]">
                            <div>
                              <label className="text-[11px] font-medium text-[#a3a3a3] block mb-1">
                                {t('routines.sets')}
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={item.target_sets}
                                onChange={(e) =>
                                  updateExercise(exIdx, {
                                    target_sets: Math.max(1, parseInt(e.target.value) || 1),
                                  })
                                }
                                className="w-full h-10 bg-[#0a0a0a] border border-[#404040] rounded-[8px] px-2 text-center font-mono text-[13px] text-[#fafafa] focus:outline-none focus:border-[#34d399]"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-[#a3a3a3] block mb-1">
                                {t('routines.minReps')}
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={item.target_reps_min}
                                onChange={(e) =>
                                  updateExercise(exIdx, {
                                    target_reps_min: Math.max(1, parseInt(e.target.value) || 1),
                                  })
                                }
                                className="w-full h-10 bg-[#0a0a0a] border border-[#404040] rounded-[8px] px-2 text-center font-mono text-[13px] text-[#fafafa] focus:outline-none focus:border-[#34d399]"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-[#a3a3a3] block mb-1">
                                {t('routines.maxReps')}
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={item.target_reps_max}
                                onChange={(e) =>
                                  updateExercise(exIdx, {
                                    target_reps_max: Math.max(1, parseInt(e.target.value) || 1),
                                  })
                                }
                                className="w-full h-10 bg-[#0a0a0a] border border-[#404040] rounded-[8px] px-2 text-center font-mono text-[13px] text-[#fafafa] focus:outline-none focus:border-[#34d399]"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ExercisePickerModal
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setReplacingExerciseIndex(null);
        }}
        onSelectExercise={handleSelectExercise}
      />
    </>
  );
};
