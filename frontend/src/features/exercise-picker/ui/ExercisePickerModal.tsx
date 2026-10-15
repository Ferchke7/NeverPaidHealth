import React, { useState } from 'react';
import { Search, Plus, HelpCircle, Dumbbell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Badge } from '../../../shared/ui/card.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Skeleton } from '../../../shared/ui/skeleton.tsx';
import { ExerciseThumbnail } from '../../../entities/exercise/ui/ExerciseThumbnail.tsx';
import { ExerciseInfoModal } from '../../exercise-detail/ui/ExerciseInfoModal.tsx';

import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface ExercisePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
}

const MUSCLE_GROUPS = [
  'all',
  'chest',
  'back',
  'quads',
  'hamstrings',
  'glutes',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'traps',
  'core',
  'calves',
  'cardio',
  'full_body',
];

const EQUIPMENTS = [
  'all',
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'smith_machine',
  'bands',
  'ez_bar',
  'exercise_ball',
  'other',
];

export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectExercise,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('all');
  const [visibleCount, setVisibleCount] = useState(40);
  const [inspectingExercise, setInspectingExercise] = useState<Exercise | null>(null);

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setVisibleCount(40);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset pagination on filter change
  React.useEffect(() => {
    setVisibleCount(40);
  }, [selectedMuscle, selectedEquipment]);

  const { data: exercises = [], isLoading } = useQuery<Exercise[]>({
    queryKey: ['exercises', selectedMuscle, selectedEquipment, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedMuscle !== 'all') params.append('muscle_group', selectedMuscle);
      if (selectedEquipment !== 'all') params.append('equipment', selectedEquipment);
      if (debouncedSearch) params.append('search', debouncedSearch);
      return apiClient<Exercise[]>(`/exercises?${params.toString()}`);
    },
    enabled: isOpen,
  });

  const visibleExercises = exercises.slice(0, visibleCount);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        icon={
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0">
            <Dumbbell className="w-4 h-4" />
          </div>
        }
        title={t('exercises.exercisePickerTitle')}
        subtitle={`${t('exercises.exercisePickerSubtitle')} (${exercises.length})`}
      >
        <div className="space-y-3">
          {/* Search Bar */}
          <Input
            placeholder={t('exercises.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startContent={<Search className="w-4 h-4 text-zinc-400" />}
            size="sm"
          />

          {/* Muscle Groups Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MUSCLE_GROUPS.map((mg) => (
              <button
                key={mg}
                onClick={() => setSelectedMuscle(mg)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize shrink-0 transition-all cursor-pointer select-none ${
                  selectedMuscle === mg
                    ? 'bg-brand-500 text-dark-950 font-bold shadow-md shadow-brand-500/20'
                    : 'bg-dark-800 text-zinc-400 hover:text-zinc-200 border border-dark-700'
                }`}
              >
                {mg === 'all' ? t('exercises.allMuscles') : t(`exercises.${mg}` as any)}
              </button>
            ))}
          </div>

          {/* Equipment Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            {EQUIPMENTS.map((eq) => (
              <button
                key={eq}
                onClick={() => setSelectedEquipment(eq)}
                className={`px-2.5 py-0.5 rounded-lg font-medium capitalize shrink-0 transition-all cursor-pointer select-none ${
                  selectedEquipment === eq
                    ? 'bg-zinc-200 text-dark-950 font-bold'
                    : 'bg-dark-900 text-zinc-500 hover:text-zinc-300 border border-dark-800'
                }`}
              >
                {eq === 'all' ? t('exercises.allEquipment') : t(`exercises.${eq}` as any) || eq.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Exercises List */}
          <div className="space-y-2 pt-1 max-h-[60vh] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : visibleExercises.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-500">
                {t('exercises.notFound')}
              </div>
            ) : (
              <>
                {visibleExercises.map((ex) => (
                  <div
                    key={ex.id}
                    onClick={() => {
                      onSelectExercise(ex);
                      onClose();
                    }}
                    className="p-3 rounded-2xl bg-dark-800/80 border border-dark-700/80 flex items-center justify-between gap-3 hover:border-brand-500/50 hover:bg-dark-800 cursor-pointer transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ExerciseThumbnail
                        exerciseName={ex.name}
                        fallbackMuscle={ex.primary_muscle_group as string}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-zinc-100 truncate group-hover:text-brand-400 transition-colors">
                          {ex.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                          <Badge variant="brand" size="sm">{ex.primary_muscle_group}</Badge>
                          <span className="capitalize text-[11px] text-zinc-500">
                            {ex.equipment.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectingExercise(ex);
                        }}
                        className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-dark-700 transition-colors"
                        title={t('exercises.viewTechnique')}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                      <Button
                        size="sm"
                        variant="primary"
                        isIconOnly
                        className="w-8 h-8 rounded-xl"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Load More Button */}
                {exercises.length > visibleCount && (
                  <div className="pt-2 pb-1 text-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setVisibleCount((prev) => prev + 40)}
                      className="w-full text-xs font-semibold"
                    >
                      {t('common.loading')} ({visibleCount} / {exercises.length})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      {inspectingExercise && (
        <ExerciseInfoModal
          isOpen={!!inspectingExercise}
          onClose={() => setInspectingExercise(null)}
          exerciseName={inspectingExercise.name}
          fallbackMuscle={inspectingExercise.primary_muscle_group as string}
          canAddToWorkout
          onAddToWorkout={() => {
            onSelectExercise(inspectingExercise);
            setInspectingExercise(null);
            onClose();
          }}
        />
      )}
    </>
  );
};
