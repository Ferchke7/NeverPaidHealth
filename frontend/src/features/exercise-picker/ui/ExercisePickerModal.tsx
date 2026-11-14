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
          <div className="w-9 h-9 rounded-[10px] bg-[#022c22] text-[#34d399] border border-[#064e3b] flex items-center justify-center shrink-0">
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
            startContent={<Search className="w-4 h-4 text-[#737373]" />}
            size="sm"
          />

          {/* Muscle Groups Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MUSCLE_GROUPS.map((mg) => (
              <button
                key={mg}
                type="button"
                onClick={() => setSelectedMuscle(mg)}
                className={`h-9 px-3 rounded-[10px] text-xs font-semibold capitalize shrink-0 transition-colors cursor-pointer select-none border ${
                  selectedMuscle === mg
                    ? 'bg-[#022c22] text-[#34d399] border-[#064e3b]'
                    : 'bg-[#0a0a0a] text-[#a3a3a3] hover:text-[#fafafa] border-[#262626]'
                }`}
              >
                {mg === 'all' ? t('exercises.allMuscles') : t(`exercises.${mg}` as any)}
              </button>
            ))}
          </div>

          {/* Equipment Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {EQUIPMENTS.map((eq) => (
              <button
                key={eq}
                type="button"
                onClick={() => setSelectedEquipment(eq)}
                className={`h-8 px-2.5 rounded-[8px] font-medium capitalize shrink-0 transition-colors cursor-pointer select-none border ${
                  selectedEquipment === eq
                    ? 'bg-[#fafafa] text-[#0a0a0a] border-[#fafafa]'
                    : 'bg-[#0a0a0a] text-[#a3a3a3] hover:text-[#fafafa] border-[#262626]'
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
              <div className="text-center py-8 text-xs text-[#737373]">
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
                    className="p-3 rounded-[12px] bg-[#0a0a0a] border border-[#262626] hover:border-[#34d399] flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ExerciseThumbnail
                        exerciseName={ex.name}
                        fallbackMuscle={ex.primary_muscle_group as string}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[#fafafa] truncate group-hover:text-[#34d399] transition-colors">
                          {ex.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-[#a3a3a3]">
                          <Badge variant="brand" size="sm">{ex.primary_muscle_group}</Badge>
                          <span className="capitalize text-[11px] text-[#737373]">
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
                        className="w-10 h-10 flex items-center justify-center text-[#a3a3a3] hover:text-[#fafafa] rounded-[10px] hover:bg-[#171717] transition-colors"
                        title={t('exercises.viewTechnique')}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                      <Button
                        size="sm"
                        variant="primary"
                        isIconOnly
                        className="w-10 h-10 rounded-[10px]"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {exercises.length > visibleCount && (
                  <div className="pt-2 pb-1 text-center">
                    <Button
                      size="md"
                      variant="outline"
                      onClick={() => setVisibleCount((prev) => prev + 40)}
                      className="w-full"
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
