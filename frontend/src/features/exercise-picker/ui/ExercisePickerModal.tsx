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
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'calves',
];

export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectExercise,
}) => {
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [inspectingExercise, setInspectingExercise] = useState<Exercise | null>(null);

  const { data: exercises = [], isLoading } = useQuery<Exercise[]>({
    queryKey: ['exercises', selectedMuscle, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedMuscle !== 'all') params.append('muscle_group', selectedMuscle);
      if (search) params.append('search', search);
      return apiClient<Exercise[]>(`/exercises?${params.toString()}`);
    },
    enabled: isOpen,
  });

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
        title="Выбор упражнения"
        subtitle="Каталог спортивных упражнений"
      >
        <div className="space-y-3">
          {/* Search Bar */}
          <Input
            placeholder="Поиск по названию..."
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
                {mg.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Exercises List */}
          <div className="space-y-2 pt-1">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : exercises.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-500">
                Упражнения не найдены
              </div>
            ) : (
              exercises.map((ex) => (
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
                      title="Инструкция и техника"
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
              ))
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
