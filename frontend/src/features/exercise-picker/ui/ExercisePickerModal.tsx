import React, { useState } from 'react';
import { Search, X, Plus, HelpCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Exercise } from '../../../entities/exercise/model/types.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Badge } from '../../../shared/ui/card.tsx';
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

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 backdrop-blur-sm">
        <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
          {/* Header */}
          <div className="p-4 border-b border-dark-800 flex items-center justify-between">
            <h3 className="font-bold text-base text-zinc-100">Select Exercise</h3>
            <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter */}
          <div className="p-3 border-b border-dark-800 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search exercise..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {MUSCLE_GROUPS.map((mg) => (
                <button
                  key={mg}
                  onClick={() => setSelectedMuscle(mg)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize shrink-0 transition-colors ${
                    selectedMuscle === mg
                      ? 'bg-brand-500 text-dark-950 font-semibold shadow-sm'
                      : 'bg-dark-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {mg.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* List of Exercises */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-xs text-zinc-500">Loading catalog...</div>
            ) : exercises.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-500">No exercises found</div>
            ) : (
              exercises.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => {
                    onSelectExercise(ex);
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-dark-800/70 border border-dark-700/60 flex items-center justify-between gap-2.5 hover:border-brand-500/40 hover:bg-dark-800 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ExerciseThumbnail
                      exerciseName={ex.name}
                      fallbackMuscle={ex.primary_muscle_group as string}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-zinc-100 truncate group-hover:text-white">
                        {ex.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                        <Badge variant="brand">{ex.primary_muscle_group}</Badge>
                        <span className="capitalize text-[11px] text-zinc-500">
                          {ex.equipment.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingExercise(ex);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-dark-700 transition-colors"
                      title="View form guide"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-brand-500 hover:text-brand-400 p-1.5"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {inspectingExercise && (
        <ExerciseInfoModal
          isOpen={true}
          onClose={() => setInspectingExercise(null)}
          exerciseName={inspectingExercise.name}
          fallbackMuscle={inspectingExercise.primary_muscle_group as string}
          canAddToWorkout={true}
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
