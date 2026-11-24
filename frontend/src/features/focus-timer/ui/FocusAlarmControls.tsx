import React, { useEffect, useState } from 'react';
import { BellRing, Play, Square, Volume2 } from 'lucide-react';
import {
  FocusAlarmPreset,
  getFocusAlarmPreset,
  isFocusAlarmRinging,
  previewFocusAlarmPreset,
  setFocusAlarmPreset,
  stopFocusAlarm,
  subscribeFocusAlarmRinging,
} from '../../../shared/lib/audio/soundEffects.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

const ALARM_PRESETS: Array<{ id: FocusAlarmPreset; labelKey: string }> = [
  { id: 'radar', labelKey: 'todo.presetRadar' },
  { id: 'bell', labelKey: 'todo.presetBell' },
  { id: 'gong', labelKey: 'todo.presetGong' },
  { id: 'siren', labelKey: 'todo.presetSiren' },
];

export function useFocusAlarmRingingState(): boolean {
  const [ringing, setRinging] = useState<boolean>(() => isFocusAlarmRinging());
  useEffect(() => {
    setRinging(isFocusAlarmRinging());
    return subscribeFocusAlarmRinging(setRinging);
  }, []);
  return ringing;
}

export const FocusAlarmStopBanner: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { t } = useTranslation();
  const ringing = useFocusAlarmRingingState();
  if (!ringing) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        stopFocusAlarm();
      }}
      className={`w-full rounded-[12px] bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-between gap-2 shadow-sm animate-pulse cursor-pointer ${
        compact ? 'px-3 py-2 text-[12px]' : 'min-h-[46px] px-4 py-2.5 text-[13px]'
      }`}
    >
      <span className="flex items-center gap-2 truncate">
        <BellRing className="w-4 h-4 shrink-0" />
        <span className="truncate">{t('todo.alarmRinging')}</span>
      </span>
      <span className="px-2.5 py-1 rounded-[8px] bg-white text-rose-600 font-extrabold text-[11px] shrink-0 flex items-center gap-1">
        <Square className="w-3 h-3 fill-current" />
        {t('todo.stopAlarm')}
      </span>
    </button>
  );
};

export const FocusAlarmControls: React.FC = () => {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<FocusAlarmPreset>(() => getFocusAlarmPreset());
  const ringing = useFocusAlarmRingingState();

  const handleSelectPreset = (next: FocusAlarmPreset) => {
    setPreset(next);
    setFocusAlarmPreset(next);
    previewFocusAlarmPreset(next);
  };

  return (
    <div className="w-full space-y-2 text-left">
      <FocusAlarmStopBanner />

      <div className="w-full rounded-[12px] bg-[var(--bg-well,#F8F7FC)] border border-[var(--border-subtle,#ECEAF6)] p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-[var(--text-secondary,#6B7280)] flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-[#7C3AED]" />
            {t('todo.soundPresetLabel')}
          </span>
          <button
            type="button"
            onClick={() => (ringing ? stopFocusAlarm() : previewFocusAlarmPreset(preset))}
            className={`px-2.5 py-1 rounded-[8px] text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
              ringing
                ? 'bg-rose-600 border-rose-600 text-white'
                : 'bg-[var(--bg-surface,#FFFFFF)] border-[var(--border-subtle,#DDD6FE)] text-[#7C3AED] hover:bg-[#F0EFFE]'
            }`}
          >
            {ringing ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>{t('todo.stopAlarm')}</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>{t('todo.testSound')}</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {ALARM_PRESETS.map((item) => {
            const active = preset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPreset(item.id)}
                className={`min-h-[34px] px-1.5 rounded-[8px] text-[11px] font-semibold border transition-colors truncate cursor-pointer ${
                  active
                    ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
                    : 'bg-[var(--bg-surface,#FFFFFF)] border-[var(--border-subtle,#ECEAF6)] text-[var(--text-secondary,#6B7280)] hover:text-[var(--text-primary,#1E1B4B)]'
                }`}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
