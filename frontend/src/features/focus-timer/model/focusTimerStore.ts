import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../../../shared/api/client.ts';
import { TodoCategory } from '../../../entities/todo/model/types.ts';

export type TimerMode = 'pomodoro' | 'target_timer' | 'stopwatch';
export type PomodoroPhase = 'work' | 'short_break' | 'long_break';
export type SplitStrategy = '25m' | '30m' | '50m' | 'equal2' | 'single';

export function calculatePomodoroPlan(
  targetTotalMinutes: number,
  strategy: SplitStrategy = '25m',
  customWorkMinutes?: number
): { rounds: number[]; totalWorkSec: number } {
  const totalMin = Math.max(1, targetTotalMinutes || 25);

  if (strategy === 'single') {
    return {
      rounds: [totalMin * 60],
      totalWorkSec: totalMin * 60,
    };
  }

  if (strategy === 'equal2') {
    const half1 = Math.ceil(totalMin / 2);
    const half2 = Math.max(1, totalMin - half1);
    return {
      rounds: [half1 * 60, half2 * 60],
      totalWorkSec: totalMin * 60,
    };
  }

  let blockSize = 25;
  if (strategy === '30m') blockSize = 30;
  else if (strategy === '50m') blockSize = 50;
  else if (customWorkMinutes) blockSize = customWorkMinutes;

  if (totalMin <= blockSize) {
    return {
      rounds: [totalMin * 60],
      totalWorkSec: totalMin * 60,
    };
  }

  const rounds: number[] = [];
  let remaining = totalMin;
  while (remaining > 0) {
    if (remaining <= blockSize) {
      rounds.push(remaining * 60);
      remaining = 0;
    } else {
      rounds.push(blockSize * 60);
      remaining -= blockSize;
    }
  }

  return {
    rounds,
    totalWorkSec: totalMin * 60,
  };
}

interface FocusTimerState {
  isActive: boolean;
  isRunning: boolean;
  todoId: string | null;
  taskTitle: string;
  category: TodoCategory;
  mode: TimerMode;
  pomodoroPhase: PomodoroPhase;
  pomodoroRound: number;
  totalPomodoroRounds: number;

  targetTotalMinutes: number;
  splitStrategy: SplitStrategy;
  roundDurationsSec: number[];

  workDurationSec: number;       // duration of current active work round
  shortBreakDurationSec: number; // default 5 * 60 = 300
  longBreakDurationSec: number;  // default 15 * 60 = 900
  targetDurationSec: number;     // for target_timer mode

  targetEndTime: number | null;            // Date.now() + remaining * 1000 (drift-free)
  currentSegmentStartedAt: number | null;  // Date.now() when last started/resumed
  accumulatedWorkSeconds: number;          // Total work seconds logged before current segment
  sessionStartedAt: number | null;
  secondsRemaining: number;
  secondsElapsedTotal: number;

  isModalOpen: boolean;

  // Actions
  startForTodo: (params: {
    todoId: string;
    title: string;
    category: TodoCategory;
    targetDurationMinutes?: number;
    strategy?: SplitStrategy;
    mode?: TimerMode;
    workMinutes?: number;
  }) => void;
  startQuickSession: (
    title: string,
    category: TodoCategory,
    targetDurationMinutes?: number,
    strategy?: SplitStrategy,
    mode?: TimerMode
  ) => void;
  setMode: (mode: TimerMode) => void;
  setSplitStrategy: (strategy: SplitStrategy) => void;
  setTargetTotalMinutes: (minutes: number) => void;
  setWorkDurationMinutes: (minutes: number) => void;
  setBreakDurationMinutes: (minutes: number) => void;
  setLongBreakDurationMinutes: (minutes: number) => void;
  pause: () => void;
  resume: () => void;
  syncTick: () => void;
  tick: () => void;
  skipPhase: () => void;
  resetCurrentPhase: () => void;
  stopAndLog: (markCompleted?: boolean, notes?: string) => Promise<void>;
  discard: () => void;
  openModal: () => void;
  closeModal: () => void;
  requestNotificationPermission: () => Promise<void>;
}

// Web Audio API chime with multi-tone synthesis
function playChimeSound(type: 'complete' | 'break' | 'work') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'work') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25); // A5
    } else if (type === 'break') {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.25);
    } else {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.35); // G5
    }

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch {
    // AudioContext blocked
  }
}

function sendBrowserNotification(title: string, body: string) {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    }
  } catch {
    // Ignore notification errors
  }
}

