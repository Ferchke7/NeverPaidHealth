import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Video,
  Check,
  AlertTriangle,
  Sparkles,
  ListTodo,
} from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { Input, Textarea } from '../../../shared/ui/input.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import {
  TodoItem,
  TodoCategory,
  TodoPriority,
} from '../../../entities/todo/model/types.ts';

interface CreateTodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    category: TodoCategory;
    priority: TodoPriority;
    start_date: string;
    end_date: string;
    start_time?: string;
    end_time?: string;
    target_duration_minutes: number;
    meeting_url?: string;
  }) => void;
  initialTodo?: TodoItem | null;
  defaultDate?: string;
  existingTodos?: TodoItem[];
}

const CATEGORIES: { id: TodoCategory; color: string }[] = [
  { id: 'work', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { id: 'workout', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'study', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { id: 'health', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { id: 'meeting', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  { id: 'personal', color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
];

const PRESET_DURATIONS = [
  { label: '15m', value: 15 },
  { label: '25m (🍅)', value: 25 },
  { label: '45m', value: 45 },
  { label: '60m (1h)', value: 60 },
  { label: '90m (1.5h)', value: 90 },
  { label: '120m (2h)', value: 120 },
];

export const CreateTodoModal: React.FC<CreateTodoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialTodo,
  defaultDate,
  existingTodos = [],
}) => {
  const { t } = useTranslation();
  const today = defaultDate || new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TodoCategory>('work');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [targetDuration, setTargetDuration] = useState(25);
  const [meetingUrl, setMeetingUrl] = useState('');

  useEffect(() => {
    if (initialTodo) {
      setTitle(initialTodo.title);
      setDescription(initialTodo.description || '');
      setCategory(initialTodo.category);
      setPriority(initialTodo.priority);
      setStartDate(initialTodo.start_date);
      setEndDate(initialTodo.end_date);
      setStartTime(initialTodo.start_time || '');
      setEndTime(initialTodo.end_time || '');
      setTargetDuration(initialTodo.target_duration_minutes || 25);
      setMeetingUrl(initialTodo.meeting_url || '');
    } else {
      setTitle('');
      setDescription('');
      setCategory('work');
      setPriority('medium');
      setStartDate(today);
      setEndDate(today);
      setStartTime('');
      setEndTime('');
      setTargetDuration(25);
      setMeetingUrl('');
    }
  }, [initialTodo, isOpen, today]);

  const parseTimeToMin = (t?: string | null): number | null => {
    if (!t) return null;
    const parts = t.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  const formatMinToTime = (min: number): string => {
    const total = ((min % 1440) + 1440) % 1440;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const conflict = useMemo(() => {
    const currentStartMin = parseTimeToMin(startTime);
    if (currentStartMin === null) return null;

    let currentEndMin = parseTimeToMin(endTime);
    if (currentEndMin === null || currentEndMin <= currentStartMin) {
      currentEndMin = currentStartMin + (Number(targetDuration) || 25);
    }

    const filtered = (existingTodos || []).filter((t) => {
      if (initialTodo && t.id === initialTodo.id) return false;
      const targetDay = startDate || today;
      const matchDay = (!t.start_date && !startDate) || (t.start_date <= targetDay && t.end_date >= targetDay);
      return matchDay && Boolean(t.start_time);
    });

    for (const other of filtered) {
      const otherStart = parseTimeToMin(other.start_time);
      if (otherStart === null) continue;

      let otherEnd = parseTimeToMin(other.end_time);
      if (otherEnd === null || otherEnd <= otherStart) {
        otherEnd = otherStart + (other.target_duration_minutes || 30);
      }

      if (currentStartMin < otherEnd && currentEndMin > otherStart) {
        return {
          conflictingTodo: other,
          conflictRange: `${other.start_time || '00:00'} – ${other.end_time || formatMinToTime(otherEnd)}`,
          suggestedNextStartMin: otherEnd,
          suggestedNextStartTime: formatMinToTime(otherEnd),
        };
      }
    }

    return null;
  }, [startTime, endTime, targetDuration, startDate, today, existingTodos, initialTodo]);

  const handleApplySuggestedTime = () => {
    if (!conflict) return;
    setStartTime(conflict.suggestedNextStartTime);
    const dur = Number(targetDuration) || 25;
    setEndTime(formatMinToTime(conflict.suggestedNextStartMin + dur));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      start_date: startDate || today,
      end_date: endDate || startDate || today,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      target_duration_minutes: Number(targetDuration) || 25,
      meeting_url: meetingUrl.trim() || undefined,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon={
        <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0">
          <ListTodo className="w-4 h-4" />
        </div>
      }
      title={initialTodo ? t('todo.modalTitleEdit') : t('todo.modalTitleNew')}
      subtitle={t('todo.modalSubtitle')}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="font-bold shadow-lg shadow-brand-500/20"
          >
            {initialTodo ? t('todo.saveChanges') : t('todo.createTask')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <Input
          label={t('todo.titleInput')}
          placeholder={t('todo.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        {/* Category Selector */}
        <div>
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
            {t('todo.categoryLabel')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    if (cat.id === 'meeting' && !title) {
                      setTitle('Google Meet Call');
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between cursor-pointer select-none ${
                    isSelected
                      ? `${cat.color} ring-1 ring-brand-500/50 font-bold shadow-sm`
                      : 'bg-dark-800/80 border-dark-700/80 text-zinc-400 hover:text-zinc-200 hover:bg-dark-800'
                  }`}
                >
                  <span className="truncate">{t(`todo.cat.${cat.id}` as any)}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t('todo.startDate')}
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (endDate < e.target.value) setEndDate(e.target.value);
            }}
            startContent={<Calendar className="w-3.5 h-3.5 text-brand-400" />}
          />

          <Input
            label={t('todo.endDate')}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            startContent={<Calendar className="w-3.5 h-3.5 text-zinc-400" />}
          />
        </div>

        {/* Time Window */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('todo.startTime')}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              startContent={<Clock className="w-3.5 h-3.5 text-brand-400" />}
              isInvalid={!!conflict}
            />

            <Input
              label={t('todo.endTime')}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              startContent={<Clock className="w-3.5 h-3.5 text-zinc-400" />}
              isInvalid={!!conflict}
            />
          </div>

          {/* Time Conflict Alert */}
          {conflict && (
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2 text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-amber-200">{t('todo.timeConflict')}</span>
                  <p className="text-zinc-300 text-[11px] mt-0.5">
                    {t('todo.conflictAlert')}{' '}
                    <strong className="text-white font-semibold">«{conflict.conflictingTodo.title}»</strong>{' '}
                    <span className="font-mono font-bold text-amber-300">({conflict.conflictRange})</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplySuggestedTime}
                className="w-full text-xs font-bold py-1.5 px-3 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 border border-amber-500/50 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('todo.applySlot', { time: conflict.suggestedNextStartTime })}</span>
              </button>
            </div>
          )}
        </div>

        {/* Target Daily Duration */}
        <div>
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              {t('todo.targetDaily')}
            </span>
            <strong className="text-brand-400 font-mono text-sm">{targetDuration} min</strong>
          </label>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_DURATIONS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setTargetDuration(preset.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  targetDuration === preset.value
                    ? 'bg-brand-500/20 border-brand-500 text-brand-400 font-bold'
                    : 'bg-dark-800 border-dark-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <input
            type="range"
            min="5"
            max="240"
            step="5"
            value={targetDuration}
            onChange={(e) => setTargetDuration(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
        </div>

        {/* Video Meeting URL */}
        <Input
          label={t('todo.meetingUrl')}
          type="url"
          placeholder="https://meet.google.com/xxx-yyyy-zzz"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          startContent={<Video className="w-3.5 h-3.5 text-rose-400" />}
        />

        {/* Notes */}
        <Textarea
          label={t('todo.notesLabel')}
          placeholder={t('todo.notesPlaceholder')}
          value={description}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
        />
      </form>
    </Modal>
  );
};
