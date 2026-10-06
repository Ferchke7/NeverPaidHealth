import { create } from 'zustand';

interface RestTimerState {
  isActive: boolean;
  targetEndTime: number | null;
  totalDurationSeconds: number;
  startTimer: (seconds?: number) => void;
  stopTimer: () => void;
  addSeconds: (seconds: number) => void;
  getRemainingSeconds: () => number;
}

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  isActive: false,
  targetEndTime: null,
  totalDurationSeconds: 90,

  startTimer: (seconds = 90) => {
    const target = Date.now() + seconds * 1000;
    set({
      isActive: true,
      targetEndTime: target,
      totalDurationSeconds: seconds,
    });
  },

  stopTimer: () => {
    set({ isActive: false, targetEndTime: null });
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
      return 0;
    }
    return diff;
  },
}));
