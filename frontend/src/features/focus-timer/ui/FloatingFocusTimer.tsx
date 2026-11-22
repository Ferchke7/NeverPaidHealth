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
  Layers,
} from 'lucide-react';
import { useFocusTimerStore, SplitStrategy } from '../model/focusTimerStore.ts';
import { useActiveWorkoutStore } from '../../../entities/workout/model/activeWorkoutStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

const BREAK_PRESET_MINUTES = [3, 5, 10, 15];

export const FloatingFocusTimer: React.FC = () => {
  const { t } = useTranslation();
  const hasFloatingWorkoutPill = useActiveWorkoutStore((s) => Boolean(s.workout && !s.isOpen));
  const {
    isActive,
    isRunning,
    taskTitle,
    category,
    mode,
    pomodoroPhase,
    pomodoroRound,
    totalPomodoroRounds,
    targetTotalMinutes,
    splitStrategy,
    roundDurationsSec,
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
    setSplitStrategy,
    setBreakDurationMinutes,
  } = useFocusTimerStore();

  const [notes, setNotes] = useState('');
  const [markCompleted, setMarkCompleted] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Sync tick interval + visibility/focus recovery for 0ms drift
  useEffect(() => {
    if (!isActive || !isRunning) return;

    const interval = setInterval(() => {
      syncTick();
    }, 1000);

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

  useEffect(() => {
    if (!isModalOpen) {
      setConfirmingDiscard(false);
    }
  }, [isModalOpen]);

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
    if (mode === 'stopwatch') return t('focusTimer.stopwatch');
    if (mode === 'target_timer') return t('focusTimer.targetTimer');
    if (pomodoroPhase === 'work') {
      return t('focusTimer.pomodoroRound', { round: pomodoroRound, total: totalPomodoroRounds });
    }
    if (pomodoroPhase === 'short_break') return t('focusTimer.shortBreak');
    return t('focusTimer.longBreak');
  };

  const getCurrentIntervalPercent = () => {
    if (mode === 'stopwatch') return 100;
    let totalSec = workDurationSec;
    if (pomodoroPhase === 'short_break') totalSec = shortBreakDurationSec;
    if (pomodoroPhase === 'long_break') totalSec = 15 * 60;
    if (totalSec <= 0) return 0;
    return Math.max(0, Math.min(100, ((totalSec - secondsRemaining) / totalSec) * 100));
  };

  const totalTargetSec = targetTotalMinutes * 60;
  const overallPercent =
    totalTargetSec > 0 ? Math.min(100, Math.round((secondsElapsedTotal / totalTargetSec) * 100)) : 0;

  const intervalPercent = getCurrentIntervalPercent();
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (intervalPercent / 100) * circumference;

  const handleFinishAndSave = async () => {
    setIsSubmitting(true);
    setSaveError(null);
    try {
      await stopAndLog(markCompleted, notes);
      setNotes('');
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : t('nutrition.saveError')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Minimized Floating Pill Widget
  if (!isModalOpen) {
    return (
      <div
        className={`fixed ${
          hasFloatingWorkoutPill ? 'bottom-36 lg:bottom-24' : 'bottom-20 lg:bottom-6'
        } right-3 sm:right-4 md:right-6 z-50 transition-all`}
      >
        <div
          onClick={openModal}
          className="cursor-pointer bg-white border border-[#DDD6FE] hover:border-[#6D28D9] royal-float-shadow rounded-[16px] p-2.5 sm:p-3 flex items-center gap-3 transition-colors"
        >
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-[12px] border flex items-center justify-center ${
                pomodoroPhase === 'work'
                  ? 'bg-[#F0EFFE] border-[#DDD6FE] text-[#6D28D9]'
                  : 'bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]'
              }`}
            >
              {pomodoroPhase === 'work' ? (
                <Flame className="w-4 h-4" />
              ) : (
                <Coffee className="w-4 h-4" />
              )}
            </div>
            {isRunning && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] absolute -top-0.5 -right-0.5 ring-2 ring-white" />
            )}
          </div>

          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-[#1E1B4B] truncate max-w-[130px] sm:max-w-[180px]">
                {taskTitle || t('focusTimer.session')}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[6px] bg-[#F8F7FC] border border-[#ECEAF6] text-[#6B7280]">
                {getPhaseName()}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="text-[14px] font-bold font-mono tabular-nums text-[#6D28D9]">
                {mode === 'stopwatch'
                  ? formatTime(secondsElapsedTotal)
                  : formatTime(secondsRemaining)}
              </div>
              <span className="text-[11px] text-[#6B7280] font-mono tabular-nums">
                ({Math.floor(secondsElapsedTotal / 60)}/{targetTotalMinutes}
                {t('common.minutes')})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-l border-[#ECEAF6] pl-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isRunning) pause();
                else resume();
              }}
              className="min-h-[44px] min-w-[44px] rounded-[12px] bg-[#F8F7FC] hover:bg-[#F0EFFE] border border-[#ECEAF6] text-[#1E1B4B] flex items-center justify-center transition-colors cursor-pointer"
              aria-label={isRunning ? t('focusTimer.pause') : t('focusTimer.start')}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openModal();
              }}
              className="min-h-[44px] min-w-[44px] rounded-[12px] violet-btn-gradient hover:opacity-95 text-white flex items-center justify-center transition-opacity cursor-pointer shadow-sm"
              aria-label={t('focusTimer.title')}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Focused Timer Overlay Modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070512]/65 backdrop-blur-md">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] w-full max-w-[400px] mx-auto rounded-[24px] p-5 sm:p-6 flex flex-col items-center text-center relative max-h-[90vh] overflow-y-auto space-y-3 royal-float-shadow">
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={closeModal}
            className="w-10 h-10 rounded-[12px] bg-[var(--bg-well)] hover:bg-[var(--bg-lilac)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
            title={t('focusTimer.minimize')}
            aria-label={t('focusTimer.minimize')}
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 rounded-full bg-[var(--bg-lilac)] border border-[var(--border-strong)] text-[#7C3AED] text-[12px] font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{getPhaseName()}</span>
          </span>

          <button
            type="button"
            onClick={() => setConfirmingDiscard((prev) => !prev)}
            className="w-10 h-10 rounded-[12px] bg-[var(--bg-well)] hover:bg-rose-500/10 border border-[var(--border-subtle)] hover:border-rose-400/40 text-[var(--text-secondary)] hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
            title={t('focusTimer.cancel')}
            aria-label={t('focusTimer.cancel')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inline Discard Confirmation Strip */}
        {confirmingDiscard && (
          <div className="w-full p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
            <span className="text-[12px] text-rose-500 font-medium">
              {t('focusTimer.confirmDiscard')}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmingDiscard(false)}
                className="min-h-[38px] px-3 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] font-medium cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDiscard(false);
                  discard();
                }}
                className="min-h-[38px] px-3 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-semibold cursor-pointer"
              >
                {t('focusTimer.confirmDiscardYes')}
              </button>
            </div>
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div className="w-full grid grid-cols-3 bg-[var(--bg-well)] p-1 rounded-[12px] border border-[var(--border-subtle)] text-[12px] font-medium gap-1">
          <button
            type="button"
            onClick={() => setMode('pomodoro')}
            className={`min-h-[40px] px-2 rounded-[10px] transition-colors cursor-pointer truncate ${
              mode === 'pomodoro'
                ? 'bg-[var(--bg-surface)] text-[#7C3AED] border border-[var(--border-strong)] font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t('focusTimer.modePomodoro')}
          </button>
          <button
            type="button"
            onClick={() => setMode('target_timer')}
            className={`min-h-[40px] px-2 rounded-[10px] transition-colors cursor-pointer truncate ${
              mode === 'target_timer'
                ? 'bg-[var(--bg-surface)] text-[#7C3AED] border border-[var(--border-strong)] font-semibold shadow-sm'
                : 'text-[#6B7280] hover:text-[#1E1B4B]'
            }`}
          >
            {t('focusTimer.modeTimer', { mins: targetTotalMinutes })}
          </button>
          <button
            type="button"
            onClick={() => setMode('stopwatch')}
            className={`min-h-[44px] px-2 rounded-[10px] transition-colors cursor-pointer truncate ${
              mode === 'stopwatch'
                ? 'bg-white text-[#6D28D9] border border-[#DDD6FE] font-semibold shadow-sm'
                : 'text-[#6B7280] hover:text-[#1E1B4B]'
            }`}
          >
            {t('focusTimer.modeStopwatch')}
          </button>
        </div>

        {/* Task Title & Target Details */}
        <div>
          <h2 className="text-[18px] font-bold text-[#1E1B4B] tracking-tight line-clamp-2">
            {taskTitle || t('focusTimer.session')}
          </h2>
          <div className="flex items-center gap-2 text-[12px] text-[#6B7280] mt-1 flex-wrap justify-center">
            <span>
              {t('focusTimer.category')}{' '}
              <strong className="text-[#1E1B4B] capitalize">{category}</strong>
            </span>
            <span className="text-[#DDD6FE]">·</span>
            <span>
              {t('focusTimer.dailyTarget')}{' '}
              <strong className="text-[#6D28D9] font-mono tabular-nums">
                {targetTotalMinutes} {t('common.minutes')}
              </strong>
            </span>
          </div>
        </div>

        {/* Pomodoro Split Strategy Selector */}
        {mode === 'pomodoro' && (
          <div className="w-full bg-[#F8F7FC] border border-[#ECEAF6] rounded-[12px] p-3 text-left space-y-2.5">
            <div className="flex items-center justify-between text-[12px] text-[#6B7280] font-medium">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#6D28D9]" />
                {t('focusTimer.splitRounds', { target: targetTotalMinutes })}
              </span>
              <span className="text-[#6D28D9] font-mono tabular-nums font-semibold">
                {t('focusTimer.roundsCount', { count: totalPomodoroRounds })}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: '25m', label: t('focusTimer.block25') },
                { id: '30m', label: t('focusTimer.block30') },
                { id: '50m', label: t('focusTimer.block50') },
                { id: 'single', label: t('focusTimer.blockSingle') },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSplitStrategy(opt.id as SplitStrategy)}
                  className={`min-h-[44px] px-2 rounded-[10px] text-[12px] font-semibold border transition-colors truncate cursor-pointer ${
                    splitStrategy === opt.id
                      ? 'bg-[#F0EFFE] border-[#DDD6FE] text-[#6D28D9]'
                      : 'bg-white border-[#ECEAF6] text-[#6B7280] hover:text-[#1E1B4B]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-[11px] font-mono tabular-nums">
              {roundDurationsSec.map((durSec, idx) => {
                const roundNum = idx + 1;
                const isCompleted = roundNum < pomodoroRound;
                const isCurrent = roundNum === pomodoroRound;
                const mins = Math.round(durSec / 60);

                return (
                  <React.Fragment key={idx}>
                    <div
                      className={`px-2 py-1 rounded-[6px] border flex items-center gap-1 shrink-0 font-semibold ${
                        isCompleted || isCurrent
                          ? 'bg-[#F0EFFE] border-[#DDD6FE] text-[#6D28D9]'
                          : 'bg-white border-[#ECEAF6] text-[#9CA3AF]'
                      }`}
                    >
                      {isCompleted ? '✓' : `#${roundNum}`} {mins}
                      {t('common.minutes')}
                    </div>
                    {idx < roundDurationsSec.length - 1 && (
                      <span className="text-[#9CA3AF] text-[11px]">
                        · 5{t('common.minutes')}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Circular SVG Timer Display */}
        <div className="relative my-1 flex items-center justify-center">
          <svg className="w-52 h-52 sm:w-56 sm:h-56 -rotate-90 transform" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r={radius}
              className="text-[#ECEAF6] stroke-current"
              strokeWidth="10"
              fill="transparent"
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              className="text-[#6D28D9] stroke-current transition-all duration-700 ease-out"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[40px] sm:text-[46px] font-bold font-mono tabular-nums tracking-tight text-[#1E1B4B]">
              {mode === 'stopwatch'
                ? formatTime(secondsElapsedTotal)
                : formatTime(secondsRemaining)}
            </div>

            <div className="text-[12px] text-[#6B7280] font-medium flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-[#10B981]' : 'bg-amber-500'
                }`}
              />
              <span>{isRunning ? t('focusTimer.inProgress') : t('focusTimer.onPause')}</span>
            </div>

            <div className="text-[11px] text-[#6B7280] mt-2 font-mono tabular-nums flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#6D28D9]" />
              <span>
                {t('focusTimer.accumulated')}{' '}
                <strong className="text-[#1E1B4B]">
                  {Math.floor(secondsElapsedTotal / 60)}
                </strong>{' '}
                / {targetTotalMinutes} {t('common.minutes')}
              </span>
            </div>
          </div>
        </div>

        {/* Total Progress Bar */}
        <div className="w-full bg-[#F8F7FC] border border-[#ECEAF6] rounded-[12px] p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[12px] text-[#6B7280]">
            <span>{t('focusTimer.totalProgress')}</span>
            <span className="font-semibold text-[#6D28D9] font-mono tabular-nums">
              {overallPercent}% ({Math.floor(secondsElapsedTotal / 60)}/{targetTotalMinutes}
              {t('common.minutes')})
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#ECEAF6] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#6D28D9] transition-all duration-300"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>

        {/* Break Duration Preset Selector */}
        {mode === 'pomodoro' && pomodoroPhase !== 'work' && (
          <div className="w-full bg-[#F8F7FC] border border-[#ECEAF6] rounded-[12px] p-3">
            <div className="flex items-center justify-between text-[12px] text-[#6B7280] font-medium mb-2">
              <span>{t('focusTimer.breakDuration')}</span>
              <span className="text-[#6D28D9] font-mono tabular-nums font-semibold">
                {Math.round(shortBreakDurationSec / 60)} {t('common.minutes')}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {BREAK_PRESET_MINUTES.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setBreakDurationMinutes(mins)}
                  className={`min-h-[44px] px-2 rounded-[10px] text-[12px] font-semibold border transition-colors cursor-pointer ${
                    Math.round(shortBreakDurationSec / 60) === mins
                      ? 'bg-[#F0EFFE] border-[#DDD6FE] text-[#6D28D9]'
                      : 'bg-white border-[#ECEAF6] text-[#6B7280] hover:text-[#1E1B4B]'
                  }`}
                >
                  {mins} {t('common.minutes')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Controls Grid */}
        <div className="grid grid-cols-3 gap-2.5 w-full">
          {mode === 'pomodoro' ? (
            <button
              type="button"
              onClick={skipPhase}
              className="min-h-[52px] px-2 rounded-[12px] bg-[#F8F7FC] hover:bg-[#F0EFFE] border border-[#ECEAF6] text-[#1E1B4B] font-semibold text-[12px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <FastForward className="w-4 h-4 text-[#6B7280]" />
              <span>{t('focusTimer.skip')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={resetCurrentPhase}
              className="min-h-[52px] px-2 rounded-[12px] bg-[#F8F7FC] hover:bg-[#F0EFFE] border border-[#ECEAF6] text-[#1E1B4B] font-semibold text-[12px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#6B7280]" />
              <span>{t('focusTimer.reset')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={isRunning ? pause : resume}
            className="min-h-[52px] px-2 rounded-[12px] violet-btn-gradient hover:opacity-95 text-white font-semibold text-[13px] flex flex-col items-center justify-center gap-1 transition-opacity cursor-pointer shadow-sm"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                <span>{t('focusTimer.pause')}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{t('focusTimer.start')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleFinishAndSave}
            disabled={isSubmitting}
            className="min-h-[52px] px-2 rounded-[12px] bg-[#ECFDF5] hover:bg-[#D1FAE5] border border-[#A7F3D0] text-[#059669] font-semibold text-[12px] flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t('focusTimer.done')}</span>
          </button>
        </div>

        {saveError && (
          <div className="w-full p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-[12px] rounded-[10px] text-center">
            {saveError}
          </div>
        )}

        {/* Notes & Mark Completed Checkbox */}
        <div className="w-full pt-3 border-t border-[#ECEAF6] text-left space-y-2.5">
          <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={markCompleted}
              onChange={(e) => setMarkCompleted(e.target.checked)}
              className="w-4 h-4 rounded accent-[#6D28D9]"
            />
            <span className="text-[12px] text-[#1E1B4B] font-medium">
              {t('focusTimer.markCompleted')}
            </span>
          </label>

          <input
            type="text"
            placeholder={t('focusTimer.notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full min-h-[44px] bg-[#F8F7FC] border border-[#ECEAF6] rounded-[12px] px-3.5 text-[13px] text-[#1E1B4B] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6D28D9]"
          />
        </div>
      </div>
    </div>
  );
};
