import React, { useState, useMemo } from 'react';
import {
  History,
  Clock,
  Flame,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
  Calendar,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { formatDate, formatDuration } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { useStartWorkout } from '../../../features/start-workout/model/useStartWorkout.ts';
import { WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { WorkoutCalendar } from '../../../features/workout-calendar/ui/WorkoutCalendar.tsx';
import { generateUUID } from '../../../shared/lib/uuid.ts';

interface HistoryResponse {
  items: WorkoutHistoryItem[];
  next_cursor?: string | null;
}

export const HistoryPage: React.FC = () => {
  const { t, language } = useTranslation();
  const unitPref = useAuthStore((s) => s.unitPreference);
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startWorkout = useStartWorkout();

  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ['workouts'],
    queryFn: () => apiClient<HistoryResponse>('/workouts?limit=50'),
  });

  const workouts = data?.items || [];

  const deleteWorkoutMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/workouts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workouts'] });
      void queryClient.invalidateQueries({ queryKey: ['records'] });
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      void queryClient.invalidateQueries({ queryKey: ['coach-insights'] });
      setDeletingId(null);
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleRepeatWorkout = async (w: WorkoutHistoryItem) => {
    await startWorkout({
      name: w.name,
      exercises: (w.exercises || []).map((ex) => ({
        exerciseId: ex.exercise_id,
        exerciseName: ex.exercise_name,
        sets: (ex.sets || []).map((s, idx) => ({
          id: generateUUID(),
          setNumber: s.set_number || idx + 1,
          setType: s.set_type || 'normal',
          weightKg: s.weight_kg || 0,
          reps: s.reps || 10,
          completed: false,
        })),
      })),
    });
  };

  const stats = useMemo(() => {
    let totalVol = 0;
    let totalSecs = 0;
    let totalSets = 0;

    for (const w of workouts) {
      totalVol += w.total_volume_kg || 0;
      totalSecs += w.duration_seconds || 0;
      totalSets += w.completed_sets_count || 0;
    }

    return {
      totalWorkouts: workouts.length,
      totalVolumeKg: totalVol,
      totalHours: Math.round((totalSecs / 3600) * 10) / 10,
      totalSets,
    };
  }, [workouts]);

  const lbl = {
    list: language === 'uz' ? 'Ro‘yxat' : language === 'en' ? 'List' : 'Список',
    calendar: language === 'uz' ? 'Taqvim' : language === 'en' ? 'Calendar' : 'Календарь',
    sessions: language === 'uz' ? 'Mashg‘ulotlar' : language === 'en' ? 'Sessions' : 'Тренировок',
    hours: language === 'uz' ? 'soat' : language === 'en' ? 'hrs' : 'ч',
    sets: language === 'uz' ? 'yond.' : language === 'en' ? 'sets' : 'подх.',
    repeat: language === 'uz' ? 'Qaytarish' : language === 'en' ? 'Repeat' : 'Повторить',
    deleteTitle:
      language === 'uz'
        ? 'Mashg‘ulotni o‘chirasizmi?'
        : language === 'en'
        ? 'Delete Workout Log?'
        : 'Удалить тренировку из истории?',
  };

  return (
    <div className="space-y-4">
      {/* Compact Header & View Mode Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
            {t('history.title')}
          </h2>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/30">
            {stats.totalWorkouts}
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-dark-850 rounded-xl border border-dark-700">
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-brand-500 text-dark-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {lbl.list}
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              viewMode === 'calendar'
                ? 'bg-brand-500 text-dark-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {lbl.calendar}
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <WorkoutCalendar workouts={workouts} />
      ) : (
        <>
          {workouts.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              <Card className="p-3 bg-dark-800/80 border-dark-700/80 space-y-0.5">
                <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-bold uppercase">
                  <History className="w-3 h-3 text-brand-400" />
                  <span>{lbl.sessions}</span>
                </div>
                <div className="text-base sm:text-lg font-extrabold text-white font-mono">
                  {stats.totalWorkouts}
                </div>
              </Card>

              <Card className="p-3 bg-dark-800/80 border-dark-700/80 space-y-0.5">
                <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-bold uppercase">
                  <Flame className="w-3 h-3 text-emerald-400" />
                  <span>{t('history.totalVolume')}</span>
                </div>
                <div className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono">
                  {formatWeight(stats.totalVolumeKg, unitPref)}
                </div>
              </Card>

              <Card className="p-3 bg-dark-800/80 border-dark-700/80 space-y-0.5">
                <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-bold uppercase">
                  <Clock className="w-3 h-3 text-sky-400" />
                  <span>{t('history.duration')}</span>
                </div>
                <div className="text-base sm:text-lg font-extrabold text-sky-400 font-mono">
                  {stats.totalHours} {lbl.hours}
                </div>
              </Card>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-dark-800/60 rounded-2xl border border-dark-700 animate-pulse"
                />
              ))}
            </div>
          ) : workouts.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-dark-800 rounded-2xl p-6 bg-dark-900/40">
              <History className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-zinc-300">{t('history.noWorkouts')}</h3>
            </div>
          ) : (
            <div className="space-y-2.5">
              {workouts.map((workout) => {
                const isExpanded = expandedId === workout.id;
                return (
                  <Card
                    key={workout.id}
                    className="bg-dark-800/90 border-dark-700/80 hover:border-dark-600 transition-all overflow-hidden shadow-md"
                  >
                    <div
                      className="p-3.5 cursor-pointer flex items-center justify-between gap-2.5 select-none"
                      onClick={() => toggleExpand(workout.id)}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white leading-snug truncate">
                            {workout.name}
                          </h3>
                          <span className="text-[10px] bg-dark-700/90 text-zinc-300 px-2 py-0.5 rounded font-mono border border-dark-600/50 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-400" />
                            {formatDate(workout.started_at)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400">
                          {workout.duration_seconds && workout.duration_seconds > 0 ? (
                            <span className="flex items-center gap-1 text-sky-400">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDuration(workout.duration_seconds)}
                            </span>
                          ) : null}

                          {workout.total_volume_kg !== undefined && workout.total_volume_kg > 0 ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-bold">
                              <Flame className="w-3.5 h-3.5" />
                              {formatWeight(workout.total_volume_kg, unitPref)}
                            </span>
                          ) : null}

                          <span className="flex items-center gap-1 text-zinc-300">
                            <Dumbbell className="w-3.5 h-3.5 text-zinc-500" />
                            {workout.completed_sets_count || 0} {lbl.sets}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRepeatWorkout(workout);
                          }}
                          className="p-2 rounded-xl text-zinc-400 hover:text-brand-400 hover:bg-dark-700 transition-colors cursor-pointer"
                          title={lbl.repeat}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(workout.id);
                          }}
                          className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-dark-700 transition-colors cursor-pointer"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="text-zinc-500 p-1">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-2.5 border-t border-dark-700/60 bg-dark-900/50 space-y-2.5 animate-in fade-in duration-150">
                        {workout.exercises && workout.exercises.length > 0 && (
                          <div className="space-y-2">
                            {workout.exercises.map((ex, i) => (
                              <div
                                key={i}
                                className="space-y-1.5 bg-dark-850/60 p-2.5 rounded-xl border border-dark-750"
                              >
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded bg-dark-700 text-brand-400 flex items-center justify-center text-[10px] font-mono">
                                      {i + 1}
                                    </span>
                                    <span>{ex.exercise_name}</span>
                                  </h4>
                                  <span className="text-[10px] font-mono text-zinc-400">
                                    {ex.sets?.length || 0} {lbl.sets}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  {ex.sets?.map((set, sIdx) => (
                                    <div
                                      key={sIdx}
                                      className="inline-flex items-center gap-1.5 bg-dark-900/90 px-2.5 py-1 rounded-lg text-[11px] font-mono border border-dark-700/60"
                                    >
                                      <span className="text-zinc-500 font-bold">
                                        #{set.set_number || sIdx + 1}
                                      </span>
                                      <span className="text-zinc-200 font-semibold">
                                        {formatWeight(set.weight_kg, unitPref)} × {set.reps}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs flex items-center gap-1.5"
                            onClick={() => void handleRepeatWorkout(workout)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-brand-400" />
                            <span>{lbl.repeat}</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">{lbl.deleteTitle}</h3>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDeletingId(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteWorkoutMutation.isPending}
                onClick={() => deleteWorkoutMutation.mutate(deletingId)}
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
