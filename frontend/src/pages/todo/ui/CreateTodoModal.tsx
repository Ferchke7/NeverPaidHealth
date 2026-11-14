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
import { toLocalDateKey } from '../../../shared/lib/dates.ts';
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

const CATEGORIES: TodoCategory[] = ['work', 'workout', 'study', 'health', 'meeting', 'personal'];

const PRESET_DURATIONS = [
  { label: '15m', value: 15 },
  { label: '25m', value: 25 },
  { label: '45m', value: 45 },
  { label: '60m', value: 60 },
  { label: '90m', value: 90 },
  { label: '120m', value: 120 },
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
  const today = defaultDate || toLocalDateKey(new Date());

  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
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
    setTitleTouched(false);
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

  const parseTimeToMin = (tStr?: string | null): number | null => {
    if (!tStr) return null;
    const parts = tStr.split(':');
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

    const filtered = (existingTodos || []).filter((todo) => {
      if (initialTodo && todo.id === initialTodo.id) return false;
      const targetDay = startDate || today;
      const matchDay =
        (!todo.start_date && !startDate) ||
        (todo.start_date <= targetDay && todo.end_date >= targetDay);
      return matchDay && Boolean(todo.start_time);
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

  const handleSubmit = (e?: React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!title.trim()) {
      setTitleTouched(true);
      return;
    }

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
        <div className="w-9 h-9 rounded-[10px] bg-[#022c22] text-[#34d399] border border-[#064e3b] flex items-center justify-center shrink-0">
          <ListTodo className="w-4 h-4" />
        </div>
      }
      title={initialTodo ? t('todo.modalTitleEdit') : t('todo.modalTitleNew')}
      subtitle={t('todo.modalSubtitle')}
      footer={
        <>
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="font-semibold"
          >
            {initialTodo ? t('todo.saveChanges') : t('todo.createTask')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('todo.titleInput')}
          placeholder={t('todo.titlePlaceholder')}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleTouched && e.target.value.trim()) setTitleTouched(false);
          }}
          isInvalid={titleTouched && !title.trim()}
          errorMessage={
            titleTouched && !title.trim()
              ? t('todo.titlePlaceholder')
              : undefined
          }
          autoFocus
        />

        <div>
          <label className="block text-[12px] font-medium text-[#a3a3a3] mb-1.5">
            {t('todo.categoryLabel')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.map((catId) => {
              const isSelected = category === catId;
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => {
                    setCategory(catId);
                    if (catId === 'meeting' && !title) {
                      setTitle('Google Meet Call');
                    }
                  }}
                  className={`min-h-[44px] px-3 rounded-[10px] text-[12px] font-medium border transition-colors text-left flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                      : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                  }`}
                >
                  <span className="truncate">
                    {t(`todo.cat.${catId}` as Parameters<typeof t>[0])}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t('todo.startDate')}
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (endDate < e.target.value) setEndDate(e.target.value);
            }}
            startContent={<Calendar className="w-4 h-4 text-[#34d399]" />}
          />

          <Input
            label={t('todo.endDate')}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            startContent={<Calendar className="w-4 h-4 text-[#a3a3a3]" />}
          />
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('todo.startTime')}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              startContent={<Clock className="w-4 h-4 text-[#34d399]" />}
              isInvalid={!!conflict}
            />

            <Input
              label={t('todo.endTime')}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              startContent={<Clock className="w-4 h-4 text-[#a3a3a3]" />}
              isInvalid={!!conflict}
            />
          </div>

          {conflict && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-[10px] p-3 space-y-2.5">
              <div className="flex items-start gap-2 text-amber-300 text-[12px]">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-amber-200">{t('todo.timeConflict')}</span>
                  <p className="text-[#a3a3a3] text-[12px] mt-0.5">
                    {t('todo.conflictAlert')}{' '}
                    <strong className="text-[#fafafa]">«{conflict.conflictingTodo.title}»</strong>{' '}
                    <span className="font-mono tabular-nums text-amber-300">({conflict.conflictRange})</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplySuggestedTime}
                className="w-full min-h-[44px] text-[12px] font-semibold px-3 rounded-[10px] bg-[#022c22] hover:bg-[#064e3b] text-[#34d399] border border-[#064e3b] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('todo.applySlot', { time: conflict.suggestedNextStartTime })}</span>
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="text-[12px] font-medium text-[#a3a3a3] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#34d399]" />
              {t('todo.targetDaily')}
            </span>
            <strong className="text-[#34d399] font-mono tabular-nums text-[14px]">
              {targetDuration} {t('common.minutes')}
            </strong>
          </label>

          <div className="flex flex-wrap gap-2 mb-2.5">
            {PRESET_DURATIONS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setTargetDuration(preset.value)}
                className={`min-h-[44px] px-3 rounded-[10px] text-[12px] font-medium border transition-colors cursor-pointer ${
                  targetDuration === preset.value
                    ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                    : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
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
            className="w-full accent-[#34d399]"
          />
        </div>

        <Input
          label={t('todo.meetingUrl')}
          type="url"
          placeholder="https://meet.google.com/xxx-yyyy-zzz"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          startContent={<Video className="w-4 h-4 text-[#a3a3a3]" />}
        />

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
