import { create } from 'zustand';
import {
  playRestCompleteSound,
  playCountdownTickSound,
} from '../../../shared/lib/audio/soundEffects.ts';

interface RestTimerState {
  isActive: boolean;
  targetEndTime: number | null;
  totalDurationSeconds: number;
  lastTickedSecond: number | null;
  startTimer: (seconds?: number) => void;
  stopTimer: () => void;
  addSeconds: (seconds: number) => void;
  getRemainingSeconds: () => number;
}

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  isActive: false,
  targetEndTime: null,
  totalDurationSeconds: 90,
  lastTickedSecond: null,

  startTimer: (seconds = 90) => {
    const target = Date.now() + seconds * 1000;
    set({
      isActive: true,
      targetEndTime: target,
      totalDurationSeconds: seconds,
      lastTickedSecond: null,
    });
  },

  stopTimer: () => {
    set({ isActive: false, targetEndTime: null, lastTickedSecond: null });
  },

  addSeconds: (seconds) => {
    const state = get();
    if (!state.isActive || !state.targetEndTime) return;
    const newTarget = state.targetEndTime + seconds * 1000;
    set({ targetEndTime: newTarget });
  },

  getRemainingSeconds: () => {
    const state = get();
    if (!state.isActive || !state.targetEndTime) return 0;
    const diff = Math.ceil((state.targetEndTime - Date.now()) / 1000);

    if (diff <= 0) {
      get().stopTimer();
      playRestCompleteSound();
      return 0;
    }

    // Play subtle countdown ticks on 3, 2, 1 seconds
    if (diff <= 3 && diff >= 1 && state.lastTickedSecond !== diff) {
      set({ lastTickedSecond: diff });
      playCountdownTickSound(diff === 1);
    }

    return diff;
  },
}));
