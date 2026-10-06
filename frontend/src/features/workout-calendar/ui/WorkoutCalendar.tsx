import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  Dumbbell,
  Clock,
  RotateCcw,
  Sparkles,
  Trophy,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Card } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { formatDuration } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { WorkoutHistoryItem, ActiveExercise, ActiveSet } from '../../../entities/workout/model/types.ts';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';

interface WorkoutCalendarProps {
  workouts: WorkoutHistoryItem[];
  onSelectWorkout?: (workout: WorkoutHistoryItem) => void;
}

const SPLIT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  push: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  pull: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  legs: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  upper: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
  lower: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', dot: 'bg-rose-400' },
  arms: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', dot: 'bg-purple-400' },
  full: { bg: 'bg-brand-500/15', text: 'text-brand-400', border: 'border-brand-500/30', dot: 'bg-brand-400' },
  default: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-400' },
};

function getSplitColor(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('push') || lower.includes('chest')) return SPLIT_COLORS.push;
  if (lower.includes('pull') || lower.includes('back')) return SPLIT_COLORS.pull;
  if (lower.includes('leg') || lower.includes('quad') || lower.includes('squat')) return SPLIT_COLORS.legs;
  if (lower.includes('upper')) return SPLIT_COLORS.upper;
  if (lower.includes('lower')) return SPLIT_COLORS.lower;
  if (lower.includes('arm') || lower.includes('bicep') || lower.includes('tricep')) return SPLIT_COLORS.arms;
  if (lower.includes('full')) return SPLIT_COLORS.full;
  return SPLIT_COLORS.default;
}

