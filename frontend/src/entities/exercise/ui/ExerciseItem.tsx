import React from 'react';
import { Exercise } from '../model/types.ts';
import { Badge } from '../../../shared/ui/card.tsx';
import { ExerciseThumbnail } from './ExerciseThumbnail.tsx';

interface ExerciseItemProps {
  exercise: Exercise;
  onSelect?: () => void;
  actionButton?: React.ReactNode;
}

export const ExerciseItem: React.FC<ExerciseItemProps> = ({ exercise, onSelect, actionButton }) => {
  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-xl bg-dark-800/80 border border-dark-700/80 flex items-center justify-between gap-3 hover:border-dark-600 transition-colors ${
        onSelect ? 'cursor-pointer hover:bg-dark-800' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <ExerciseThumbnail
          exerciseName={exercise.name}
          fallbackMuscle={exercise.primary_muscle_group as string}
          size="sm"
        />
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-zinc-100 truncate">{exercise.name}</span>
            {exercise.is_custom && <Badge variant="accent">Custom</Badge>}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 capitalize">
            <Badge variant="brand">{exercise.primary_muscle_group}</Badge>
            <span>•</span>
            <span>{exercise.equipment ? exercise.equipment.replace('_', ' ') : 'Equipment'}</span>
          </div>
        </div>
      </div>

      {actionButton && <div>{actionButton}</div>}
    </div>
  );
};
