import React from 'react';
import { Dumbbell, Target, Sparkles, BookOpen, Moon, Plus } from 'lucide-react';
import { Card, CardContent } from '../../../shared/ui/card.tsx';
import { TodoCategory } from '../../../entities/todo/model/types.ts';

interface RoutinePreset {
  id: string;
  title: string;
  category: TodoCategory;
  durationMinutes: number;
  icon: React.ReactNode;
  badgeColor: string;
}

interface TodoQuickRoutinesProps {
  onAddRoutine: (title: string, category: TodoCategory, durationMinutes: number) => void;
  isLoading?: boolean;
}

const PRESET_ROUTINES: RoutinePreset[] = [
  {
    id: 'workout',
    title: 'Силовая тренировка',
    category: 'workout',
    durationMinutes: 60,
    icon: <Dumbbell className="w-3.5 h-3.5 text-amber-400" />,
    badgeColor: 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200',
  },
  {
    id: 'focus-sprint',
    title: 'Фокус-сессия',
    category: 'work',
    durationMinutes: 25,
    icon: <Target className="w-3.5 h-3.5 text-blue-400" />,
    badgeColor: 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200',
  },
  {
    id: 'mobility',
    title: 'Разминка и МФР',
    category: 'health',
    durationMinutes: 15,
    icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />,
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200',
  },
  {
    id: 'study',
    title: 'Анализ техники / Книга',
    category: 'study',
    durationMinutes: 30,
    icon: <BookOpen className="w-3.5 h-3.5 text-brand-400" />,
    badgeColor: 'border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-brand-200',
  },
  {
    id: 'review',
    title: 'Вечерний чекап дня',
    category: 'health',
    durationMinutes: 10,
    icon: <Moon className="w-3.5 h-3.5 text-indigo-400" />,
    badgeColor: 'border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200',
  },
];

export const TodoQuickRoutines: React.FC<TodoQuickRoutinesProps> = ({
  onAddRoutine,
  isLoading,
}) => {
  return (
    <Card className="bg-dark-900 border-dark-800 rounded-3xl shadow-xl overflow-hidden">
      <CardContent className="p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            Быстрые шаблоны
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">1 клик</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
          {PRESET_ROUTINES.map((routine) => (
            <button
              key={routine.id}
              disabled={isLoading}
              onClick={() => onAddRoutine(routine.title, routine.category, routine.durationMinutes)}
              className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${routine.badgeColor} active:scale-[0.98] disabled:opacity-50`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {routine.icon}
                <span className="truncate">{routine.title}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] opacity-75">
                <span>{routine.durationMinutes}м</span>
                <Plus className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
