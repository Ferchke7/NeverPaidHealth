import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  BookOpen,
  Info,
  Edit3,
  Trash2,
  Dumbbell,
  Sparkles,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Exercise, MuscleGroup, Equipment, MeasurementType } from '../../../entities/exercise/model/types.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { ExerciseInfoModal } from '../../../features/exercise-detail/ui/ExerciseInfoModal.tsx';

import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

const MUSCLE_GROUPS: { value: MuscleGroup | 'all'; key: string }[] = [
  { value: 'all', key: 'exercises.allMuscles' },
  { value: 'chest', key: 'exercises.chest' },
  { value: 'back', key: 'exercises.back' },
  { value: 'quads', key: 'exercises.quads' },
  { value: 'hamstrings', key: 'exercises.hamstrings' },
  { value: 'shoulders', key: 'exercises.shoulders' },
  { value: 'biceps', key: 'exercises.biceps' },
  { value: 'triceps', key: 'exercises.triceps' },
  { value: 'core', key: 'exercises.core' },
  { value: 'calves', key: 'exercises.calves' },
];

const EQUIPMENT_LIST: { value: Equipment | 'all'; key: string }[] = [
  { value: 'all', key: 'exercises.allEquipment' },
  { value: 'barbell', key: 'exercises.barbell' },
  { value: 'dumbbell', key: 'exercises.dumbbell' },
  { value: 'cable', key: 'exercises.cable' },
  { value: 'machine', key: 'exercises.machine' },
  { value: 'bodyweight', key: 'exercises.bodyweight' },
  { value: 'kettlebell', key: 'exercises.kettlebell' },
  { value: 'smith_machine', key: 'exercises.smithMachine' },
];

