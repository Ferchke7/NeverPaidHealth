import React, { useState } from 'react';
import { Bug, Sparkles, Zap, MessageSquarePlus, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Input } from '../../../shared/ui/input.tsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<'bug' | 'feature' | 'improvement'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiClient('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          category,
          title,
          description,
          author_name: user?.display_name || 'Атлет',
        }),
      });
    },
    onSuccess: () => {
      setIsSuccess(true);
      void queryClient.invalidateQueries({ queryKey: ['feedback'] });
      void queryClient.invalidateQueries({ queryKey: ['platform', 'stats'] });
      setTimeout(() => {
        setIsSuccess(false);
        setTitle('');
        setDescription('');
        onClose();
      }, 1500);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    submitMutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="w-5 h-5 text-brand-400" />
          <span className="font-extrabold text-white">Обратная связь и баги</span>
        </div>
      }
      subtitle="Помогите нам сделать платформу лучше: сообщите о проблеме или предложите идею"
    >
      {isSuccess ? (
        <div className="py-8 text-center space-y-2 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Спасибо за ваш отзыв!</h4>
          <p className="text-xs text-zinc-400">Мы внимательно изучаем каждый отчёт и улучшаем платформу.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Тип обращения</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCategory('bug')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  category === 'bug'
                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-300 shadow-sm'
                    : 'bg-dark-900 border-dark-750 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Bug className="w-3.5 h-3.5 text-rose-400" />
                <span>Баг</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('feature')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  category === 'feature'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-dark-900 border-dark-750 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Идея</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('improvement')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  category === 'improvement'
                    ? 'bg-brand-500/15 border-brand-500/50 text-brand-300 shadow-sm'
                    : 'bg-dark-900 border-dark-750 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-brand-400" />
                <span>UI / UX</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1">Краткая суть</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Не открывается таймер на iPhone или Добавьте упражнение..."
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1">Подробности</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите, что именно произошло, как воспроизвести или как должна работать новая возможность..."
              rows={4}
              required
              className="w-full bg-dark-900 border border-dark-750 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500 transition-colors resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Отмена
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={submitMutation.isPending}
              disabled={!title.trim() || !description.trim()}
            >
              Отправить
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
