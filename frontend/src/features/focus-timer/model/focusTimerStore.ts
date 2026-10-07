import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../../../shared/api/client.ts';
import { TodoCategory } from '../../../entities/todo/model/types.ts';

export type TimerMode = 'pomodoro' | 'target_timer' | 'stopwatch';
export type PomodoroPhase = 'work' | 'short_break' | 'long_break';

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

  workDurationSec: number;       // default 25 * 60 = 1500
  shortBreakDurationSec: number; // default 5 * 60 = 300
  longBreakDurationSec: number;  // default 15 * 60 = 900
  targetDurationSec: number;     // for target_timer mode

  secondsRemaining: number;
  secondsElapsedTotal: number;

  isModalOpen: boolean;

  // Actions
  startForTodo: (params: {
    todoId: string;
    title: string;
    category: TodoCategory;
    targetDurationMinutes?: number;
    mode?: TimerMode;
  }) => void;
  startQuickSession: (title: string, category: TodoCategory, mode?: TimerMode) => void;
  pause: () => void;
  resume: () => void;
  tick: () => void;
  skipPhase: () => void;
  stopAndLog: (markCompleted?: boolean, notes?: string) => Promise<void>;
  discard: () => void;
  openModal: () => void;
  closeModal: () => void;
}

// Simple Web Audio API sound alert
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
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3); // A5
    } else if (type === 'break') {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.3);
    } else {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.3); // G5
    }

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch {
    // AudioContext blocked or not supported
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
      totalPomodoroRounds: 4,

      workDurationSec: 25 * 60,
      shortBreakDurationSec: 5 * 60,
      longBreakDurationSec: 15 * 60,
      targetDurationSec: 25 * 60,

      secondsRemaining: 25 * 60,
      secondsElapsedTotal: 0,
      isModalOpen: false,

      startForTodo: ({ todoId, title, category, targetDurationMinutes = 25, mode = 'pomodoro' }) => {
        const targetSec = Math.max(1, targetDurationMinutes) * 60;
        const initialRemaining = mode === 'pomodoro' ? 25 * 60 : targetSec;

        set({
          isActive: true,
          isRunning: true,
          todoId,
          taskTitle: title,
          category,
          mode,
          pomodoroPhase: 'work',
          pomodoroRound: 1,
          targetDurationSec: targetSec,
          secondsRemaining: initialRemaining,
          secondsElapsedTotal: 0,
          isModalOpen: true,
        });

        playChimeSound('work');
      },

      startQuickSession: (title, category, mode = 'pomodoro') => {
        set({
          isActive: true,
          isRunning: true,
          todoId: null,
          taskTitle: title || 'Фокус сессия',
          category: category || 'work',
          mode,
          pomodoroPhase: 'work',
          pomodoroRound: 1,
          targetDurationSec: 25 * 60,
          secondsRemaining: 25 * 60,
          secondsElapsedTotal: 0,
          isModalOpen: true,
        });

        playChimeSound('work');
      },

      pause: () => set({ isRunning: false }),
      resume: () => set({ isRunning: true }),

      tick: () => {
        const state = get();
        if (!state.isActive || !state.isRunning) return;

        if (state.mode === 'stopwatch') {
          set({
            secondsElapsedTotal: state.secondsElapsedTotal + 1,
          });
          return;
        }

        // Countdown or Pomodoro
        const nextRemaining = state.secondsRemaining - 1;
        const nextElapsedTotal =
          state.pomodoroPhase === 'work' || state.mode === 'target_timer'
            ? state.secondsElapsedTotal + 1
            : state.secondsElapsedTotal;

        if (nextRemaining > 0) {
          set({
            secondsRemaining: nextRemaining,
            secondsElapsedTotal: nextElapsedTotal,
          });
          return;
        }

        // Phase finished!
        if (state.mode === 'target_timer') {
          playChimeSound('complete');
          set({
            secondsRemaining: 0,
            secondsElapsedTotal: nextElapsedTotal,
            isRunning: false,
          });
          return;
        }

        // Pomodoro state machine
        if (state.pomodoroPhase === 'work') {
          playChimeSound('break');
          const isLongBreak = state.pomodoroRound >= state.totalPomodoroRounds;
          const nextPhase: PomodoroPhase = isLongBreak ? 'long_break' : 'short_break';
          const nextDuration = isLongBreak ? state.longBreakDurationSec : state.shortBreakDurationSec;

          set({
            pomodoroPhase: nextPhase,
            secondsRemaining: nextDuration,
            secondsElapsedTotal: nextElapsedTotal,
          });
        } else {
          // Break finished -> Next work round
          playChimeSound('work');
          const nextRound = state.pomodoroPhase === 'long_break' ? 1 : state.pomodoroRound + 1;
          set({
            pomodoroPhase: 'work',
            pomodoroRound: nextRound,
            secondsRemaining: state.workDurationSec,
            secondsElapsedTotal: nextElapsedTotal,
          });
        }
      },

      skipPhase: () => {
        const state = get();
        if (state.mode !== 'pomodoro') return;

        if (state.pomodoroPhase === 'work') {
          const isLong = state.pomodoroRound >= state.totalPomodoroRounds;
          set({
            pomodoroPhase: isLong ? 'long_break' : 'short_break',
            secondsRemaining: isLong ? state.longBreakDurationSec : state.shortBreakDurationSec,
          });
        } else {
          const nextRound = state.pomodoroPhase === 'long_break' ? 1 : state.pomodoroRound + 1;
          set({
            pomodoroPhase: 'work',
            pomodoroRound: nextRound,
            secondsRemaining: state.workDurationSec,
          });
        }
      },

      stopAndLog: async (markCompleted = true, notes = '') => {
        const state = get();
        const durationMins = Math.max(1, Math.round(state.secondsElapsedTotal / 60));

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
          secondsRemaining: 0,
          secondsElapsedTotal: 0,
        });
      },

      openModal: () => set({ isModalOpen: true }),
      closeModal: () => set({ isModalOpen: false }),
    }),
    {
      name: 'np_focus_timer_state_v1',
      partialize: (state) => ({
        isActive: state.isActive,
        isRunning: state.isRunning,
        todoId: state.todoId,
        taskTitle: state.taskTitle,
        category: state.category,
        mode: state.mode,
        pomodoroPhase: state.pomodoroPhase,
        pomodoroRound: state.pomodoroRound,
        secondsRemaining: state.secondsRemaining,
        secondsElapsedTotal: state.secondsElapsedTotal,
      }),
    }
  )
);
