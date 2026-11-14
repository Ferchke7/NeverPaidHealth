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
          <MessageSquarePlus className="w-5 h-5 text-[#34d399]" />
          <span className="font-extrabold text-white">Обратная связь и баги</span>
        </div>
      }
      subtitle="Помогите нам сделать платформу лучше: сообщите о проблеме или предложите идею"
    >
      {isSuccess ? (
        <div className="py-8 text-center space-y-2 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-[#022c22] border border-[#064e3b] text-[#34d399] mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Спасибо за ваш отзыв!</h4>
          <p className="text-xs text-[#a3a3a3]">Мы внимательно изучаем каждый отчёт и улучшаем платформу.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#a3a3a3]">Тип обращения</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCategory('bug')}
                className={`min-h-[44px] py-2 px-3 rounded-[10px] text-xs font-medium border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  category === 'bug'
                    ? 'bg-red-950/50 border-red-900 text-red-400'
                    : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                }`}
              >
                <Bug className="w-3.5 h-3.5 text-rose-400" />
                <span>Баг</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('feature')}
                className={`min-h-[44px] py-2 px-3 rounded-[10px] text-xs font-medium border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  category === 'feature'
                    ? 'bg-amber-950/40 border-amber-900 text-amber-400'
                    : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Идея</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('improvement')}
                className={`min-h-[44px] py-2 px-3 rounded-[10px] text-xs font-medium border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  category === 'improvement'
                    ? 'bg-[#022c22] border-[#064e3b] text-[#34d399]'
                    : 'bg-[#0a0a0a] border-[#404040] text-[#a3a3a3] hover:text-[#fafafa]'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-[#34d399]" />
                <span>UI / UX</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#a3a3a3] block mb-1.5">Краткая суть</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Не открывается таймер на iPhone или Добавьте упражнение..."
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#a3a3a3] block mb-1.5">Подробности</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите, что именно произошло, как воспроизвести или как должна работать новая возможность..."
              rows={4}
              required
              className="w-full bg-[#0a0a0a] border border-[#404040] rounded-[10px] px-3 py-2 text-sm text-[#fafafa] placeholder-[#737373] focus:outline-none focus:border-[#34d399] transition-colors resize-none"
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
