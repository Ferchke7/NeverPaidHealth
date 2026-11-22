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
import { formatDuration, toLocalDateKey } from '../../../shared/lib/dates.ts';
import { formatWeight } from '../../../shared/lib/units.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { useStartWorkout } from '../../start-workout/model/useStartWorkout.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';

interface WorkoutCalendarProps {
  workouts: WorkoutHistoryItem[];
  onSelectWorkout?: (workout: WorkoutHistoryItem) => void;
}

const SPLIT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  push: { bg: 'bg-[#F0EFFE]', text: 'text-[#6D28D9]', border: 'border-[#DDD6FE]', dot: 'bg-[#6D28D9]' },
  pull: { bg: 'bg-[#ECFEFF]', text: 'text-[#0891B2]', border: 'border-[#A5F3FC]', dot: 'bg-[#0891B2]' },
  legs: { bg: 'bg-[#FFF7ED]', text: 'text-[#EA580C]', border: 'border-[#FED7AA]', dot: 'bg-[#EA580C]' },
  upper: { bg: 'bg-[#EEF2FF]', text: 'text-[#4338CA]', border: 'border-[#C7D2FE]', dot: 'bg-[#4338CA]' },
  lower: { bg: 'bg-[#ECFDF5]', text: 'text-[#059669]', border: 'border-[#A7F3D0]', dot: 'bg-[#059669]' },
  arms: { bg: 'bg-[#F5F3FF]', text: 'text-[#7C3AED]', border: 'border-[#DDD6FE]', dot: 'bg-[#7C3AED]' },
  full: { bg: 'bg-[#F0EFFE]', text: 'text-[#6D28D9]', border: 'border-[#DDD6FE]', dot: 'bg-[#6D28D9]' },
  default: { bg: 'bg-[#F8F7FC]', text: 'text-[#6B7280]', border: 'border-[#ECEAF6]', dot: 'bg-[#94A3B8]' },
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
  const startWorkout = useStartWorkout();
  const activeWorkout = useActiveWorkoutStore((s) => s.workout);
  const openSheet = useActiveWorkoutStore((s) => s.openSheet);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    return toLocalDateKey(new Date());
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Map workouts by YYYY-MM-DD in user's local timezone
  const workoutsByDate = useMemo(() => {
    const map: Record<string, WorkoutHistoryItem[]> = {};
    for (const w of workouts) {
      if (!w.started_at) continue;
      const dateKey = toLocalDateKey(w.started_at);
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
    const todayKey = toLocalDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toLocalDateKey(yesterday);

    let streakStartDate: Date | null = null;
    if (workoutsByDate[todayKey]) {
      streakStartDate = new Date(today);
    } else if (workoutsByDate[yesterdayKey]) {
      streakStartDate = new Date(yesterday);
    }

    if (streakStartDate) {
      const runner = new Date(streakStartDate);
      while (true) {
        const key = toLocalDateKey(runner);
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

    // Calculate actual longest streak across full training history
    if (uniqueDates.length > 0) {
      const ascDates = [...uniqueDates].sort();
      let tempStreak = 1;
      longestStreak = 1;
      for (let i = 1; i < ascDates.length; i++) {
        const prev = new Date(ascDates[i - 1] + 'T00:00:00');
        const curr = new Date(ascDates[i] + 'T00:00:00');
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
    }

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
    setSelectedDateStr(toLocalDateKey(now));
  };

  const selectedWorkouts = workoutsByDate[selectedDateStr] || [];

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
      const dateKey = toLocalDateKey(runner);
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-[#10B981] shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#10B981] font-mono tabular-nums">
                {streakStats.currentStreak}
              </span>
              <span className="text-xs font-medium text-[#6B7280]">days streak</span>
            </div>
            <div className="text-[11px] text-[#6B7280]">
              {streakStats.currentStreak > 0
                ? 'Consistency on fire! Keep it rolling.'
                : 'Log today to ignite your workout streak.'}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[12px] bg-[#F0EFFE] border border-[#DDD6FE] flex items-center justify-center text-[#6D28D9] shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#1E1B4B] font-mono tabular-nums">
                {streakStats.thisMonthCount}
              </span>
              <span className="text-xs font-medium text-[#6B7280]">sessions</span>
            </div>
            <div className="text-[11px] text-[#6B7280]">
              Completed in {currentDate.toLocaleString('default', { month: 'long' })}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[12px] bg-[#ECFEFF] border border-[#A5F3FC] flex items-center justify-center text-[#0891B2] shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#6D28D9] font-mono tabular-nums">
                {workouts.length}
              </span>
              <span className="text-xs font-medium text-[#6B7280]">all-time logs</span>
            </div>
            <div className="text-[11px] text-[#6B7280]">
              Total historical training sessions
            </div>
          </div>
        </Card>
      </div>

      {/* Main Interactive Monthly Calendar */}
      <Card className="p-5 space-y-4">
        {/* Calendar Navigation Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[#F0EFFE] border border-[#DDD6FE] flex items-center justify-center text-[#6D28D9]">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-[#1E1B4B] tracking-tight">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToday}
              className="min-h-[40px] px-3 text-xs font-semibold rounded-[10px] bg-[#F8F7FC] hover:bg-[#F0EFFE] text-[#6D28D9] transition-colors border border-[#ECEAF6] cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handlePrevMonth}
              className="min-h-[40px] min-w-[40px] p-1.5 rounded-[10px] bg-[#F8F7FC] hover:bg-[#F0EFFE] text-[#1E1B4B] transition-colors border border-[#ECEAF6] flex items-center justify-center cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="min-h-[40px] min-w-[40px] p-1.5 rounded-[10px] bg-[#F8F7FC] hover:bg-[#F0EFFE] text-[#1E1B4B] transition-colors border border-[#ECEAF6] flex items-center justify-center cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wider py-1 border-b border-[#ECEAF6]">
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
                className="min-h-[68px] sm:min-h-[84px] p-1.5 rounded-[12px] bg-[#F8F7FC]/60 border border-[#ECEAF6]/60 text-[#CBD5E1] select-none opacity-60 text-xs"
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
            const isToday = toLocalDateKey(new Date()) === dateKey;

            return (
              <div
                key={dateKey}
                onClick={() => setSelectedDateStr(dateKey)}
                className={`min-h-[68px] sm:min-h-[84px] p-1.5 sm:p-2 rounded-[12px] border transition-colors cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#F0EFFE] border-[#6D28D9]'
                    : isToday
                    ? 'bg-white border-[#6D28D9]'
                    : 'bg-[#F8F7FC] border-[#ECEAF6] hover:border-[#C4B5FD]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-[#6D28D9] text-white flex items-center justify-center font-bold'
                        : isSelected
                        ? 'text-[#6D28D9] font-bold'
                        : 'text-[#1E1B4B]'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {dayWorkouts.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[#6D28D9]" />
                  )}
                </div>

                {/* Workout Pills inside day cell */}
                <div className="space-y-1 mt-1">
                  {dayWorkouts.slice(0, 2).map((w, wIdx) => {
                    const style = getSplitColor(w.name);
                    return (
                      <div
                        key={wIdx}
                        className={`text-[9px] sm:text-[10px] font-semibold truncate px-1.5 py-0.5 rounded-[6px] border ${style.bg} ${style.text} ${style.border}`}
                        title={w.name}
                      >
                        {w.name}
                      </div>
                    );
                  })}
                  {dayWorkouts.length > 2 && (
                    <span className="text-[9px] font-mono text-[#6B7280] pl-1">
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
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#ECEAF6] pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#6D28D9]" />
            <h3 className="text-base font-bold text-[#1E1B4B]">
              Workouts for {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('default', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </h3>
          </div>
          <span className="text-xs font-mono text-[#6D28D9] font-semibold bg-[#F0EFFE] px-2.5 py-1 rounded-[8px] border border-[#DDD6FE]">
            {selectedWorkouts.length} Session(s)
          </span>
        </div>

        {selectedWorkouts.length === 0 ? (
          <div className="text-center py-8 text-[#6B7280] text-xs space-y-2">
            <p>No training sessions were logged on this date.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeWorkout) {
                  openSheet();
                } else {
                  void startWorkout({ name: 'Quick Training Session' });
                }
              }}
              className="gap-1.5 text-xs"
            >
              <Zap className="w-3.5 h-3.5 text-[#6D28D9]" />
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
                  className="p-4 rounded-[14px] bg-[#F8F7FC] border border-[#ECEAF6] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                      <h4 className="text-sm font-bold text-[#1E1B4B]">{w.name}</h4>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRepeatWorkout(w)}
                      className="gap-1 text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Repeat
                    </Button>
                  </div>

                  {/* Summary Metrics */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#6B7280]">
                    <span className="flex items-center gap-1 text-[#6D28D9] font-semibold">
                      <Flame className="w-3.5 h-3.5" />
                      {formatWeight(w.total_volume_kg || 0, unitPref)}
                    </span>
                    <span className="flex items-center gap-1 text-[#1E1B4B]">
                      <Clock className="w-3.5 h-3.5 text-[#6B7280]" />
                      {formatDuration(w.duration_seconds || 0)}
                    </span>
                    <span className="flex items-center gap-1 text-[#6B7280]">
                      <Dumbbell className="w-3.5 h-3.5 text-[#94A3B8]" />
                      {w.completed_sets_count || 0} completed sets
                    </span>
                  </div>

                  {/* Exercises and Sets Breakdown */}
                  {w.exercises && w.exercises.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#ECEAF6]">
                      {w.exercises.map((ex, exIdx) => (
                        <div key={exIdx} className="space-y-1">
                          <div className="text-xs font-semibold text-[#1E1B4B] flex items-center justify-between">
                            <span>{ex.exercise_name}</span>
                            <span className="text-[10px] font-mono text-[#6B7280]">
                              {ex.sets?.length || 0} sets
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ex.sets?.map((s, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2 py-0.5 rounded-[8px] bg-white text-[11px] font-mono text-[#1E1B4B] border border-[#ECEAF6]"
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

      {/* 52-Week Annual Activity Heatmap */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#6D28D9]" />
            <h3 className="text-sm font-bold text-[#1E1B4B] uppercase tracking-wider">
              Annual Consistency Heatmap (Past 52 Weeks)
            </h3>
          </div>
          <span className="text-[11px] text-[#6B7280]">
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
                    className={`w-3 h-3 rounded-[4px] transition-colors cursor-pointer ${
                      day.level === 0
                        ? 'bg-[#F4F3FA] border border-[#ECEAF6]'
                        : day.level === 1
                        ? 'bg-[#DDD6FE] border border-[#C4B5FD]'
                        : day.level === 2
                        ? 'bg-[#8B5CF6] border border-[#7C3AED]'
                        : 'bg-[#6D28D9] border border-[#6D28D9]'
                    } ${selectedDateStr === day.dateKey ? 'ring-2 ring-[#1B1145]' : ''}`}
                    title={`${day.dateKey}: ${day.count} workout(s)`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 text-[10px] text-[#6B7280] pt-1">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[#F4F3FA] border border-[#ECEAF6]" />
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[#DDD6FE]" />
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[#8B5CF6]" />
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[#6D28D9]" />
          <span>More</span>
        </div>
      </Card>
    </div>
  );
};
