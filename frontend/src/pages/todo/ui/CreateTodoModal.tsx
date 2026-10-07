import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Calendar,
  Video,
  Check,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
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

const CATEGORIES: { id: TodoCategory; labelRu: string; labelEn: string; color: string }[] = [
  { id: 'work', labelRu: 'Работа / Проект', labelEn: 'Work / Deep Work', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { id: 'workout', labelRu: 'Тренировка / Спорт', labelEn: 'Workout / Gym', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'study', labelRu: 'Учеба / Навыки', labelEn: 'Study / Reading', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { id: 'health', labelRu: 'Здоровье / Режим', labelEn: 'Health / Nutrition', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { id: 'meeting', labelRu: 'Google Meet / Звонок', labelEn: 'Google Meet / Call', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  { id: 'personal', labelRu: 'Личное / Быт', labelEn: 'Personal / Routine', color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
];

const PRESET_DURATIONS = [
  { label: '15 мин', value: 15 },
  { label: '25 мин (🍅)', value: 25 },
  { label: '45 мин', value: 45 },
  { label: '60 мин (1 ч)', value: 60 },
  { label: '90 мин (1.5 ч)', value: 90 },
  { label: '120 мин (2 ч)', value: 120 },
];

export const CreateTodoModal: React.FC<CreateTodoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialTodo,
  defaultDate,
  existingTodos = [],
}) => {
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

  // Helper: parse "HH:MM" to minutes from midnight
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

  // Real-time time conflict validation against existing scheduled tasks
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

      // Interval overlap test: currentStart < otherEnd && currentEnd > otherStart
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-700 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-dark-800">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white">
              {initialTodo ? 'Редактировать задачу / событие' : 'Создать задачу на день'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Задайте время, длительность в день и ссылку Google Meet
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-dark-800 hover:bg-dark-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* 1. Title */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Название задачи / события <span className="text-brand-500">*</span>
            </label>
            <Input
              type="text"
              required
              placeholder="Например: Разработка модуля / Звонок по проекту"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-dark-800 border-dark-700 text-sm font-medium"
            />
          </div>

          {/* 2. Category Selector */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Категория
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
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between ${
                      isSelected
                        ? `${cat.color} ring-1 ring-brand-500/50 font-bold`
                        : 'bg-dark-800/80 border-dark-700/80 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="truncate">{cat.labelRu}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Date & Date Range (Validity) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-400" />
                Дата начала
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
                className="bg-dark-800 border-dark-700 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Дата окончания (до какого дня действует)
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-dark-800 border-dark-700 text-xs"
              />
            </div>
          </div>

          {/* 4. Scheduled Time Window (09:00 - 10:30) */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  Время начала (опционально)
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="09:00"
                  className={`bg-dark-800 text-xs ${conflict ? 'border-amber-500/80 focus:border-amber-400' : 'border-dark-700'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  Время окончания
                </label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="10:30"
                  className={`bg-dark-800 text-xs ${conflict ? 'border-amber-500/80 focus:border-amber-400' : 'border-dark-700'}`}
                />
              </div>
            </div>

            {/* Time Conflict Alert Banner */}
            {conflict && (
              <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 space-y-2 animate-in fade-in">
                <div className="flex items-start gap-2 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-amber-200">Пересечение времени!</span>
                    <p className="text-zinc-300 text-[11px] mt-0.5">
                      На это время уже запланировано:{' '}
                      <strong className="text-white font-semibold">«{conflict.conflictingTodo.title}»</strong>{' '}
                      <span className="font-mono font-bold text-amber-300">({conflict.conflictRange})</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplySuggestedTime}
                  className="w-full text-xs font-bold py-1.5 px-3 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 border border-amber-500/50 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Перенести на свободный слот ({conflict.suggestedNextStartTime})</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. Target Duration in Day (Сколько тратить в день) */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                Сколько времени в день тратить на задачу
              </span>
              <strong className="text-brand-400 font-mono text-sm">{targetDuration} мин</strong>
            </label>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_DURATIONS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setTargetDuration(preset.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    targetDuration === preset.value
                      ? 'bg-brand-500/20 border-brand-500 text-brand-400'
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

          {/* 6. Google Meet / Video Link */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-rose-400" />
              Ссылка на Google Meet / звонок (опционально)
            </label>
            <Input
              type="url"
              placeholder="https://meet.google.com/xxx-yyyy-zzz"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              className="bg-dark-800 border-dark-700 text-xs"
            />
          </div>

          {/* 7. Description / Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Заметки / Описание (опционально)
            </label>
            <textarea
              rows={2}
              placeholder="Дополнительные детали или цели задачи..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700 rounded-xl p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-dark-800 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1 rounded-xl font-bold"
            >
              {initialTodo ? 'Сохранить изменения' : 'Создать задачу'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
