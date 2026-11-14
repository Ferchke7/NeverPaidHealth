import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { formatDate, formatDuration, toLocalDateKey } from '../../../shared/lib/dates.ts';
import { formatWeight, kgToLb } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { useStartWorkout } from '../../../features/start-workout/model/useStartWorkout.ts';
import { WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';

interface HistoryResponse {
  items: WorkoutHistoryItem[];
  next_cursor?: string | null;
}

export const HistoryPage: React.FC = () => {
  const { t, language } = useTranslation();
  const unitPref = useAuthStore((s) => s.unitPreference);
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthFilterEnabled, setMonthFilterEnabled] = useState<boolean>(true);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(10);
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

  const lbl = {
    sessions: language === 'uz' ? 'Mashg‘ulotlar' : language === 'en' ? 'Sessions' : 'Тренировок',
    sets: language === 'uz' ? 'yond.' : language === 'en' ? 'sets' : 'подх.',
    repeat: language === 'uz' ? 'Qaytarish' : language === 'en' ? 'Repeat' : 'Повторить',
    deleteTitle:
      language === 'uz'
        ? 'Mashg‘ulotni o‘chirasizmi?'
        : language === 'en'
        ? 'Delete Workout Log?'
        : 'Удалить тренировку из истории?',
  };

  const localeStr = language === 'uz' ? 'uz-UZ' : language === 'en' ? 'en-US' : 'ru-RU';
  const weekdayNames = useMemo(() => {
    if (language === 'uz') return ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    if (language === 'en') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  }, [language]);

  const workoutsByDate = useMemo(() => {
    const map: Record<string, WorkoutHistoryItem[]> = {};
    for (const w of workouts) {
      const key = toLocalDateKey(w.started_at);
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(w);
      }
    }
    return map;
  }, [workouts]);

  const monthPrefix = useMemo(() => {
    const y = selectedMonth.getFullYear();
    const m = String(selectedMonth.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [selectedMonth]);

  const monthYearLabel = useMemo(() => {
    return selectedMonth.toLocaleDateString(localeStr, { month: 'long', year: 'numeric' });
  }, [selectedMonth, localeStr]);

  const monthWorkouts = useMemo(() => {
    return workouts.filter((w) => toLocalDateKey(w.started_at).startsWith(monthPrefix));
  }, [workouts, monthPrefix]);

  const kpiStats = useMemo(() => {
    const source = selectedDateStr
      ? workoutsByDate[selectedDateStr] || []
      : monthFilterEnabled
      ? monthWorkouts
      : workouts;
    const volKg = source.reduce((acc, w) => acc + (w.total_volume_kg || 0), 0);
    return {
      count: source.length,
      volumeKg: volKg,
    };
  }, [selectedDateStr, workoutsByDate, monthFilterEnabled, monthWorkouts, workouts]);

  const filteredWorkouts = useMemo(() => {
    if (selectedDateStr) {
      return workoutsByDate[selectedDateStr] || [];
    }
    if (monthFilterEnabled) {
      return monthWorkouts;
    }
    return workouts;
  }, [selectedDateStr, workoutsByDate, monthFilterEnabled, monthWorkouts, workouts]);

  const displayedWorkouts = useMemo(
    () => filteredWorkouts.slice(0, visibleCount),
    [filteredWorkouts, visibleCount]
  );

  const calendarCells = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const startOffset = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    return { year, month, startOffset, daysInMonth, prevMonthDays };
  }, [selectedMonth]);

  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);

  const annualHeatmap = useMemo(() => {
    const today = new Date();
    const totalDays = 52 * 7;
    const start = new Date(today);
    start.setDate(today.getDate() - totalDays + 1);
    const weeks: { dateKey: string; count: number }[][] = [];
    let currentWeek: { dateKey: string; count: number }[] = [];

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toLocalDateKey(d);
      const count = workoutsByDate[key]?.length || 0;
      currentWeek.push({ dateKey: key, count });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const startLabel = start.toLocaleDateString(localeStr, { month: 'short', year: 'numeric' });
    const endLabel = today.toLocaleDateString(localeStr, { month: 'short', year: 'numeric' });
    return { weeks, startLabel, endLabel };
  }, [workoutsByDate, localeStr]);

  const formatCompactVolume = (volKg: number) => {
    if (unitPref === 'lb') {
      const lbs = kgToLb(volKg);
      if (lbs >= 2000) return `${(lbs / 2000).toFixed(1)} t`;
      return `${Math.round(lbs)} lb`;
    }
    if (volKg >= 1000) {
      return `${(volKg / 1000).toFixed(1)} ${language === 'ru' ? 'т' : 't'}`;
    }
    return formatWeight(volKg, unitPref);
  };

  const handleExportCsv = () => {
    const rows = filteredWorkouts.length > 0 ? filteredWorkouts : workouts;
    const header = ['Date', 'Name', 'DurationMin', 'VolumeKg', 'Sets', 'Exercises'];
    const csvLines = [
      header.join(','),
      ...rows.map((w) => {
        const durMin = Math.round((w.duration_seconds || 0) / 60);
        const exList = (w.exercises || []).map((e) => e.exercise_name).join(' | ');
        const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
        return [
          escape(toLocalDateKey(w.started_at)),
          escape(w.name),
          durMin,
          Math.round(w.total_volume_kg || 0),
          w.completed_sets_count || 0,
          escape(exList),
        ].join(',');
      }),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `duda-history-${toLocalDateKey(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrevMonth = () => {
    setSelectedDateStr(null);
    setMonthFilterEnabled(true);
    setVisibleCount(10);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDateStr(null);
    setMonthFilterEnabled(true);
    setVisibleCount(10);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(null);
    setMonthFilterEnabled(true);
    setVisibleCount(10);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Page Title */}
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#fafafa] leading-tight">
          {t('nav.history')}
        </h1>
        <p className="text-[14px] text-[#a3a3a3] mt-1">{t('history.subtitle')}</p>
      </div>

      {/* Top KPI Strip & Controls */}
      <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-8 sm:gap-12">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a3a3a3]">
              {lbl.sessions}
            </div>
            <div className="text-[26px] font-bold text-[#fafafa] font-mono tabular-nums mt-0.5">
              {kpiStats.count}
            </div>
          </div>

          <div className="h-9 w-px bg-[#262626]" />

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a3a3a3]">
              {t('history.totalVolume')}
            </div>
            <div className="text-[26px] font-bold text-[#34d399] font-mono tabular-nums mt-0.5">
              {formatCompactVolume(kpiStats.volumeKg)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setSelectedDateStr(null);
              setVisibleCount(10);
              setMonthFilterEnabled((prev) => !prev);
            }}
            className={`min-h-[44px] px-4 rounded-[10px] border text-[13px] font-medium capitalize transition-colors cursor-pointer ${
              monthFilterEnabled && !selectedDateStr
                ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                : 'bg-[#0a0a0a] border-[#404040] text-[#fafafa] hover:bg-[#262626]'
            }`}
          >
            {monthFilterEnabled && !selectedDateStr ? monthYearLabel : t('history.allMonthsBtn')}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={workouts.length === 0}
            className="min-h-[44px] px-4 rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] disabled:opacity-40 border border-[#404040] text-[#fafafa] text-[13px] font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#a3a3a3]" />
            <span>{t('history.exportBtn')}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Calendar + Sessions Split */}
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 items-start">
        {/* Left: Interactive Monthly Calendar */}
        <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-[#fafafa] capitalize truncate">
              {monthYearLabel}
            </h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] border border-[#404040] text-[#fafafa] flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="min-h-[44px] px-3 rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] border border-[#404040] text-[#fafafa] text-[12px] font-medium cursor-pointer transition-colors"
              >
                {t('history.todayBtn')}
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="min-h-[44px] min-w-[44px] rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] border border-[#404040] text-[#fafafa] flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-[#737373] py-1">
            {weekdayNames.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: calendarCells.startOffset }).map((_, i) => (
              <div
                key={`prev-${i}`}
                className="min-h-[44px] rounded-[10px] bg-[#0a0a0a]/40 border border-[#262626]/40 text-[#525252] text-[12px] font-mono flex items-center justify-center select-none"
              >
                {calendarCells.prevMonthDays - calendarCells.startOffset + i + 1}
              </div>
            ))}

            {Array.from({ length: calendarCells.daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateKey = `${calendarCells.year}-${String(calendarCells.month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayCount = workoutsByDate[dateKey]?.length || 0;
              const hasWorkout = dayCount > 0;
              const isSelected = selectedDateStr === dateKey;
              const isToday = todayKey === dateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => {
                    setVisibleCount(10);
                    setSelectedDateStr((prev) => (prev === dateKey ? null : dateKey));
                  }}
                  className={`min-h-[44px] rounded-[10px] border text-[13px] font-mono font-medium flex flex-col items-center justify-center relative transition-colors cursor-pointer ${
                    hasWorkout
                      ? 'bg-[#34d399] border-[#34d399] text-[#0a0a0a] font-semibold'
                      : isToday
                      ? 'bg-[#0a0a0a] border-[#737373] text-[#fafafa]'
                      : 'bg-[#0a0a0a] border-[#262626] text-[#a3a3a3] hover:border-[#404040] hover:text-[#fafafa]'
                  } ${isSelected ? 'ring-2 ring-[#fafafa] ring-offset-1 ring-offset-[#171717]' : ''}`}
                >
                  <span>{dayNum}</span>
                  {dayCount > 1 && (
                    <span className="text-[9px] leading-none font-bold opacity-80">
                      ×{dayCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#262626] flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <div className="flex items-center gap-2 text-[#a3a3a3]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34d399] inline-block shrink-0" />
              <span>{t('history.workoutDotLegend')}</span>
            </div>

            {selectedDateStr ? (
              <button
                type="button"
                onClick={() => setSelectedDateStr(null)}
                className="text-[12px] font-medium text-[#34d399] hover:underline cursor-pointer"
              >
                {t('history.selectedDateLabel', {
                  day: formatDate(selectedDateStr + 'T12:00:00', language),
                })}{' '}
                · {t('history.showAllDates')}
              </button>
            ) : (
              <span className="text-[#737373] font-mono">
                {monthWorkouts.length} / {workouts.length}
              </span>
            )}
          </div>
        </div>

        {/* Right: Workout Sessions List */}
        <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#262626]">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-[16px] font-semibold text-[#fafafa] truncate">
                {lbl.sessions}
              </h2>
              <span className="px-2 py-0.5 rounded-[6px] bg-[#0a0a0a] border border-[#404040] text-[12px] font-mono text-[#a3a3a3]">
                {filteredWorkouts.length}
              </span>
            </div>

            {(selectedDateStr || monthFilterEnabled) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDateStr(null);
                  setMonthFilterEnabled(false);
                  setVisibleCount(10);
                }}
                className="min-h-[44px] inline-flex items-center px-2 -my-2 text-[12px] font-medium text-[#a3a3a3] hover:text-[#fafafa] cursor-pointer"
              >
                {t('history.allMonthsBtn')}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-[#0a0a0a] rounded-[12px] border border-[#262626] animate-pulse"
                />
              ))}
            </div>
          ) : filteredWorkouts.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-[#404040] rounded-[12px] p-6 bg-[#0a0a0a] space-y-3">
              <CalendarIcon className="w-8 h-8 text-[#525252] mx-auto" />
              <div className="text-[14px] font-medium text-[#a3a3a3]">
                {t('history.noWorkouts')}
              </div>
              {workouts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDateStr(null);
                    setMonthFilterEnabled(false);
                    setVisibleCount(10);
                  }}
                >
                  {t('history.allMonthsBtn')}
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#262626]">
              {displayedWorkouts.map((workout) => {
                const isExpanded = expandedId === workout.id;

                return (
                  <div key={workout.id} className="py-4 first:pt-1 last:pb-1 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[15px] font-semibold text-[#fafafa] truncate">
                            {workout.name}
                          </h3>
                          {isExpanded && (
                            <span className="px-2 py-0.5 rounded-[6px] bg-[#022c22] border border-[#064e3b] text-[11px] font-medium text-[#34d399]">
                              {t('history.detailsOpen')}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-mono text-[#a3a3a3]">
                          <span>{formatDate(workout.started_at, language)}</span>
                          {workout.duration_seconds && workout.duration_seconds > 0 ? (
                            <span>· {formatDuration(workout.duration_seconds)}</span>
                          ) : null}
                          {workout.total_volume_kg !== undefined && workout.total_volume_kg > 0 ? (
                            <span className="text-[#34d399] font-medium">
                              · {formatWeight(workout.total_volume_kg, unitPref)}
                            </span>
                          ) : null}
                          <span>
                            · {workout.completed_sets_count || 0} {lbl.sets}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleExpand(workout.id)}
                          className="min-h-[44px] px-3.5 rounded-[10px] bg-[#0a0a0a] hover:bg-[#262626] border border-[#404040] text-[#fafafa] text-[13px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <span>
                            {isExpanded ? t('history.hideDetails') : t('history.showDetails')}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#a3a3a3]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#a3a3a3]" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 rounded-[12px] bg-[#0a0a0a] border border-[#404040] space-y-3">
                        {workout.exercises && workout.exercises.length > 0 && (
                          <div className="space-y-2.5">
                            {workout.exercises.map((ex, i) => {
                              const exVol = (ex.sets || []).reduce(
                                (sum, s) => sum + (s.weight_kg || 0) * (s.reps || 0),
                                0
                              );
                              return (
                                <div
                                  key={i}
                                  className="p-3 rounded-[10px] bg-[#171717] border border-[#262626] space-y-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-[13px] font-semibold text-[#fafafa] flex items-center gap-2">
                                      <span className="text-[11px] font-mono text-[#34d399]">
                                        {String(i + 1).padStart(2, '0')}
                                      </span>
                                      <span>{ex.exercise_name}</span>
                                    </h4>
                                    <span className="text-[11px] font-mono text-[#a3a3a3]">
                                      {t('history.subtotalVol', {
                                        volume: formatWeight(exVol, unitPref),
                                      })}
                                    </span>
                                  </div>

                                  {ex.notes && ex.notes.trim() && (
                                    <div className="px-2.5 py-1.5 rounded-[8px] bg-[#0a0a0a] border border-[#262626] text-[12px] text-[#a3a3a3]">
                                      {ex.notes}
                                    </div>
                                  )}

                                  <div className="flex flex-wrap gap-1.5">
                                    {ex.sets?.map((set, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="inline-flex items-center gap-1.5 bg-[#0a0a0a] px-2.5 py-1 rounded-[8px] text-[12px] font-mono border border-[#262626]"
                                      >
                                        <span className="text-[#737373]">
                                          {set.set_number || sIdx + 1} ·
                                        </span>
                                        <span className="text-[#fafafa]">
                                          {formatWeight(set.weight_kg, unitPref)} × {set.reps}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="pt-3 border-t border-[#262626] flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[13px] font-mono text-[#a3a3a3]">
                            {t('history.totalVolRow', {
                              volume: formatWeight(workout.total_volume_kg || 0, unitPref),
                            })}
                          </span>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="primary"
                              size="md"
                              onClick={() => void handleRepeatWorkout(workout)}
                              className="min-h-[44px] text-[13px] gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{lbl.repeat}</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="md"
                              onClick={() => setDeletingId(workout.id)}
                              className="min-h-[44px] text-[13px] gap-1.5 text-red-400 hover:border-red-500/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t('common.delete')}</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredWorkouts.length > visibleCount && (
                <div className="pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((prev) => prev + 10)}
                    className="w-full min-h-[44px] text-[13px]"
                  >
                    {t('history.loadMore')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom 52-Week Consistency Heatmap */}
      <div className="bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-[#fafafa]">{t('history.yearTitle')}</h3>
          <span className="text-[12px] font-mono text-[#a3a3a3]">
            {t('history.weeksSpan', {
              start: annualHeatmap.startLabel,
              end: annualHeatmap.endLabel,
            })}
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar pb-1">
          <div className="inline-flex gap-1">
            {annualHeatmap.weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((day, dIdx) => (
                  <button
                    key={dIdx}
                    type="button"
                    onClick={() => {
                      const d = new Date(day.dateKey + 'T12:00:00');
                      setSelectedMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                      setSelectedDateStr((prev) => (prev === day.dateKey ? null : day.dateKey));
                    }}
                    title={`${day.dateKey}: ${day.count}`}
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] border transition-colors cursor-pointer ${
                      day.count === 0
                        ? 'bg-[#0a0a0a] border-[#262626]'
                        : day.count === 1
                        ? 'bg-[#064e3b] border-[#047857]'
                        : 'bg-[#34d399] border-[#34d399]'
                    } ${selectedDateStr === day.dateKey ? 'ring-2 ring-[#fafafa]' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#a3a3a3] pt-1">
          <span className="font-mono">{workouts.length} {lbl.sessions}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#0a0a0a] border border-[#262626]" />
              {t('history.noLogsLegend')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#34d399]" />
              {t('history.hasWorkoutLegend')}
            </span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title={lbl.deleteTitle}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setDeletingId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="md"
              isLoading={deleteWorkoutMutation.isPending}
              onClick={() => deletingId && deleteWorkoutMutation.mutate(deletingId)}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-[#a3a3a3]">
          {t('common.delete')}
        </p>
      </Modal>
    </div>
  );
};
