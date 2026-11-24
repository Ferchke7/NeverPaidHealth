/**
 * High-Fidelity Web Audio Sound Effects Engine for NeverPaidHealth.
 * Pure synthetic audio with zero external asset loading latency, offline-ready,
 * warm multi-oscillator harmonics, and gentle ADSR envelopes.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export type FocusAlarmPreset = 'radar' | 'bell' | 'gong' | 'siren';

const FOCUS_ALARM_PRESET_KEY = 'np_focus_sound_preset';

let masterCompressor: DynamicsCompressorNode | null = null;
let alarmRinging = false;
let alarmGeneration = 0;
let activeAlarmTimeouts: number[] = [];
let activeAlarmOscillators: OscillatorNode[] = [];
let activeAlarmMasterGain: GainNode | null = null;
const alarmRingingListeners = new Set<(ringing: boolean) => void>();

function notifyAlarmListeners(ringing: boolean) {
  alarmRinging = ringing;
  alarmRingingListeners.forEach((listener) => {
    try {
      listener(ringing);
    } catch {
      // ignore subscriber errors
    }
  });
}

function getMasterDestination(ctx: AudioContext): AudioNode {
  if (!masterCompressor || masterCompressor.context !== ctx) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-16, ctx.currentTime);
    comp.knee.setValueAtTime(12, ctx.currentTime);
    comp.ratio.setValueAtTime(6, ctx.currentTime);
    comp.attack.setValueAtTime(0.003, ctx.currentTime);
    comp.release.setValueAtTime(0.18, ctx.currentTime);
    comp.connect(ctx.destination);
    masterCompressor = comp;
  }
  return masterCompressor;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('np_sound_enabled') !== 'false';
}

export function getFocusAlarmPreset(): FocusAlarmPreset {
  if (typeof window === 'undefined') return 'radar';
  const raw = localStorage.getItem(FOCUS_ALARM_PRESET_KEY);
  if (raw === 'bell' || raw === 'gong' || raw === 'siren' || raw === 'radar') {
    return raw;
  }
  return 'radar';
}

export function setFocusAlarmPreset(preset: FocusAlarmPreset) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(FOCUS_ALARM_PRESET_KEY, preset);
  }
}

export function unlockAudioEngine() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // ignore autoplay unlock failures
  }
}

export function isFocusAlarmRinging(): boolean {
  return alarmRinging;
}

export function subscribeFocusAlarmRinging(listener: (ringing: boolean) => void): () => void {
  alarmRingingListeners.add(listener);
  return () => {
    alarmRingingListeners.delete(listener);
  };
}

export function stopFocusAlarm() {
  alarmGeneration += 1;
  activeAlarmTimeouts.forEach((id) => window.clearTimeout(id));
  activeAlarmTimeouts = [];

  activeAlarmOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {
      // ignore already stopped nodes
    }
  });
  activeAlarmOscillators = [];

  if (activeAlarmMasterGain) {
    try {
      activeAlarmMasterGain.disconnect();
    } catch {
      // ignore
    }
    activeAlarmMasterGain = null;
  }

  try {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate(0);
    }
  } catch {
    // ignore
  }

  if (alarmRinging) {
    notifyAlarmListeners(false);
  }
}

function triggerHaptic(pattern: number | number[]) {
  try {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

/**
 * Task checked / completed: Delightful, crisp marimba chime (F5 -> C6).
 */
export function playTaskCompleteSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 698.46, start: 0, dur: 0.28 }, // F5
    { freq: 1046.5, start: 0.08, dur: 0.38 }, // C6
  ];

  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + start);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now + start);

    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.22, now + start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + start);
    osc.stop(now + start + dur);
  });

  triggerHaptic([35]);
}

/**
 * Task unchecked: subtle, low-frequency soft wooden tap.
 */
export function playTaskUncheckSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

/**
 * Rest Timer Finished: Harmonic crystal singing bowl / zen chime (528Hz Solfeggio triad)
 * + Gentle vibration pattern for mobile pocket awareness.
 */
export function playRestCompleteSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const frequencies = [528, 792, 1056]; // Fundamental, fifth, octave

  frequencies.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = idx === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, now);

    const initialGain = idx === 0 ? 0.28 : 0.12;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(initialGain, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.85);
  });

  triggerHaptic([180, 80, 200]);
}

/**
 * Countdown warning tick (for 3, 2, 1 seconds before rest ends).
 */
export function playCountdownTickSound(isFinal = false) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(isFinal ? 880 : 587.33, now);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.055);

  triggerHaptic([20]);
}

/**
 * Athletic Set Completed / PR Logged: Punchy, triumphant tone.
 */
export function playSetCompleteSound() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 440, start: 0, dur: 0.22 }, // A4
    { freq: 659.25, start: 0.07, dur: 0.35 }, // E5
  ];

  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + start);

    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.2, now + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + start);
    osc.stop(now + start + dur);
  });

  triggerHaptic([45]);
}

/**
 * Crisp short confirmation tone when starting a Focus timer session.
 */
