import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import {
  Exercise,
  MuscleGroup,
  Equipment,
  MeasurementType,
} from '../../../entities/exercise/model/types.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { Card } from '../../../shared/ui/card.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { EmptyStateCard, LoadingStateCard } from '../../../shared/ui/SystemState.tsx';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { ExerciseInfoModal } from '../../../features/exercise-detail/ui/ExerciseInfoModal.tsx';
import { getExerciseVisual } from '../../../shared/lib/exerciseImages.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';

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

export const ExercisesPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  usePageSEO({ pageKey: 'exercises', canonicalPath: '/exercises' });
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | 'all'>('all');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [expandedTechniqueId, setExpandedTechniqueId] = useState<string | null>(null);
  const [selectedExerciseDetail, setSelectedExerciseDetail] = useState<Exercise | null>(null);

  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const addExerciseToActive = useActiveWorkoutStore((s) => s.addExercise);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

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
      const query = search.toLowerCase().trim();

      const matchesSearch =
        !query || name.includes(query) || muscle.includes(query) || equip.includes(query);

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

  const customCount = useMemo(() => exercises.filter((e) => e.is_custom).length, [exercises]);

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
      {!embedded && (
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#fafafa]">
            {t('exercises.title')}
          </h1>
          <p className="text-[14px] text-[#a3a3a3] mt-1">{t('exercises.catalogDesc')}</p>
        </div>
      )}

      {/* Search + Primary Create CTA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <Input
            placeholder={t('exercises.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="primary" size="md" onClick={openCreateModal} className="shrink-0">
          {t('exercises.createCustom')}
        </Button>
      </div>

      {/* Filter Selects */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={selectedMuscle}
          onChange={(e) => setSelectedMuscle(e.target.value as MuscleGroup | 'all')}
          aria-label={t('exercises.targetMuscle')}
          className="h-[44px] bg-[#0a0a0a] border border-[#404040] rounded-[10px] px-3.5 text-[14px] font-medium text-[#fafafa] focus:outline-none focus:border-[#34d399] cursor-pointer"
        >
          {MUSCLE_GROUPS.map((m) => (
            <option key={m.value} value={m.value} className="bg-[#171717]">
              {m.value === 'all'
                ? `${t('exercises.musclesFilterPrefix')} ${t('exercises.allValueShort')}`
                : `${t('exercises.musclesFilterPrefix')} ${t(m.key as any)}`}
            </option>
          ))}
        </select>

        <select
          value={selectedEquipment}
          onChange={(e) => setSelectedEquipment(e.target.value as Equipment | 'all')}
          aria-label={t('exercises.equipmentLabel')}
          className="h-[44px] bg-[#0a0a0a] border border-[#404040] rounded-[10px] px-3.5 text-[14px] font-medium text-[#fafafa] focus:outline-none focus:border-[#34d399] cursor-pointer"
        >
          {EQUIPMENT_LIST.map((eq) => (
            <option key={eq.value} value={eq.value} className="bg-[#171717]">
              {eq.value === 'all'
                ? `${t('exercises.equipmentFilterPrefix')} ${t('exercises.allValueShort')}`
                : `${t('exercises.equipmentFilterPrefix')} ${t(eq.key as any)}`}
            </option>
          ))}
        </select>
      </div>

      {/* All / Custom Switcher */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOnlyCustom(false)}
          className={`h-[44px] px-4 rounded-[10px] text-[14px] font-medium transition-colors cursor-pointer ${
            !onlyCustom
              ? 'bg-[#022c22] text-[#34d399]'
              : 'text-[#a3a3a3] hover:text-[#fafafa] hover:bg-[#171717]'
          }`}
        >
          {t('exercises.allExercises', { count: exercises.length })}
        </button>

        <button
          type="button"
          onClick={() => setOnlyCustom(true)}
          className={`h-[44px] px-4 rounded-[10px] text-[14px] font-medium transition-colors cursor-pointer ${
            onlyCustom
              ? 'bg-[#022c22] text-[#34d399]'
              : 'text-[#a3a3a3] hover:text-[#fafafa] hover:bg-[#171717]'
          }`}
        >
          {t('exercises.myExercises', { count: customCount })}
        </button>
      </div>

      {/* Library Section */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[#fafafa]">
            {t('exercises.title')}
          </h2>
          <p className="text-[13px] text-[#a3a3a3] mt-0.5">
            {t('exercises.movements', { count: filteredExercises.length })}
          </p>
        </div>

        {isLoading ? (
          <LoadingStateCard title={t('common.loading')} />
        ) : filteredExercises.length === 0 ? (
          <EmptyStateCard
            title={t('exercises.notFound')}
            description={t('exercises.notFoundDesc')}
            actionLabel={t('exercises.createCustom')}
            onAction={openCreateModal}
          />
        ) : (
          <Card className="divide-y divide-[#262626] overflow-hidden">
            {filteredExercises.map((exercise) => {
              const muscle = exercise.primary_muscle || exercise.primary_muscle_group || 'General';
              const equipment = exercise.equipment
                ? exercise.equipment.replace('_', ' ')
                : t('exercises.barbell');
              const isExpanded = expandedTechniqueId === exercise.id;
              const visual = isExpanded ? getExerciseVisual(exercise.name, String(muscle)) : null;

              return (
                <div key={exercise.id} className="p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-[15px] font-semibold text-[#fafafa] leading-snug">
                        {exercise.name}
                      </h3>
                      <div className="text-[13px] text-[#a3a3a3] capitalize">
                        {muscle} · {equipment}
                        {exercise.is_custom ? ` · ${t('exercises.customBadge')}` : ''}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() =>
                          setExpandedTechniqueId(isExpanded ? null : exercise.id)
                        }
                      >
                        {isExpanded
                          ? t('exercises.hideTechniqueBtn')
                          : t('exercises.techniqueBtn')}
                      </Button>

                      {(activeWorkout || embedded) && (
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => handleAddToActiveWorkout(exercise)}
                        >
                          {t('exercises.addShort')}
                        </Button>
                      )}

                      {exercise.is_custom && (
                        <>
                          <Button
                            variant="outline"
                            size="md"
                            onClick={() => openEditModal(exercise)}
                          >
                            {t('workouts.editShort')}
                          </Button>
                          <Button
                            variant="outline"
                            size="md"
                            onClick={() => {
                              if (
                                window.confirm(
                                  t('exercises.deleteConfirm', { name: exercise.name })
                                )
                              ) {
                                deleteExerciseMutation.mutate(exercise.id);
                              }
                            }}
                          >
                            {t('common.delete')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expandable Inline Technique Guide (Screen 03) */}
                  {isExpanded && visual && (
                    <div className="pt-3 border-t border-[#262626] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[15px] font-semibold text-[#fafafa]">
                          {t('exercises.techniqueTitle', { name: exercise.name })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedExerciseDetail(exercise)}
                          className="text-[12px] font-medium text-[#34d399] hover:underline cursor-pointer"
                        >
                          {t('exercises.animation')} / 3D
                        </button>
                      </div>

                      <p className="text-[13px] text-[#a3a3a3]">
                        {t('exercises.mainFocus')}: {visual.primaryMuscles.join(', ') || muscle}
                        {visual.secondaryMuscles && visual.secondaryMuscles.length > 0
                          ? ` · ${t('exercises.synergists')}: ${visual.secondaryMuscles.join(', ')}`
                          : ''}
                      </p>

                      {visual.instructions && visual.instructions.length > 0 ? (
                        <ol className="space-y-1.5 text-[13px] text-[#fafafa] leading-relaxed">
                          {visual.instructions.map((step, stepIdx) => (
                            <li key={stepIdx}>
                              {stepIdx + 1}. {step}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-[13px] text-[#a3a3a3]">
                          {t('exercises.defaultTechniqueTip')}
                        </p>
                      )}

                      {activeWorkout && (
                        <div className="pt-1">
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => handleAddToActiveWorkout(exercise)}
                          >
                            {t('exercises.addToWorkout')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {selectedExerciseDetail && (
        <ExerciseInfoModal
          isOpen={true}
          onClose={() => setSelectedExerciseDetail(null)}
          exerciseName={selectedExerciseDetail.name}
          fallbackMuscle={
            selectedExerciseDetail.primary_muscle || selectedExerciseDetail.primary_muscle_group
          }
          canAddToWorkout={Boolean(activeWorkout)}
          onAddToWorkout={() => {
            handleAddToActiveWorkout(selectedExerciseDetail);
            setSelectedExerciseDetail(null);
          }}
        />
      )}

      {/* Custom Exercise Modal (Create / Edit — preserves all 4 measurement_types) */}
      <Modal
        isOpen={isCustomModalOpen}
        onClose={() => {
          setIsCustomModalOpen(false);
          setEditingExercise(null);
        }}
        title={
          editingExercise ? t('exercises.editModalTitle') : t('exercises.createModalTitle')
        }
        subtitle={
          editingExercise
            ? t('exercises.editModalSubtitle')
            : t('exercises.createModalSubtitle')
        }
        size="md"
        footer={
          <div className="w-full flex items-center justify-between gap-2">
            <div>
              {editingExercise && (
                <Button
                  variant="danger"
                  size="md"
                  isLoading={deleteExerciseMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        t('exercises.deleteConfirm', { name: editingExercise.name })
                      )
                    ) {
                      deleteExerciseMutation.mutate(editingExercise.id);
                    }
                  }}
                >
                  {t('common.delete')}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setIsCustomModalOpen(false);
                  setEditingExercise(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="md"
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
            <div className="p-3 bg-[#262626] border border-red-500/40 rounded-[10px] text-red-300 text-xs">
              {formError}
            </div>
          )}

          <Input
            label={t('exercises.nameLabel')}
            placeholder={t('exercises.namePlaceholder')}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#a3a3a3] mb-1.5">
                {t('exercises.targetMuscle')}
              </label>
              <select
                value={customMuscle}
                onChange={(e) => setCustomMuscle(e.target.value as MuscleGroup)}
                className="w-full h-11 bg-[#0a0a0a] border border-[#404040] rounded-[10px] px-3 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#34d399]"
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
              <label className="block text-[12px] font-medium text-[#a3a3a3] mb-1.5">
                {t('exercises.equipmentLabel')}
              </label>
              <select
                value={customEquipment}
                onChange={(e) => setCustomEquipment(e.target.value as Equipment)}
                className="w-full h-11 bg-[#0a0a0a] border border-[#404040] rounded-[10px] px-3 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#34d399]"
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
            <label className="block text-[12px] font-medium text-[#a3a3a3] mb-1.5">
              {t('exercises.trackingType')}
            </label>
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as MeasurementType)}
              className="w-full h-11 bg-[#0a0a0a] border border-[#404040] rounded-[10px] px-3 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#34d399]"
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