export const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ workouts }) => {
  const unitPref = useAuthStore((s) => s.unitPreference);
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Map workouts by YYYY-MM-DD
  const workoutsByDate = useMemo(() => {
    const map: Record<string, WorkoutHistoryItem[]> = {};
    for (const w of workouts) {
      if (!w.started_at) continue;
      const dateKey = new Date(w.started_at).toISOString().slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(w);
    }
    return map;
  }, [workouts]);

  // Streak & consistency statistics
  const streakStats = useMemo(() => {
    const uniqueDates = Object.keys(workoutsByDate).sort().reverse();
    if (uniqueDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, thisMonthCount: 0 };
    }

    let currentStreak = 0;
    let longestStreak = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if trained today or yesterday to continue current streak
    const todayKey = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    let streakStartDate: Date | null = null;
    if (workoutsByDate[todayKey]) {
      streakStartDate = new Date(today);
    } else if (workoutsByDate[yesterdayKey]) {
      streakStartDate = new Date(yesterday);
    }

    if (streakStartDate) {
      const runner = new Date(streakStartDate);
      while (true) {
        const key = runner.toISOString().slice(0, 10);
        if (workoutsByDate[key]) {
          currentStreak++;
          runner.setDate(runner.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate workouts this month
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    let thisMonthCount = 0;
    for (const key of Object.keys(workoutsByDate)) {
      if (key.startsWith(currentMonthPrefix)) {
        thisMonthCount += workoutsByDate[key].length;
      }
    }

    // Estimate longest streak
    longestStreak = Math.max(currentStreak, uniqueDates.length > 0 ? 1 : 0);

    return { currentStreak, longestStreak, thisMonthCount };
  }, [workoutsByDate, year, month]);

  // Calendar matrix calculations
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
  // Convert to Monday-start (0 = Monday, 6 = Sunday)
  const startOffset = (firstDayIndex + 6) % 7;

  const prevMonthDays = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(now.toISOString().slice(0, 10));
  };

  const selectedWorkouts = workoutsByDate[selectedDateStr] || [];

  const handleRepeatWorkout = (w: WorkoutHistoryItem) => {
    if (activeWorkout) {
      const hasCompletedSets = activeWorkout.exercises.some((e) =>
        e.sets.some((s) => s.completed)
      );
      if (hasCompletedSets) {
        const confirmed = window.confirm(
          `You have an active workout in progress ("${activeWorkout.name}"). Discard it and start "${w.name}"?`
        );
        if (!confirmed) {
          openSheet();
          return;
        }
      }
    }

    const initialExercises: ActiveExercise[] = (w.exercises || []).map((ex: any, idx: number) => {
      const exerciseId = ex.exercise_id || ex.exerciseId || `ex-${idx}-${generateUUID()}`;
      const sets: ActiveSet[] = (ex.sets || []).map((s: any, sIdx: number) => ({
        id: generateUUID(),
        setNumber: s.set_number || s.setNumber || sIdx + 1,
        setType: s.set_type || s.setType || 'normal',
        weightKg: s.weight_kg || s.weightKg || 0,
        reps: s.reps || 10,
        completed: false,
      }));

      return {
        exerciseId,
        exerciseName: ex.exercise_name || ex.exerciseName || `Exercise ${idx + 1}`,
        measurementType: 'weight_reps',
        sets: sets.length > 0 ? sets : Array.from({ length: 3 }, (_, i) => ({
          id: generateUUID(),
          setNumber: i + 1,
          setType: 'normal' as const,
          weightKg: 0,
          reps: 10,
          completed: false,
        })),
      };
    });

    const newId = generateUUID();
    startWorkout(newId, `${w.name}`, undefined, initialExercises);
    openSheet();
  };

  // 52-Week Activity Heatmap Data
  const annualHeatmapWeeks = useMemo(() => {
    const weeks: { dateKey: string; count: number; level: number }[][] = [];
    const today = new Date();
    // 52 weeks ago
    const start = new Date(today);
    start.setDate(today.getDate() - 52 * 7 + (7 - today.getDay()));

    let currentWeek: { dateKey: string; count: number; level: number }[] = [];
    const runner = new Date(start);

    for (let i = 0; i < 52 * 7; i++) {
      const dateKey = runner.toISOString().slice(0, 10);
      const count = workoutsByDate[dateKey]?.length || 0;
      const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;

      currentWeek.push({ dateKey, count, level });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      runner.setDate(runner.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  }, [workoutsByDate]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Streak & Consistency KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-gradient-to-br from-dark-800 to-brand-950/30 border-brand-500/30 flex items-center gap-3.5 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-brand-400 font-mono">
                {streakStats.currentStreak}
              </span>
              <span className="text-xs font-semibold text-zinc-400">days streak</span>
            </div>
            <div className="text-[11px] text-zinc-400 font-medium">
              {streakStats.currentStreak > 0
                ? 'Consistency on fire! Keep it rolling.'
                : 'Log today to ignite your workout streak.'}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-dark-800 to-blue-950/30 border-blue-500/30 flex items-center gap-3.5 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-blue-400 font-mono">
                {streakStats.thisMonthCount}
              </span>
              <span className="text-xs font-semibold text-zinc-400">sessions</span>
            </div>
            <div className="text-[11px] text-zinc-400 font-medium">
              Completed in {currentDate.toLocaleString('default', { month: 'long' })}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-dark-800 to-emerald-950/30 border-emerald-500/30 flex items-center gap-3.5 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                {workouts.length}
              </span>
              <span className="text-xs font-semibold text-zinc-400">all-time logs</span>
            </div>
            <div className="text-[11px] text-zinc-400 font-medium">
              Total historical training sessions
            </div>
          </div>
        </Card>
      </div>

      {/* Main Interactive Monthly Calendar */}
      <Card className="p-5 bg-dark-800/90 border-dark-700/80 shadow-2xl rounded-2xl space-y-4">
        {/* Calendar Navigation Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-zinc-100 tracking-tight">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-dark-700 hover:bg-dark-600 text-zinc-200 transition-colors border border-dark-600"
            >
              Today
            </button>
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-zinc-300 transition-colors border border-dark-600"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-zinc-300 transition-colors border border-dark-600"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-zinc-400 uppercase tracking-wider py-1 border-b border-dark-700/60">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days Matrix */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Previous Month Inactive Days */}
          {Array.from({ length: startOffset }).map((_, i) => {
            const dayNum = prevMonthDays - startOffset + i + 1;
            return (
              <div
                key={`prev-${i}`}
                className="min-h-[68px] sm:min-h-[84px] p-1.5 rounded-xl bg-dark-900/30 border border-dark-800/40 text-zinc-600 select-none opacity-40 text-xs"
              >
                <span>{dayNum}</span>
              </div>
            );
          })}

          {/* Current Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayWorkouts = workoutsByDate[dateKey] || [];
            const isSelected = selectedDateStr === dateKey;
            const isToday = new Date().toISOString().slice(0, 10) === dateKey;

            return (
              <div
                key={dateKey}
                onClick={() => setSelectedDateStr(dateKey)}
                className={`min-h-[68px] sm:min-h-[84px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-brand-500/10 border-brand-500 shadow-md ring-2 ring-brand-500/20'
                    : isToday
                    ? 'bg-dark-800 border-zinc-500/50 hover:border-zinc-400'
                    : 'bg-dark-900/70 border-dark-750 hover:border-dark-600 hover:bg-dark-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-brand-500 text-dark-950 flex items-center justify-center font-extrabold'
                        : isSelected
                        ? 'text-brand-400 font-extrabold'
                        : 'text-zinc-300'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {dayWorkouts.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50 animate-pulse" />
                  )}
                </div>

                {/* Workout Pills inside day cell */}
                <div className="space-y-1 mt-1">
                  {dayWorkouts.slice(0, 2).map((w, wIdx) => {
                    const style = getSplitColor(w.name);
                    return (
                      <div
                        key={wIdx}
                        className={`text-[9px] sm:text-[10px] font-semibold truncate px-1.5 py-0.5 rounded-md border ${style.bg} ${style.text} ${style.border}`}
                        title={w.name}
                      >
                        {w.name}
                      </div>
                    );
                  })}
                  {dayWorkouts.length > 2 && (
                    <span className="text-[9px] font-mono text-zinc-400 pl-1">
                      +{dayWorkouts.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Selected Date Workout Detail Inspector */}
      <Card className="p-5 bg-dark-800/90 border-dark-700/80 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-dark-700/60 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-brand-400" />
            <h3 className="text-base font-bold text-zinc-100">
              Workouts for {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('default', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </h3>
          </div>
          <span className="text-xs font-mono text-zinc-400 bg-dark-900 px-2.5 py-1 rounded-lg border border-dark-700">
            {selectedWorkouts.length} Session(s)
          </span>
        </div>

        {selectedWorkouts.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs space-y-2">
            <p>No training sessions were logged on this date.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeWorkout) {
                  openSheet();
                } else {
                  startWorkout(generateUUID(), 'Quick Training Session');
                }
              }}
              className="gap-1.5 text-xs text-brand-400 border-dark-700 hover:bg-dark-700"
            >
              <Zap className="w-3.5 h-3.5" />
              Start Workout Now
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedWorkouts.map((w) => {
              const style = getSplitColor(w.name);
              return (
                <div
                  key={w.id}
                  className="p-4 rounded-xl bg-dark-900/90 border border-dark-700/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${style.dot}`} />
                      <h4 className="text-sm font-bold text-zinc-100">{w.name}</h4>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRepeatWorkout(w)}
                      className="gap-1 text-xs border-dark-600"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Repeat
                    </Button>
                  </div>

                  {/* Summary Metrics */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Flame className="w-3.5 h-3.5" />
                      {formatWeight(w.total_volume_kg || 0, unitPref)}
                    </span>
                    <span className="flex items-center gap-1 text-sky-400">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(w.duration_seconds || 0)}
                    </span>
                    <span className="flex items-center gap-1 text-zinc-300">
                      <Dumbbell className="w-3.5 h-3.5 text-zinc-500" />
                      {w.completed_sets_count || 0} completed sets
                    </span>
                  </div>

                  {/* Exercises and Sets Breakdown */}
                  {w.exercises && w.exercises.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-dark-800">
                      {w.exercises.map((ex, exIdx) => (
                        <div key={exIdx} className="space-y-1">
                          <div className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                            <span>{ex.exercise_name}</span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {ex.sets?.length || 0} sets
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ex.sets?.map((s, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2 py-0.5 rounded bg-dark-800 text-[11px] font-mono text-zinc-300 border border-dark-700"
                              >
                                {formatWeight(s.weight_kg, unitPref)} × {s.reps}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 52-Week GitHub Style Annual Activity Heatmap */}
      <Card className="p-5 bg-dark-800/90 border-dark-700/80 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
              Annual Consistency Heatmap (Past 52 Weeks)
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">
            {workouts.length} workouts logged in past 365 days
          </span>
        </div>

        <div className="overflow-x-auto pb-2 no-scrollbar">
          <div className="inline-flex gap-1">
            {annualHeatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((day, dIdx) => (
                  <div
                    key={dIdx}
                    onClick={() => setSelectedDateStr(day.dateKey)}
                    className={`w-3 h-3 rounded-[3px] transition-transform hover:scale-125 cursor-pointer ${
                      day.level === 0
                        ? 'bg-dark-900 border border-dark-750'
                        : day.level === 1
                        ? 'bg-emerald-900 border border-emerald-700'
                        : day.level === 2
                        ? 'bg-emerald-500 border border-emerald-400 shadow-sm'
                        : 'bg-brand-400 border border-brand-300 shadow-sm'
                    } ${selectedDateStr === day.dateKey ? 'ring-2 ring-white' : ''}`}
                    title={`${day.dateKey}: ${day.count} workout(s)`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 text-[10px] text-zinc-400 pt-1">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-[2px] bg-dark-900 border border-dark-750" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-900" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-brand-400" />
          <span>More</span>
        </div>
      </Card>
    </div>
  );
};