export function playFocusStartCue() {
  unlockAudioEngine();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const dest = getMasterDestination(ctx);
  [
    { f: 587.33, t: 0, d: 0.25 },
    { f: 880, t: 0.09, d: 0.38 },
  ].forEach(({ f, t, d }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now + t);
    gain.gain.setValueAtTime(0, now + t);
    gain.gain.linearRampToValueAtTime(0.45, now + t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now + t);
    osc.stop(now + t + d + 0.02);
  });
  triggerHaptic([45]);
}

function scheduleAlarmPulse(
  ctx: AudioContext,
  masterGain: GainNode,
  preset: FocusAlarmPreset,
  phase: 'work' | 'break' | 'complete',
  gen: number
) {
  if (gen !== alarmGeneration) return;
  const now = ctx.currentTime;

  const registerOsc = (
    type: OscillatorType,
    freq: number,
    startOffset: number,
    dur: number,
    peakGain: number,
    filterCutoff = 5000,
    freqEnd?: number
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    if (freqEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(freqEnd, now + startOffset + dur * 0.85);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, now + startOffset);

    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.linearRampToValueAtTime(peakGain, now + startOffset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now + startOffset);
    osc.stop(now + startOffset + dur + 0.02);
    activeAlarmOscillators.push(osc);
    osc.onended = () => {
      activeAlarmOscillators = activeAlarmOscillators.filter((o) => o !== osc);
    };
  };

  if (preset === 'radar') {
    const base = phase === 'break' ? [783.99, 987.77, 783.99, 1046.5] : [987.77, 1318.51, 987.77, 1479.98];
    base.forEach((f, idx) => {
      const start = idx * 0.14;
      registerOsc('triangle', f, start, 0.12, 0.72, 6000);
      registerOsc('sine', f * 2, start, 0.1, 0.25, 6500);
    });
  } else if (preset === 'bell') {
    const notes = phase === 'break' ? [659.25, 987.77, 1318.51] : [880, 1318.51, 1760, 2637.02];
    notes.forEach((f, idx) => {
      registerOsc(idx % 2 === 0 ? 'triangle' : 'sine', f, 0, 1.05, idx === 0 ? 0.68 : 0.34, 5200);
    });
    registerOsc('triangle', phase === 'break' ? 783.99 : 1174.66, 0.32, 0.8, 0.45, 5200);
  } else if (preset === 'gong') {
    const partials = phase === 'break' ? [261.63, 392.0, 523.25, 783.99] : [293.66, 440, 587.33, 880, 1318.51];
    partials.forEach((f, idx) => {
      registerOsc(idx === 0 ? 'sawtooth' : 'triangle', f, 0, 1.35, idx === 0 ? 0.55 : 0.28, 2600);
    });
  } else {
    // siren
    const low = phase === 'break' ? 660 : 784;
    const high = phase === 'break' ? 880 : 1174.66;
    registerOsc('sawtooth', low, 0, 0.38, 0.55, 3600, high);
    registerOsc('sawtooth', high, 0.4, 0.38, 0.55, 3600, low);
  }
}

/**
 * High-volume sustained TODO / Focus Timer alarm (6-10s with instant Stop support).
 */
export function playFocusChimeSound(
  type: 'work' | 'break' | 'complete',
  options?: { preset?: FocusAlarmPreset; durationMs?: number; ignoreMute?: boolean }
) {
  unlockAudioEngine();
  if (!options?.ignoreMute && !isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  stopFocusAlarm();
  const gen = ++alarmGeneration;
  const preset = options?.preset ?? getFocusAlarmPreset();
  const durationMs = options?.durationMs ?? 8200;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.95, ctx.currentTime);
  masterGain.connect(getMasterDestination(ctx));
  activeAlarmMasterGain = masterGain;

  const cadenceMs = preset === 'gong' ? 1450 : preset === 'bell' ? 1150 : preset === 'siren' ? 880 : 950;
  notifyAlarmListeners(true);

  const cycleCount = Math.max(1, Math.ceil(durationMs / cadenceMs));
  for (let i = 0; i < cycleCount; i++) {
    const delayMs = i * cadenceMs;
    if (delayMs >= durationMs - 200) break;
    if (delayMs === 0) {
      scheduleAlarmPulse(ctx, masterGain, preset, type, gen);
    } else {
      const tid = window.setTimeout(() => {
        if (gen !== alarmGeneration) return;
        scheduleAlarmPulse(ctx, masterGain, preset, type, gen);
      }, delayMs);
      activeAlarmTimeouts.push(tid);
    }
  }

  triggerHaptic([350, 140, 350, 140, 450]);

  const endTimeout = window.setTimeout(() => {
    if (gen === alarmGeneration) {
      stopFocusAlarm();
    }
  }, durationMs);
  activeAlarmTimeouts.push(endTimeout);
}

export function previewFocusAlarmPreset(preset: FocusAlarmPreset) {
  playFocusChimeSound('complete', {
    preset,
    durationMs: 2600,
    ignoreMute: true,
  });
}
