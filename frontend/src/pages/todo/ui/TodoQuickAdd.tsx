import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../shared/ui/button.tsx';
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

  const handleSubmit = (e?: React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const trimmed = title.trim();
    if (!trimmed || isLoading) return;
    onAdd(trimmed, category);
    setTitle('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#F8F7FC] border border-[#ECEAF6] rounded-[14px] p-3 space-y-2.5"
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={t('todo.quickPlaceholder') || '+ Быстрая задача на выбранный день...'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          className="bg-transparent flex-1 min-h-[42px] text-[14px] text-[#1E1B4B] placeholder-[#94A3B8] focus:outline-none px-2"
        />

        <Button
          size="md"
          variant="primary"
          type="submit"
          disabled={!title.trim() || isLoading}
          isLoading={isLoading}
          className="shrink-0 font-semibold"
        >
          <Plus className="w-4 h-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{t('common.add') || 'Добавить'}</span>
        </Button>
      </div>

      {/* Category Pills Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-2 border-t border-[#ECEAF6]">
        <span className="text-[11px] text-[#6B7280] font-semibold shrink-0 mr-1">
          {t('todo.categoryLabel') || 'Категория'}:
        </span>
        {CATEGORIES.map((c) => {
          const isSelected = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`min-h-[36px] px-3 rounded-[10px] text-[12px] font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                  : 'bg-white text-[#6B7280] border-[#ECEAF6] hover:text-[#1E1B4B]'
              }`}
            >
              {t(c.labelKey as Parameters<typeof t>[0]) || c.id}
            </button>
          );
        })}
      </div>
    </form>
  );
};
