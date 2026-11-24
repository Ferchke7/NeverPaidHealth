import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getFocusAlarmPreset,
  isFocusAlarmRinging,
  playFocusChimeSound,
  setFocusAlarmPreset,
  stopFocusAlarm,
  subscribeFocusAlarmRinging,
} from './soundEffects.ts';

function createFakeAudioContext() {
  const mkParam = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createBuffer: vi.fn(() => ({})),
    createBufferSource: vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn() })),
    createDynamicsCompressor: vi.fn(() => ({
      threshold: mkParam(),
      knee: mkParam(),
      ratio: mkParam(),
      attack: mkParam(),
      release: mkParam(),
      connect: vi.fn(),
    })),
    createGain: vi.fn(() => ({ gain: mkParam(), connect: vi.fn(), disconnect: vi.fn() })),
    createBiquadFilter: vi.fn(() => ({ type: 'lowpass', frequency: mkParam(), connect: vi.fn() })),
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: mkParam(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    })),
  };
}

describe('soundEffects Focus Alarm engine', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    Object.keys(store).forEach((k) => delete store[k]);
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    };
    const fakeCtx = createFakeAudioContext();
    (globalThis as unknown as { window: unknown }).window = {
      AudioContext: function () {
        return fakeCtx;
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    };
  });

  afterEach(() => {
    stopFocusAlarm();
    vi.useRealTimers();
  });

  it('persists and restores chosen focus alarm presets', () => {
    expect(getFocusAlarmPreset()).toBe('radar');
    setFocusAlarmPreset('gong');
    expect(getFocusAlarmPreset()).toBe('gong');
    setFocusAlarmPreset('siren');
    expect(getFocusAlarmPreset()).toBe('siren');
  });

  it('rings for sustained duration and supports immediate stopFocusAlarm', () => {
    const events: boolean[] = [];
    const unsubscribe = subscribeFocusAlarmRinging((val) => events.push(val));

    playFocusChimeSound('complete', { preset: 'bell', durationMs: 8000 });
    expect(isFocusAlarmRinging()).toBe(true);

    vi.advanceTimersByTime(4000);
    expect(isFocusAlarmRinging()).toBe(true);

    stopFocusAlarm();
    expect(isFocusAlarmRinging()).toBe(false);
    expect(events).toEqual([true, false]);

    // Auto-stop after full 8s also notifies subscribers
    playFocusChimeSound('break', { preset: 'siren', durationMs: 8000 });
    expect(isFocusAlarmRinging()).toBe(true);
    vi.advanceTimersByTime(8100);
    expect(isFocusAlarmRinging()).toBe(false);
    unsubscribe();
  });
});
