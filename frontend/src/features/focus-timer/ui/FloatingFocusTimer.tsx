import React, { useEffect } from 'react';
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
} from 'lucide-react';
import { useFocusTimerStore } from '../model/focusTimerStore.ts';

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
    secondsRemaining,
    secondsElapsedTotal,
    isModalOpen,
    pause,
    resume,
    tick,
    skipPhase,
    stopAndLog,
    discard,
    openModal,
    closeModal,
  } = useFocusTimerStore();

  // Active timer interval tick
  useEffect(() => {
    if (!isActive || !isRunning) return;

    const interval = setInterval(() => {
      tick();
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isRunning, tick]);

  if (!isActive) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getPhaseName = () => {
    if (mode === 'stopwatch') return 'Секундомер';
    if (mode === 'target_timer') return 'Фокус-таймер';
    if (pomodoroPhase === 'work') return `🍅 Помодоро #${pomodoroRound}`;
    if (pomodoroPhase === 'short_break') return '☕ Короткий перерыв';
    return '🌴 Длинный отдых';
  };

  const getPhaseColor = () => {
    if (pomodoroPhase === 'short_break' || pomodoroPhase === 'long_break') {
      return 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400';
    }
    return 'from-brand-500/20 to-amber-500/20 border-brand-500/40 text-brand-400';
  };

  // 1. Minimized Floating Pill Bar (when modal is closed)
  if (!isModalOpen) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 animate-in slide-in-from-bottom-5">
        <div
          onClick={openModal}
          className="cursor-pointer bg-dark-900/95 backdrop-blur-md border border-brand-500/40 shadow-2xl hover:border-brand-400 rounded-2xl p-2.5 sm:p-3 flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
        >
          <div className="relative">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${getPhaseColor()} border flex items-center justify-center font-bold text-xs`}
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
              <span className="text-xs font-extrabold text-white truncate max-w-[140px] sm:max-w-[200px]">
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
      <div className="bg-dark-900 border border-dark-700 w-full max-w-md rounded-3xl p-5 sm:p-6 flex flex-col items-center text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95">
        {/* Top Controls */}
        <div className="w-full flex items-center justify-between mb-4">
          <button
            onClick={closeModal}
            className="p-2 rounded-xl bg-dark-800/80 hover:bg-dark-700 text-zinc-400 hover:text-white transition-colors"
            title="Свернуть в плавающий виджет"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          <div className="px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-400 text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{getPhaseName()}</span>
          </div>

          <button
            onClick={() => {
              if (window.confirm('Сбросить текущую сессию таймера?')) {
                discard();
              }
            }}
            className="p-2 rounded-xl bg-dark-800/80 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors"
            title="Отменить сессию"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task Title */}
        <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight mb-1 line-clamp-2">
          {taskTitle || 'Фокус сессия'}
        </h2>
        <span className="text-xs text-zinc-400 capitalize mb-6">
          Категория: <strong className="text-zinc-200">{category}</strong>
        </span>

        {/* Circular / Large Timer Display */}
        <div className="relative my-2 flex items-center justify-center">
          <div
            className={`w-52 h-52 sm:w-60 sm:h-60 rounded-full border-4 flex flex-col items-center justify-center bg-dark-950/80 shadow-2xl transition-all ${
              pomodoroPhase === 'work'
                ? isRunning
                  ? 'border-brand-500 ring-8 ring-brand-500/10'
                  : 'border-zinc-700'
                : 'border-emerald-500 ring-8 ring-emerald-500/10'
            }`}
          >
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white mb-1">
              {mode === 'stopwatch'
                ? formatTime(secondsElapsedTotal)
                : formatTime(secondsRemaining)}
            </div>

            <div className="text-xs text-zinc-400 font-medium">
              {isRunning ? '⏱ Идет отсчет' : '⏸ На паузе'}
            </div>

            <div className="text-[11px] text-zinc-500 mt-2 font-mono">
              Накоплено: {Math.floor(secondsElapsedTotal / 60)} мин
            </div>
          </div>
        </div>

        {/* Pomodoro Rounds Dots */}
        {mode === 'pomodoro' && (
          <div className="flex items-center gap-2 my-4">
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

        {/* Main Action Buttons */}
        <div className="grid grid-cols-3 gap-3 w-full mt-4">
          {/* Skip Phase */}
          {mode === 'pomodoro' ? (
            <button
              onClick={skipPhase}
              className="py-3 px-2 rounded-2xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-zinc-300 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
            >
              <FastForward className="w-4 h-4 text-zinc-400" />
              <span>Пропуск</span>
            </button>
          ) : (
            <button
              onClick={discard}
              className="py-3 px-2 rounded-2xl bg-dark-800 hover:bg-dark-750 border border-dark-700 text-zinc-300 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4 text-zinc-400" />
              <span>Сброс</span>
            </button>
          )}

          {/* Pause / Resume Button */}
          <button
            onClick={isRunning ? pause : resume}
            className={`py-3 px-2 rounded-2xl font-black text-sm flex flex-col items-center justify-center gap-1 shadow-lg transition-all active:scale-95 ${
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
            onClick={() => stopAndLog(true)}
            className="py-3 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Готово</span>
          </button>
        </div>
      </div>
    </div>
  );
};
