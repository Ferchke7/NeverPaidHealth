import React, { useState, useMemo, useRef } from 'react';
import {
  Heart,
  X,
  Trash2,
  Shield,
  MessageCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Modal } from '../../../shared/ui/modal.tsx';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { ProgramComment } from '../../../entities/program/model/types.ts';

interface CommentNode extends ProgramComment {
  children: CommentNode[];
}

interface InstagramCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  programTitle: string;
  programAuthorId?: string;
}

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '💪', '⚡', '🦾', '💯', '🏋️'];

export const InstagramCommentsModal: React.FC<InstagramCommentsModalProps> = ({
  isOpen,
  onClose,
  programId,
  programAuthorId,
}) => {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; author_name: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  // Query comments
  const { data: rawComments, isLoading } = useQuery<ProgramComment[]>({
    queryKey: ['program-comments', programId],
    queryFn: () => apiClient<ProgramComment[]>(`/programs/${programId}/comments`),
    enabled: isOpen && !!programId,
  });
  const comments = Array.isArray(rawComments) ? rawComments : [];

  // Mutations
  const postCommentMutation = useMutation({
    mutationFn: async () => {
      if (!commentText.trim()) return;
      return apiClient<ProgramComment>(`/programs/${programId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: commentText.trim(),
          parent_id: replyingTo?.id || null,
          author_name: user?.display_name || 'Атлет',
        }),
      });
    },
    onSuccess: () => {
      setCommentText('');
      setReplyingTo(null);
      void queryClient.invalidateQueries({ queryKey: ['program-comments', programId] });
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

  const toggleCommentLikeMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiClient(`/programs/${programId}/comments/${commentId}/upvote`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['program-comments', programId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiClient(`/programs/${programId}/comments/${commentId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['program-comments', programId] });
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

  // Build recursive tree
  const commentTree = useMemo(() => {
    const map = new Map<string, CommentNode>();
    const roots: CommentNode[] = [];

    for (const c of comments) {
      map.set(c.id, { ...c, children: [] });
    }

    for (const c of comments) {
      const node = map.get(c.id);
      if (!node) continue;

      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Chronological order like Instagram
    roots.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return roots;
  }, [comments]);

  const toggleExpand = (id: string) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleStartReply = (id: string, authorName: string) => {
    setReplyingTo({ id, author_name: authorName });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const formatShortTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSecs < 60) return 'сейчас';
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} мин.`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} ч.`;
    if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)} дн.`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const renderCommentItem = (item: CommentNode, depth = 0) => {
    const isProgramAuthor = programAuthorId && item.user_id === programAuthorId;
    const isOwn = user?.id && item.user_id === user.id;
    const hasReplies = item.children && item.children.length > 0;
    const isExpanded = expandedReplies[item.id];

    return (
      <div key={item.id} className="space-y-2">
        <div className="flex items-start justify-between gap-3 group">
          {/* Left Avatar */}
          <div className="w-8 h-8 rounded-full bg-dark-750 border border-dark-700 flex items-center justify-center text-xs font-bold text-zinc-300 uppercase shrink-0 shadow-sm">
            {(item.author_name || 'А')[0]}
          </div>

          {/* Center: Author, text, and metadata */}
          <div className="flex-1 min-w-0 text-xs space-y-1">
            <div className="leading-relaxed">
              <span className="font-bold text-white mr-1.5 hover:underline cursor-pointer">
                {item.author_name || 'Атлет'}
              </span>
              {isProgramAuthor && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30 px-1.5 py-0.2 rounded-full mr-1.5 align-middle">
                  <Shield className="w-2.5 h-2.5" />
                  Автор
                </span>
              )}
              <span className={`text-zinc-200 break-words ${item.is_deleted ? 'italic text-zinc-500' : ''}`}>
                {item.content}
              </span>
            </div>

            {/* Subline: time, likes count, reply, delete */}
            <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-medium">
              <span>{formatShortTime(item.created_at)}</span>

              {item.upvotes > 0 && (
                <span className="font-semibold text-zinc-400">
                  {item.upvotes} {item.upvotes === 1 ? 'лайк' : 'лайков'}
                </span>
              )}

              {!item.is_deleted && (
                <button
                  type="button"
                  onClick={() => handleStartReply(item.id, item.author_name)}
                  className="font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Ответить
                </button>
              )}

              {isOwn && !item.is_deleted && (
                <button
                  type="button"
                  onClick={() => deleteCommentMutation.mutate(item.id)}
                  className="text-zinc-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                  title="Удалить"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Expand / Collapse Replies Button (Instagram style) */}
            {hasReplies && (
              <button
                type="button"
                onClick={() => toggleExpand(item.id)}
                className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <div className="w-6 h-px bg-zinc-700" />
                <span>
                  {isExpanded
                    ? 'Скрыть ответы'
                    : `Посмотреть ответы (${item.children.length})`}
                </span>
              </button>
            )}
          </div>

          {/* Right: Instagram Heart Like Button */}
          <div className="flex flex-col items-center shrink-0 pt-0.5">
            <button
              type="button"
              onClick={() => toggleCommentLikeMutation.mutate(item.id)}
              className="p-1 hover:scale-125 transition-transform cursor-pointer"
              title="Нравится"
            >
              <Heart
                className={`w-3.5 h-3.5 transition-colors ${
                  item.has_upvoted
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              />
            </button>
            {item.upvotes > 0 && (
              <span className="text-[10px] text-zinc-400 font-mono font-medium -mt-0.5">
                {item.upvotes}
              </span>
            )}
          </div>
        </div>

        {/* Nested Replies with Instagram curve guide line */}
        {hasReplies && isExpanded && (
          <div className="ml-7 pl-3 border-l border-dark-750 space-y-3 pt-1">
            {item.children.map((child) => renderCommentItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-brand-400" />
          <span className="font-extrabold text-white text-base">Комментарии</span>
          <span className="text-xs font-mono bg-dark-800 text-zinc-400 border border-dark-700 px-2 py-0.5 rounded-full font-bold">
            {comments.length}
          </span>
        </div>
      }
      subtitle="Обсуждение программы, вопросы по технике и результаты"
    >
      <div className="flex flex-col h-[65vh] max-h-[580px] -mx-4 -mb-4">
        {/* Comments Feed Area */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 scrollbar-thin">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-dark-800" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-dark-800 rounded w-1/4" />
                    <div className="h-3 bg-dark-800 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : commentTree.length === 0 ? (
            <div className="text-center py-16 space-y-2 text-zinc-500">
              <MessageCircle className="w-10 h-10 mx-auto text-zinc-700" />
              <div className="text-xs font-bold text-zinc-300">Пока нет комментариев</div>
              <div className="text-[11px] text-zinc-500">
                Будьте первым, кто задаст вопрос или оставит отзыв!
              </div>
            </div>
          ) : (
            commentTree.map((item) => renderCommentItem(item, 0))
          )}
        </div>

        {/* Sticky Instagram Comment Input Bar */}
        <div className="border-t border-dark-800 bg-dark-900/95 p-3 space-y-2">
          {/* Quick Instagram Emojis */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleAddEmoji(emoji)}
                  className="text-base hover:scale-125 transition-transform cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Replying To Banner */}
          {replyingTo && (
            <div className="flex items-center justify-between bg-dark-800 px-3 py-1 rounded-lg text-xs text-zinc-300 animate-fade-in border border-dark-700">
              <span className="flex items-center gap-1.5">
                <span className="text-zinc-500">Ответ для:</span>
                <span className="font-bold text-brand-400">@{replyingTo.author_name}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-zinc-500 hover:text-white p-0.5"
                title="Отменить ответ"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input Row */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              postCommentMutation.mutate();
            }}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 font-bold flex items-center justify-center text-xs uppercase shrink-0">
              {(user?.display_name || 'А')[0]}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                replyingTo
                  ? `Ответить @${replyingTo.author_name}...`
                  : 'Добавьте комментарий...'
              }
              className="flex-1 bg-dark-950 border border-dark-750 rounded-full px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
            />

            <button
              type="submit"
              disabled={!commentText.trim() || postCommentMutation.isPending}
              className={`text-xs font-bold px-3 py-2 rounded-full transition-all cursor-pointer ${
                commentText.trim() && !postCommentMutation.isPending
                  ? 'text-brand-400 hover:text-brand-300'
                  : 'text-zinc-600 cursor-not-allowed'
              }`}
            >
              {postCommentMutation.isPending ? '...' : 'Опубликовать'}
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
};
