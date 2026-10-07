import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  X,
  Maximize2,
  Minimize2,
  FastForward,
  Flame,
  Coffee,
  Sparkles,
  Clock,
} from 'lucide-react';
import { useFocusTimerStore } from '../model/focusTimerStore.ts';
import { Badge } from '../../../shared/ui/card.tsx';

const POMODORO_PRESETS = [
  { label: '15м', value: 15 },
  { label: '25м', value: 25 },
  { label: '45м', value: 45 },
  { label: '50м', value: 50 },
];

const BREAK_PRESETS = [
  { label: '3м', value: 3 },
  { label: '5м', value: 5 },
  { label: '10м', value: 10 },
  { label: '15м', value: 15 },
];

export const FloatingFocusTimer: React.FC = () => {
  const {
    isActive,
    isRunning,
    taskTitle,
    category,
    mode,
    pomodoroPhase,
    pomodoroRound,
    totalPomodoroRounds,
    workDurationSec,
    shortBreakDurationSec,
    secondsRemaining,
    secondsElapsedTotal,
    isModalOpen,
    pause,
    resume,
    syncTick,
    skipPhase,
    resetCurrentPhase,
    stopAndLog,
    discard,
    openModal,
    closeModal,
    setMode,
    setWorkDurationMinutes,
    setBreakDurationMinutes,
  } = useFocusTimerStore();

  const [notes, setNotes] = useState('');
  const [markCompleted, setMarkCompleted] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync tick interval + visibility/focus recovery for 0ms drift
  useEffect(() => {
    if (!isActive || !isRunning) return;

    // 1. Regular 1s interval
    const interval = setInterval(() => {
      syncTick();
    }, 1000);

    // 2. Tab visibility & focus change handler (instant drift catchup)
    const handleVisibilityOrFocus = () => {
      syncTick();
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isActive, isRunning, syncTick]);

  if (!isActive) return null;

  const formatTime = (secs: number) => {
    const totalSecs = Math.max(0, Math.floor(secs));
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getPhaseName = () => {
    if (mode === 'stopwatch') return 'Секундомер';
    if (mode === 'target_timer') return 'Фокус-таймер';
    if (pomodoroPhase === 'work') return `Помодоро #${pomodoroRound}`;
    if (pomodoroPhase === 'short_break') return 'Перерыв';
    return 'Длинный отдых';
  };

  // Calculate percentage for circular progress
  const getProgressPercent = () => {
    if (mode === 'stopwatch') return 100;
    let totalSec = workDurationSec;
    if (pomodoroPhase === 'short_break') totalSec = shortBreakDurationSec;
    if (pomodoroPhase === 'long_break') totalSec = 15 * 60;
    if (totalSec <= 0) return 0;
    return Math.max(0, Math.min(100, ((totalSec - secondsRemaining) / totalSec) * 100));
  };

  const progressPercent = getProgressPercent();
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const handleFinishAndSave = async () => {
    setIsSubmitting(true);
    try {
      await stopAndLog(markCompleted, notes);
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Minimized Floating Pill Widget
  if (!isModalOpen) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 animate-in slide-in-from-bottom-5">
        <div
          onClick={openModal}
          className="cursor-pointer bg-dark-900/95 backdrop-blur-md border border-brand-500/40 shadow-2xl hover:border-brand-400 rounded-2xl p-2.5 sm:p-3 flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
        >
          <div className="relative">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs ${
                pomodoroPhase === 'work'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              }`}
            >
              {pomodoroPhase === 'work' ? (
                <Flame className="w-4 h-4 animate-pulse" />
              ) : (
                <Coffee className="w-4 h-4" />
              )}
            </div>
            {isRunning && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-dark-900 animate-ping" />
            )}
          </div>

          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-white truncate max-w-[130px] sm:max-w-[180px]">
                {taskTitle || 'Фокус сессия'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-dark-800 border border-dark-700 text-zinc-300">
                {getPhaseName()}
              </span>
            </div>
            <div className="text-sm font-black font-mono tracking-wider text-brand-400">
              {mode === 'stopwatch'
                ? formatTime(secondsElapsedTotal)
                : formatTime(secondsRemaining)}
            </div>
          </div>

          <div className="flex items-center gap-1 border-l border-dark-800 pl-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isRunning) pause();
                else resume();
              }}
              className="w-8 h-8 rounded-xl bg-dark-800 hover:bg-dark-700 text-white flex items-center justify-center transition-colors"
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                openModal();
              }}
              className="w-8 h-8 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 flex items-center justify-center transition-colors font-bold"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Fullscreen / Focused Timer Modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-dark-900 border border-dark-700 w-full max-w-md rounded-3xl p-5 sm:p-6 flex flex-col items-center text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between mb-3">
          <button
            onClick={closeModal}
            className="p-2 rounded-xl bg-dark-800/80 hover:bg-dark-700 text-zinc-400 hover:text-white transition-colors"
            title="Свернуть виджет"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          <Badge variant="warning" className="px-3 py-1 text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{getPhaseName()}</span>
          </Badge>

          <button
            onClick={() => {
              if (window.confirm('Сбросить и закрыть текущую сессию таймера?')) {
                discard();
              }
            }}
            className="p-2 rounded-xl bg-dark-800/80 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors"
            title="Отменить сессию"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-dark-950 p-1 rounded-2xl border border-dark-800 mb-3 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('pomodoro')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              mode === 'pomodoro'
                ? 'bg-brand-500 text-dark-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🍅 Помодоро
          </button>
          <button
            type="button"
            onClick={() => setMode('target_timer')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              mode === 'target_timer'
                ? 'bg-brand-500 text-dark-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ⏱ Таймер
          </button>
          <button
            type="button"
            onClick={() => setMode('stopwatch')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              mode === 'stopwatch'
                ? 'bg-brand-500 text-dark-950 font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ⏳ Секундомер
          </button>
        </div>

        {/* Task Title & Category */}
        <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight mb-0.5 line-clamp-2">
          {taskTitle || 'Фокус сессия'}
        </h2>
        <span className="text-xs text-zinc-400 capitalize mb-4">
          Категория: <strong className="text-zinc-200">{category}</strong>
        </span>

        {/* Circular SVG Timer Display */}
        <div className="relative my-2 flex items-center justify-center">
          <svg className="w-56 h-56 -rotate-90 transform" viewBox="0 0 200 200">
            {/* Background Track */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              className="text-dark-800 stroke-current"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Animated Progress Ring */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              className={`stroke-current transition-all duration-700 ease-out ${
                pomodoroPhase === 'work' ? 'text-brand-500' : 'text-emerald-400'
              }`}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Inner Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white mb-1">
              {mode === 'stopwatch'
                ? formatTime(secondsElapsedTotal)
                : formatTime(secondsRemaining)}
            </div>

            <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
              {isRunning ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Идет отсчет</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>На паузе</span>
                </>
              )}
            </div>

            <div className="text-[11px] text-zinc-500 mt-2 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Накоплено: {Math.floor(secondsElapsedTotal / 60)} мин</span>
            </div>
          </div>
        </div>

        {/* Pomodoro Rounds Indicator */}
        {mode === 'pomodoro' && (
          <div className="flex items-center gap-2 my-2">
            {Array.from({ length: totalPomodoroRounds }).map((_, i) => {
              const isCompleted = i + 1 < pomodoroRound;
              const isCurrent = i + 1 === pomodoroRound;
              return (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-brand-500 text-dark-950'
                      : isCurrent
                      ? 'bg-brand-500/20 border-2 border-brand-500 animate-pulse'
                      : 'bg-dark-800 border border-dark-700'
                  }`}
                  title={`Помодоро ${i + 1}`}
                />
              );
            })}
          </div>
        )}

        {/* Duration Adjustments (When in pomodoro mode) */}
        {mode === 'pomodoro' && (
          <div className="w-full bg-dark-950/60 border border-dark-800 rounded-2xl p-2.5 my-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold mb-1.5 px-1">
              <span>{pomodoroPhase === 'work' ? 'Длительность фокуса:' : 'Длительность отдыха:'}</span>
              <span className="text-brand-400">
                {pomodoroPhase === 'work'
                  ? `${Math.round(workDurationSec / 60)} мин`
                  : `${Math.round(shortBreakDurationSec / 60)} мин`}
              </span>
            </div>
            <div className="flex justify-center gap-1.5">
              {pomodoroPhase === 'work'
                ? POMODORO_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setWorkDurationMinutes(p.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        Math.round(workDurationSec / 60) === p.value
                          ? 'bg-brand-500/20 border-brand-500 text-brand-400'
                          : 'bg-dark-800 border-dark-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))
                : BREAK_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setBreakDurationMinutes(p.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        Math.round(shortBreakDurationSec / 60) === p.value
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-dark-800 border-dark-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
            </div>
          </div>
        )}

        {/* Action Controls Grid */}
        <div className="grid grid-cols-3 gap-2.5 w-full mt-3">
          {/* Reset / Skip */}
          {mode === 'pomodoro' ? (
            <button
              onClick={skipPhase}
              className="py-2.5 px-2 rounded-2xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-zinc-300 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
            >
              <FastForward className="w-4 h-4 text-zinc-400" />
              <span>Пропуск</span>
            </button>
          ) : (
            <button
              onClick={resetCurrentPhase}
              className="py-2.5 px-2 rounded-2xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-zinc-300 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4 text-zinc-400" />
              <span>Сброс</span>
            </button>
          )}

          {/* Main Play/Pause Button */}
          <button
            onClick={isRunning ? pause : resume}
            className={`py-2.5 px-2 rounded-2xl font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-1 shadow-lg transition-all active:scale-95 ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-dark-950 shadow-amber-500/20'
                : 'bg-brand-500 hover:bg-brand-400 text-dark-950 shadow-brand-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5" />
                <span>Пауза</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Старт</span>
              </>
            )}
          </button>

          {/* Finish & Save Log */}
          <button
            onClick={handleFinishAndSave}
            disabled={isSubmitting}
            className="py-2.5 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Готово</span>
          </button>
        </div>

        {/* Notes & Mark Completed Checkbox */}
        <div className="w-full mt-3 pt-3 border-t border-dark-800 text-left space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={markCompleted}
              onChange={(e) => setMarkCompleted(e.target.checked)}
              className="w-4 h-4 rounded text-brand-500 accent-brand-500"
            />
            <span className="text-xs text-zinc-300 font-medium">
              Отметить задачу выполненной при сохранении
            </span>
          </label>

          <input
            type="text"
            placeholder="Заметка к сессии (например: завершил черновик)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-dark-950 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>
    </div>
  );
};