export const ExercisesPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | 'all'>('all');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [selectedExerciseDetail, setSelectedExerciseDetail] = useState<Exercise | null>(null);

  // Custom exercise modal state (Create / Edit)
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  // Active workout hooks
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const addExerciseToActive = useActiveWorkoutStore((s) => s.addExercise);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

  // Custom exercise form state
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('chest');
  const [customEquipment, setCustomEquipment] = useState<Equipment>('barbell');
  const [customType, setCustomType] = useState<MeasurementType>('weight_reps');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: exercises = [], isLoading } = useQuery<Exercise[]>({
    queryKey: ['exercises'],
    queryFn: () => apiClient<Exercise[]>('/exercises'),
  });

  const openCreateModal = () => {
    setEditingExercise(null);
    setCustomName('');
    setCustomMuscle('chest');
    setCustomEquipment('barbell');
    setCustomType('weight_reps');
    setFormError(null);
    setIsCustomModalOpen(true);
  };

  const openEditModal = (ex: Exercise) => {
    setEditingExercise(ex);
    setCustomName(ex.name);
    setCustomMuscle((ex.primary_muscle || ex.primary_muscle_group || 'chest') as MuscleGroup);
    setCustomEquipment((ex.equipment || 'barbell') as Equipment);
    setCustomType(
      (typeof ex.measurement_type === 'string'
        ? ex.measurement_type
        : 'weight_reps') as MeasurementType
    );
    setFormError(null);
    setIsCustomModalOpen(true);
  };

  const saveExerciseMutation = useMutation({
    mutationFn: async () => {
      if (!customName.trim()) {
        throw new Error(t('exercises.nameRequired'));
      }

      const payload = {
        name: customName.trim(),
        primary_muscle_group: customMuscle,
        equipment: customEquipment,
        measurement_type: customType,
      };

      if (editingExercise) {
        return apiClient(`/exercises/${editingExercise.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }

      return apiClient('/exercises', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setCustomName('');
      setFormError(null);
      setIsCustomModalOpen(false);
      setEditingExercise(null);
    },
    onError: (err: any) => {
      setFormError(err.message || t('exercises.saveError'));
    },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      return apiClient(`/exercises/${exerciseId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setIsCustomModalOpen(false);
      setEditingExercise(null);
    },
    onError: (err: any) => {
      setFormError(err.message || t('exercises.deleteError'));
    },
  });

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      if (onlyCustom && !ex.is_custom) return false;

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
  }, [exercises, search, selectedMuscle, selectedEquipment, onlyCustom]);

  const customCount = useMemo(() => {
    return exercises.filter((e) => e.is_custom).length;
  }, [exercises]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>{t('exercises.title')}</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              {t('exercises.movements', { count: exercises.length })}
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t('exercises.catalogDesc')}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          className="text-xs font-bold flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          onClick={openCreateModal}
        >
          <Plus className="w-4 h-4" />
          <span>{t('exercises.createCustom')}</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder={t('exercises.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 text-xs"
          />
        </div>

        {/* Top Type / Filter Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyCustom(false)}
            className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ${
              !onlyCustom
                ? 'bg-brand-500 text-dark-950 font-bold shadow-md shadow-brand-500/20'
                : 'bg-dark-800 text-zinc-400 hover:text-white border border-dark-700'
            }`}
          >
            {t('exercises.allExercises', { count: exercises.length })}
          </button>

          <button
            type="button"
            onClick={() => setOnlyCustom(true)}
            className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
              onlyCustom
                ? 'bg-amber-500 text-dark-950 font-bold shadow-md shadow-amber-500/20'
                : 'bg-dark-800 text-amber-400/90 hover:text-amber-300 border border-dark-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('exercises.myExercises', { count: customCount })}</span>
          </button>
        </div>

        {/* Muscle group filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {MUSCLE_GROUPS.map((m) => (
            <button
              key={m.value}
              onClick={() => setSelectedMuscle(m.value)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                selectedMuscle === m.value
                  ? 'bg-dark-700 text-brand-400 border border-brand-500/50 font-bold'
                  : 'bg-dark-800 text-zinc-400 hover:text-zinc-200 hover:bg-dark-750'
              }`}
            >
              {t(m.key as any)}
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
              {t(eq.key as any)}
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
          <h3 className="text-sm font-bold text-zinc-300">{t('exercises.notFound')}</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            {t('exercises.notFoundDesc')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={openCreateModal}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1 text-brand-400" />
            {t('exercises.createCustom')}
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
                className="bg-dark-850/90 border border-dark-700/80 hover:border-dark-600 rounded-2xl p-3 flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-dark-800 shadow-md group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ExerciseThumbnail
                    exerciseName={exercise.name}
                    fallbackMuscle={muscle as string}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-white truncate leading-snug group-hover:text-brand-400 transition-colors">
                      {exercise.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1 flex-wrap">
                      <span className="capitalize text-brand-400 font-semibold">{muscle}</span>
                      <span>•</span>
                      <span className="capitalize text-zinc-400">
                        {exercise.equipment ? exercise.equipment.replace('_', ' ') : t('exercises.barbell')}
                      </span>
                      {exercise.is_custom && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400 font-bold text-[9px] bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.2 rounded-md">
                            {t('exercises.customBadge')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {exercise.is_custom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(exercise);
                      }}
                      className="p-1.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-amber-400 hover:text-amber-300 border border-dark-700 transition-colors"
                      title={t('exercises.editCustom')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {activeWorkout && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToActiveWorkout(exercise);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-brand-500 text-dark-950 font-bold text-xs shadow-sm hover:bg-brand-400 flex items-center gap-1 transition-all active:scale-95"
                      title={t('exercises.addToWorkout')}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{t('exercises.addToWorkout')}</span>
                    </button>
                  )}

                  <div className="p-1.5 rounded-xl text-zinc-500 group-hover:text-zinc-300">
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

      {/* Custom Exercise Modal (Create / Edit) */}
      <Modal
        isOpen={isCustomModalOpen}
        onClose={() => {
          setIsCustomModalOpen(false);
          setEditingExercise(null);
        }}
        title={editingExercise ? t('exercises.editModalTitle') : t('exercises.createModalTitle')}
        subtitle={
          editingExercise
            ? t('exercises.editModalSubtitle')
            : t('exercises.createModalSubtitle')
        }
        icon={
          <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0 font-bold">
            <Dumbbell className="w-4 h-4" />
          </div>
        }
        size="md"
        footer={
          <div className="w-full flex items-center justify-between gap-2">
            <div>
              {editingExercise && (
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={deleteExerciseMutation.isPending}
                  onClick={() => {
                    if (window.confirm(t('exercises.deleteConfirm', { name: editingExercise.name }))) {
                      deleteExerciseMutation.mutate(editingExercise.id);
                    }
                  }}
                  className="text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {t('common.delete')}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCustomModalOpen(false);
                  setEditingExercise(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={saveExerciseMutation.isPending}
                onClick={() => saveExerciseMutation.mutate()}
                disabled={!customName.trim()}
              >
                {editingExercise ? t('common.save') : t('exercises.createCustom')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-red-300 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
              {t('exercises.nameLabel')}
            </label>
            <Input
              placeholder={t('exercises.namePlaceholder')}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                {t('exercises.targetMuscle')}
              </label>
              <select
                value={customMuscle}
                onChange={(e) => setCustomMuscle(e.target.value as MuscleGroup)}
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="chest">{t('exercises.chest')}</option>
                <option value="back">{t('exercises.back')}</option>
                <option value="quads">{t('exercises.quads')}</option>
                <option value="hamstrings">{t('exercises.hamstrings')}</option>
                <option value="shoulders">{t('exercises.shoulders')}</option>
                <option value="biceps">{t('exercises.biceps')}</option>
                <option value="triceps">{t('exercises.triceps')}</option>
                <option value="core">{t('exercises.core')}</option>
                <option value="calves">{t('exercises.calves')}</option>
                <option value="full_body">{t('exercises.fullBody')}</option>
                <option value="cardio">{t('exercises.cardio')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                {t('exercises.equipmentLabel')}
              </label>
              <select
                value={customEquipment}
                onChange={(e) => setCustomEquipment(e.target.value as Equipment)}
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="barbell">{t('exercises.barbell')}</option>
                <option value="dumbbell">{t('exercises.dumbbell')}</option>
                <option value="cable">{t('exercises.cable')}</option>
                <option value="machine">{t('exercises.machine')}</option>
                <option value="bodyweight">{t('exercises.bodyweight')}</option>
                <option value="kettlebell">{t('exercises.kettlebell')}</option>
                <option value="smith_machine">{t('exercises.smithMachine')}</option>
                <option value="band">{t('exercises.band')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
              {t('exercises.trackingType')}
            </label>
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as MeasurementType)}
              className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="weight_reps">{t('exercises.weightReps')}</option>
              <option value="bodyweight_reps">{t('exercises.bodyweightReps')}</option>
              <option value="duration">{t('exercises.durationOnly')}</option>
              <option value="distance_duration">{t('exercises.distDuration')}</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ExercisesPage;