export const useFocusTimerStore = create<FocusTimerState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isRunning: false,
      todoId: null,
      taskTitle: '',
      category: 'work',
      mode: 'pomodoro',
      pomodoroPhase: 'work',
      pomodoroRound: 1,
      totalPomodoroRounds: 1,

      targetTotalMinutes: 25,
      splitStrategy: '25m',
      roundDurationsSec: [25 * 60],

      workDurationSec: 25 * 60,
      shortBreakDurationSec: 5 * 60,
      longBreakDurationSec: 15 * 60,
      targetDurationSec: 25 * 60,

      targetEndTime: null,
      currentSegmentStartedAt: null,
      accumulatedWorkSeconds: 0,
      sessionStartedAt: null,
      secondsRemaining: 25 * 60,
      secondsElapsedTotal: 0,
      isModalOpen: false,

      requestNotificationPermission: async () => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          try {
            await Notification.requestPermission();
          } catch {
            // Permission request failed or rejected
          }
        }
      },

      startForTodo: ({
        todoId,
        title,
        category,
        targetDurationMinutes = 25,
        strategy = '25m',
        mode = 'pomodoro',
        workMinutes,
      }) => {
        const totalMin = Math.max(1, targetDurationMinutes || 25);
        const { rounds } = calculatePomodoroPlan(totalMin, strategy, workMinutes);
        const initialRoundDuration = rounds[0] || 25 * 60;
        const initialRemaining = mode === 'pomodoro' ? initialRoundDuration : totalMin * 60;
        const now = Date.now();

        get().requestNotificationPermission();

        set({
          isActive: true,
          isRunning: true,
          todoId,
          taskTitle: title,
          category,
          mode,
          pomodoroPhase: 'work',
          pomodoroRound: 1,
          totalPomodoroRounds: rounds.length,
          targetTotalMinutes: totalMin,
          splitStrategy: strategy,
          roundDurationsSec: rounds,
          workDurationSec: initialRoundDuration,
          targetDurationSec: totalMin * 60,
          targetEndTime: mode === 'stopwatch' ? null : now + initialRemaining * 1000,
          currentSegmentStartedAt: now,
          accumulatedWorkSeconds: 0,
          sessionStartedAt: now,
          secondsRemaining: initialRemaining,
          secondsElapsedTotal: 0,
          isModalOpen: true,
        });

        playChimeSound('work');
      },

      startQuickSession: (
        title,
        category,
        targetDurationMinutes = 25,
        strategy = '25m',
        mode = 'pomodoro'
      ) => {
        const totalMin = Math.max(1, targetDurationMinutes || 25);
        const { rounds } = calculatePomodoroPlan(totalMin, strategy);
        const initialRoundDuration = rounds[0] || 25 * 60;
        const initialRemaining = mode === 'pomodoro' ? initialRoundDuration : totalMin * 60;
        const now = Date.now();

        get().requestNotificationPermission();

        set({
          isActive: true,
          isRunning: true,
          todoId: null,
          taskTitle: title || 'Фокус сессия',
          category: category || 'work',
          mode,
          pomodoroPhase: 'work',
          pomodoroRound: 1,
          totalPomodoroRounds: rounds.length,
          targetTotalMinutes: totalMin,
          splitStrategy: strategy,
          roundDurationsSec: rounds,
          workDurationSec: initialRoundDuration,
          targetDurationSec: totalMin * 60,
          targetEndTime: mode === 'stopwatch' ? null : now + initialRemaining * 1000,
          currentSegmentStartedAt: now,
          accumulatedWorkSeconds: 0,
          sessionStartedAt: now,
          secondsRemaining: initialRemaining,
          secondsElapsedTotal: 0,
          isModalOpen: true,
        });

        playChimeSound('work');
      },

      setMode: (mode: TimerMode) => {
        const state = get();
        let initialRemaining = state.workDurationSec;
        if (mode === 'target_timer') initialRemaining = state.targetTotalMinutes * 60;
        if (mode === 'stopwatch') initialRemaining = 0;

        const now = Date.now();
        set({
          mode,
          pomodoroPhase: 'work',
          secondsRemaining: initialRemaining,
          targetEndTime: state.isRunning && mode !== 'stopwatch' ? now + initialRemaining * 1000 : null,
        });
      },

      setSplitStrategy: (strategy: SplitStrategy) => {
        const state = get();
        const { rounds } = calculatePomodoroPlan(state.targetTotalMinutes, strategy);
        const newTotalRounds = rounds.length;
        const currentRoundIdx = Math.min(state.pomodoroRound, newTotalRounds);
        const currentRoundSec = rounds[currentRoundIdx - 1] || rounds[0];

        const now = Date.now();
        const nextRemaining = state.pomodoroPhase === 'work' ? currentRoundSec : state.secondsRemaining;

        set({
          splitStrategy: strategy,
          roundDurationsSec: rounds,
          totalPomodoroRounds: newTotalRounds,
          pomodoroRound: currentRoundIdx,
          workDurationSec: currentRoundSec,
          secondsRemaining: nextRemaining,
          targetEndTime: state.isRunning && state.mode !== 'stopwatch' ? now + nextRemaining * 1000 : null,
        });
      },

      setTargetTotalMinutes: (minutes: number) => {
        const state = get();
        const totalMin = Math.max(1, minutes);
        const { rounds } = calculatePomodoroPlan(totalMin, state.splitStrategy);
        const newTotalRounds = rounds.length;
        const currentRoundIdx = 1;
        const currentRoundSec = rounds[0];

        const now = Date.now();
        const nextRemaining = state.mode === 'target_timer' ? totalMin * 60 : currentRoundSec;

        set({
          targetTotalMinutes: totalMin,
          targetDurationSec: totalMin * 60,
          roundDurationsSec: rounds,
          totalPomodoroRounds: newTotalRounds,
          pomodoroRound: currentRoundIdx,
          workDurationSec: currentRoundSec,
          secondsRemaining: nextRemaining,
          targetEndTime: state.isRunning && state.mode !== 'stopwatch' ? now + nextRemaining * 1000 : null,
        });
      },

      setWorkDurationMinutes: (minutes: number) => {
        const sec = Math.max(1, minutes) * 60;
        const state = get();
        set({ workDurationSec: sec });
        if (state.pomodoroPhase === 'work' && !state.isRunning) {
          set({ secondsRemaining: sec });
        }
      },

      setBreakDurationMinutes: (minutes: number) => {
        const sec = Math.max(1, minutes) * 60;
        const state = get();
        set({ shortBreakDurationSec: sec });
        if (state.pomodoroPhase === 'short_break' && !state.isRunning) {
          set({ secondsRemaining: sec });
        }
      },

      setLongBreakDurationMinutes: (minutes: number) => {
        const sec = Math.max(1, minutes) * 60;
        const state = get();
        set({ longBreakDurationSec: sec });
        if (state.pomodoroPhase === 'long_break' && !state.isRunning) {
          set({ secondsRemaining: sec });
        }
      },

      pause: () => {
        const state = get();
        if (!state.isRunning) return;

        const now = Date.now();
        let exactRemaining = state.secondsRemaining;
        if (state.targetEndTime && state.mode !== 'stopwatch') {
          exactRemaining = Math.max(0, Math.ceil((state.targetEndTime - now) / 1000));
        }

        const segmentElapsed = state.currentSegmentStartedAt
          ? Math.max(0, Math.round((now - state.currentSegmentStartedAt) / 1000))
          : 0;

        const isWorkSegment = state.mode === 'stopwatch' || state.mode === 'target_timer' || state.pomodoroPhase === 'work';
        const nextAccumulated = isWorkSegment ? state.accumulatedWorkSeconds + segmentElapsed : state.accumulatedWorkSeconds;

        set({
          isRunning: false,
          targetEndTime: null,
          currentSegmentStartedAt: null,
          secondsRemaining: exactRemaining,
          accumulatedWorkSeconds: nextAccumulated,
          secondsElapsedTotal: nextAccumulated,
        });
      },

      resume: () => {
        const state = get();
        if (state.isRunning) return;

        const now = Date.now();
        set({
          isRunning: true,
          currentSegmentStartedAt: now,
          targetEndTime: state.mode === 'stopwatch' ? null : now + state.secondsRemaining * 1000,
          sessionStartedAt: state.sessionStartedAt || now,
        });
      },

      syncTick: () => {
        const state = get();
        if (!state.isActive || !state.isRunning) return;

        const now = Date.now();
        const segmentElapsed = state.currentSegmentStartedAt
          ? Math.max(0, Math.round((now - state.currentSegmentStartedAt) / 1000))
          : 0;

        const isWorkSegment = state.mode === 'stopwatch' || state.mode === 'target_timer' || state.pomodoroPhase === 'work';
        const currentTotalElapsed = isWorkSegment
          ? state.accumulatedWorkSeconds + segmentElapsed
          : state.accumulatedWorkSeconds;

        if (state.mode === 'stopwatch') {
          set({
            secondsElapsedTotal: currentTotalElapsed,
          });
          return;
        }

        // Calculate accurate remaining seconds based on target timestamp
        let remaining = state.secondsRemaining - 1;
        if (state.targetEndTime) {
          remaining = Math.max(0, Math.ceil((state.targetEndTime - now) / 1000));
        }

        if (remaining > 0) {
          set({
            secondsRemaining: remaining,
            secondsElapsedTotal: currentTotalElapsed,
          });
          return;
        }

        // --- Active phase countdown reached ZERO! ---
        if (state.mode === 'target_timer') {
          playChimeSound('complete');
          sendBrowserNotification('Таймер завершен!', `Сессия «${state.taskTitle}» завершена.`);
          set({
            secondsRemaining: 0,
            secondsElapsedTotal: currentTotalElapsed,
            isRunning: false,
            targetEndTime: null,
            currentSegmentStartedAt: null,
            accumulatedWorkSeconds: currentTotalElapsed,
          });
          return;
        }

        // Pomodoro State Machine transitions
        if (state.pomodoroPhase === 'work') {
          // Check if this was the final work round!
          if (state.pomodoroRound >= state.totalPomodoroRounds) {
            playChimeSound('complete');
            sendBrowserNotification('Все помодоро завершены! 🎉', `Задача «${state.taskTitle}» выполнена на 100%.`);
            set({
              secondsRemaining: 0,
              secondsElapsedTotal: currentTotalElapsed,
              accumulatedWorkSeconds: currentTotalElapsed,
              isRunning: false,
              targetEndTime: null,
              currentSegmentStartedAt: null,
            });
            return;
          }

          // Move to break
          playChimeSound('break');
          sendBrowserNotification('Время отдохнуть!', `Помодоро #${state.pomodoroRound} завершен. Сделайте перерыв.`);
          const isLongBreak = state.pomodoroRound % 4 === 0;
          const nextPhase: PomodoroPhase = isLongBreak ? 'long_break' : 'short_break';
          const nextDuration = isLongBreak ? state.longBreakDurationSec : state.shortBreakDurationSec;

          set({
            pomodoroPhase: nextPhase,
            secondsRemaining: nextDuration,
            secondsElapsedTotal: currentTotalElapsed,
            accumulatedWorkSeconds: currentTotalElapsed,
            currentSegmentStartedAt: now,
            targetEndTime: now + nextDuration * 1000,
          });
        } else {
          // Break ended -> Next work round
          playChimeSound('work');
          const nextRound = state.pomodoroRound + 1;
          const nextRoundSec = state.roundDurationsSec[nextRound - 1] || state.workDurationSec;
          sendBrowserNotification('Время работать!', `Помодоро #${nextRound} из ${state.totalPomodoroRounds} начинается.`);

          set({
            pomodoroPhase: 'work',
            pomodoroRound: nextRound,
            workDurationSec: nextRoundSec,
            secondsRemaining: nextRoundSec,
            secondsElapsedTotal: currentTotalElapsed,
            currentSegmentStartedAt: now,
            targetEndTime: now + nextRoundSec * 1000,
          });
        }
      },

      tick: () => {
        get().syncTick();
      },

      skipPhase: () => {
        const state = get();
        if (state.mode !== 'pomodoro') return;

        const now = Date.now();
        const segmentElapsed = state.currentSegmentStartedAt
          ? Math.max(0, Math.round((now - state.currentSegmentStartedAt) / 1000))
          : 0;

        if (state.pomodoroPhase === 'work') {
          if (state.pomodoroRound >= state.totalPomodoroRounds) {
            playChimeSound('complete');
            set({
              secondsRemaining: 0,
              isRunning: false,
              targetEndTime: null,
              currentSegmentStartedAt: null,
            });
            return;
          }

          const isLong = state.pomodoroRound % 4 === 0;
          const nextPhase: PomodoroPhase = isLong ? 'long_break' : 'short_break';
          const nextDuration = isLong ? state.longBreakDurationSec : state.shortBreakDurationSec;
          const updatedAccumulated = state.accumulatedWorkSeconds + segmentElapsed;

          set({
            pomodoroPhase: nextPhase,
            secondsRemaining: nextDuration,
            accumulatedWorkSeconds: updatedAccumulated,
            secondsElapsedTotal: updatedAccumulated,
            currentSegmentStartedAt: state.isRunning ? now : null,
            targetEndTime: state.isRunning ? now + nextDuration * 1000 : null,
          });
        } else {
          const nextRound = Math.min(state.pomodoroRound + 1, state.totalPomodoroRounds);
          const nextRoundSec = state.roundDurationsSec[nextRound - 1] || state.workDurationSec;

          set({
            pomodoroPhase: 'work',
            pomodoroRound: nextRound,
            workDurationSec: nextRoundSec,
            secondsRemaining: nextRoundSec,
            currentSegmentStartedAt: state.isRunning ? now : null,
            targetEndTime: state.isRunning ? now + nextRoundSec * 1000 : null,
          });
        }
      },

      resetCurrentPhase: () => {
        const state = get();
        let dur = state.roundDurationsSec[state.pomodoroRound - 1] || state.workDurationSec;
        if (state.mode === 'pomodoro') {
          if (state.pomodoroPhase === 'short_break') dur = state.shortBreakDurationSec;
          if (state.pomodoroPhase === 'long_break') dur = state.longBreakDurationSec;
        } else if (state.mode === 'target_timer') {
          dur = state.targetTotalMinutes * 60;
        } else {
          dur = 0;
        }

        const now = Date.now();
        set({
          secondsRemaining: dur,
          currentSegmentStartedAt: state.isRunning ? now : null,
          targetEndTime: state.isRunning && state.mode !== 'stopwatch' ? now + dur * 1000 : null,
        });
      },

      stopAndLog: async (markCompleted = true, notes = '') => {
        const state = get();
        const now = Date.now();
        const segmentElapsed = state.isRunning && state.currentSegmentStartedAt
          ? Math.max(0, Math.round((now - state.currentSegmentStartedAt) / 1000))
          : 0;

        const isWorkSegment = state.mode === 'stopwatch' || state.mode === 'target_timer' || state.pomodoroPhase === 'work';
        const finalTotalSec = isWorkSegment
          ? state.accumulatedWorkSeconds + segmentElapsed
          : state.accumulatedWorkSeconds;

        const durationMins = Math.max(1, Math.round(finalTotalSec / 60));

        try {
          await apiClient.post('/todos/focus-sessions', {
            todo_id: state.todoId || undefined,
            task_title: state.taskTitle,
            category: state.category,
            duration_minutes: durationMins,
            session_type: state.mode,
            notes,
            mark_completed: markCompleted,
          });
        } catch (err) {
          console.warn('Failed logging focus session:', err);
        }

        playChimeSound('complete');
        set({
          isActive: false,
          isRunning: false,
          isModalOpen: false,
          todoId: null,
          targetEndTime: null,
          currentSegmentStartedAt: null,
          accumulatedWorkSeconds: 0,
          secondsRemaining: 0,
          secondsElapsedTotal: 0,
        });
      },

      discard: () => {
        set({
          isActive: false,
          isRunning: false,
          isModalOpen: false,
          todoId: null,
          targetEndTime: null,
          currentSegmentStartedAt: null,
          accumulatedWorkSeconds: 0,
          secondsRemaining: 0,
          secondsElapsedTotal: 0,
        });
      },

      openModal: () => set({ isModalOpen: true }),
      closeModal: () => set({ isModalOpen: false }),
    }),
    {
      name: 'np_focus_timer_state_v4',
      partialize: (state) => ({
        isActive: state.isActive,
        isRunning: state.isRunning,
        todoId: state.todoId,
        taskTitle: state.taskTitle,
        category: state.category,
        mode: state.mode,
        pomodoroPhase: state.pomodoroPhase,
        pomodoroRound: state.pomodoroRound,
        totalPomodoroRounds: state.totalPomodoroRounds,
        targetTotalMinutes: state.targetTotalMinutes,
        splitStrategy: state.splitStrategy,
        roundDurationsSec: state.roundDurationsSec,
        workDurationSec: state.workDurationSec,
        shortBreakDurationSec: state.shortBreakDurationSec,
        longBreakDurationSec: state.longBreakDurationSec,
        targetDurationSec: state.targetDurationSec,
        secondsRemaining: state.secondsRemaining,
        secondsElapsedTotal: state.secondsElapsedTotal,
        accumulatedWorkSeconds: state.accumulatedWorkSeconds,
        currentSegmentStartedAt: state.currentSegmentStartedAt,
        targetEndTime: state.targetEndTime,
      }),
    }
  )
);
