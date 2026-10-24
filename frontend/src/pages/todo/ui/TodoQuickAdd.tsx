import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
import { Chip } from '../../../shared/ui/card.tsx';
import { TodoCategory } from '../../../entities/todo/model/types.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface TodoQuickAddProps {
  onAdd: (title: string, category: TodoCategory) => void;
  isLoading?: boolean;
}

const CATEGORIES: { id: TodoCategory; labelKey: string }[] = [
  { id: 'work', labelKey: 'todo.cat.work' },
  { id: 'workout', labelKey: 'todo.cat.workout' },
  { id: 'study', labelKey: 'todo.cat.study' },
  { id: 'health', labelKey: 'todo.cat.health' },
  { id: 'meeting', labelKey: 'todo.cat.meeting' },
  { id: 'personal', labelKey: 'todo.cat.personal' },
];

export const TodoQuickAdd: React.FC<TodoQuickAddProps> = ({ onAdd, isLoading = false }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TodoCategory>('work');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isLoading) return;
    onAdd(trimmed, category);
    setTitle('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-dark-900 border border-dark-800 rounded-2xl p-2 sm:p-2.5 shadow-sm space-y-2"
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={t('todo.quickPlaceholder') || '+ Быстрая задача на выбранный день...'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          className="bg-transparent flex-1 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none px-2 font-medium"
        />

        <Button
          size="sm"
          variant="primary"
          type="submit"
          disabled={!title.trim() || isLoading}
          isLoading={isLoading}
          className="rounded-xl px-3 py-1.5 text-xs font-bold shrink-0"
        >
          <Plus className="w-3.5 h-3.5 sm:mr-1" />
          <span className="hidden sm:inline">{t('common.add') || 'Добавить'}</span>
        </Button>
      </div>

      {/* Category Pills Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-dark-800/60">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold shrink-0 mr-1">
          {t('todo.category') || 'Категория'}:
        </span>
        {CATEGORIES.map((c) => {
          const isSelected = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className="cursor-pointer"
            >
              <Chip
                variant={isSelected ? 'solid' : 'bordered'}
                color={isSelected ? 'primary' : 'default'}
                className="text-[10px] cursor-pointer"
              >
                {t(c.labelKey) || c.id}
              </Chip>
            </button>
          );
        })}
      </div>
    </form>
  );
};
