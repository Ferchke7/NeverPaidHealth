import React, { useState } from 'react';
import { Play, BookmarkPlus, Check, Clock, Zap, Dumbbell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useStartWorkout } from '../../../features/start-workout/model/useStartWorkout.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

export interface SuggestedExercise {
  exercise_id?: string;
  exercise_name: string;
  muscle_group?: string;
  target_sets: number;
  target_reps: number;
  target_weight_kg?: number;
  rest_seconds?: number;
  note?: string;
}

export interface SuggestedWorkoutAction {
  title: string;
  subtitle?: string;
  estimated_minutes: number;
  target_rir: string;
  exercises: SuggestedExercise[];
}

interface CoachWorkoutCardProps {
  workout: SuggestedWorkoutAction;
  compact?: boolean;
}

export const CoachWorkoutCard: React.FC<CoachWorkoutCardProps> = ({ workout, compact = false }) => {
  const { language } = useTranslation();
  const startWorkout = useStartWorkout();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!workout || !workout.exercises || workout.exercises.length === 0) {
    return null;
  }

  const handleStart = async () => {
    await startWorkout({
      name: workout.title,
      exercises: workout.exercises.map((ex) => ({
        exercise_id: ex.exercise_id || generateUUID(),
        exercise_name: ex.exercise_name,
        target_sets: ex.target_sets || 3,
        target_reps: ex.target_reps || 10,
        target_weight_kg: ex.target_weight_kg || 0,
      })),
    });
  };

  const handleSaveRoutine = async () => {
    if (isSaving || isSaved) return;
    setIsSaving(true);
    try {
      await apiClient('/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: workout.title,
          notes: workout.subtitle ? `${workout.subtitle} (${workout.target_rir})` : workout.target_rir,
          exercises: workout.exercises.map((ex, idx) => ({
            exercise_id:
              ex.exercise_id && ex.exercise_id !== '00000000-0000-0000-0000-000000000000'
                ? ex.exercise_id
                : generateUUID(),
            exercise_name: ex.exercise_name,
            order_index: idx,
            target_sets: ex.target_sets || 3,
            target_reps_min: Math.max(1, (ex.target_reps || 10) - 2),
            target_reps_max: ex.target_reps || 10,
          })),
        }),
      });
      setIsSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['routines'] });
    } catch {
      // Ignore error
    } finally {
      setIsSaving(false);
    }
  };

  const labels = {
    start: language === 'uz' ? 'Boshlash' : language === 'en' ? 'Start Workout' : 'Начать тренировку',
    save: language === 'uz' ? 'Shablonga' : language === 'en' ? 'Save Routine' : 'В шаблоны',
    saved: language === 'uz' ? 'Saqlandi' : language === 'en' ? 'Saved' : 'Сохранено',
    min: language === 'uz' ? 'daq' : language === 'en' ? 'min' : 'мин',
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden rounded-[14px] bg-[#171717] border border-[#404040] p-3.5 space-y-2.5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Dumbbell className="w-3.5 h-3.5 text-[#34d399] shrink-0" />
            <h4 className="text-xs sm:text-sm font-extrabold text-white truncate">{workout.title}</h4>
          </div>
          {workout.subtitle && (
            <p className="text-[11px] text-[#a3a3a3] truncate mt-0.5">{workout.subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {workout.target_rir && (
            <span className="px-2 py-0.5 rounded-[6px] bg-[#022c22] text-[#34d399] border border-[#064e3b] text-[10px] font-mono tabular-nums font-semibold flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />
              {workout.target_rir}
            </span>
          )}
          {workout.estimated_minutes > 0 && (
            <span className="px-2 py-0.5 rounded-[6px] bg-[#0a0a0a] text-[#a3a3a3] border border-[#404040] text-[10px] font-mono tabular-nums flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-[#737373]" />
              {workout.estimated_minutes} {labels.min}
            </span>
          )}
        </div>
      </div>

      {/* Exercises Compact Grid */}
      <div className={`grid gap-1.5 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {workout.exercises.map((ex, i) => (
          <div
            key={i}
            className="px-3 py-2 rounded-[10px] bg-[#0a0a0a] border border-[#262626] flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-5 h-5 rounded-[6px] bg-[#171717] border border-[#262626] text-[#34d399] font-mono tabular-nums text-[10px] font-semibold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-[#fafafa] font-medium truncate">{ex.exercise_name}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 font-mono">
              <span className="text-[#a3a3a3] font-mono tabular-nums text-[11px]">
                {ex.target_sets}×{ex.target_reps}
              </span>
              {ex.target_weight_kg && ex.target_weight_kg > 0 ? (
                <span className="px-1.5 py-0.5 rounded-[6px] bg-[#022c22] text-[#34d399] font-mono tabular-nums font-semibold text-[10px] border border-[#064e3b]">
                  {ex.target_weight_kg} кг
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* 1-Click Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={handleStart}
          className="flex-1 min-h-[44px] py-2 px-3 rounded-[10px] bg-[#34d399] hover:bg-[#34d399]/90 text-[#0a0a0a] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{labels.start}</span>
        </button>

        <button
          type="button"
          onClick={handleSaveRoutine}
          disabled={isSaving || isSaved}
          className={`min-h-[44px] py-2 px-3 rounded-[10px] border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isSaved
              ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
              : 'bg-[#0a0a0a] hover:bg-[#262626] border-[#404040] text-[#fafafa]'
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{labels.saved}</span>
            </>
          ) : (
            <>
              <BookmarkPlus className="w-3.5 h-3.5 text-[#34d399]" />
              <span>{labels.save}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
