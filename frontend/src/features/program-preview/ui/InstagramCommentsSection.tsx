import React, { useState, useMemo, useRef } from 'react';
import {
  Heart,
  Send,
  X,
  Trash2,
  Shield,
  MessageCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { ProgramComment } from '../../../entities/program/model/types.ts';
import { AthleteAvatar } from '../../../entities/user/ui/AthleteAvatar.tsx';

interface CommentNode extends ProgramComment {
  children: CommentNode[];
}

interface InstagramCommentsSectionProps {
  programId: string;
  programAuthorId?: string;
  onOpenAthlete?: (athleteId: string, name?: string, avatarUrl?: string) => void;
}

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '💪', '⚡', '🦾', '💯', '🏋️'];

export const InstagramCommentsSection: React.FC<InstagramCommentsSectionProps> = ({
  programId,
  programAuthorId,
  onOpenAthlete,
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
    enabled: !!programId,
  });
  const comments = Array.isArray(rawComments) ? rawComments : [];

  // Post comment mutation
  const postCommentMutation = useMutation({
    mutationFn: async () => {
      if (!commentText.trim()) return;
      return apiClient<ProgramComment>(`/programs/${programId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: commentText.trim(),
          parent_id: replyingTo?.id || null,
          author_name: user?.display_name || 'Атлет',
          avatar_url: user?.avatar_url || '',
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
        <div className="flex items-start justify-between gap-2.5 sm:gap-3 group">
          {/* Left Avatar (Clickable to view Athlete profile) */}
          <AthleteAvatar
            name={item.author_name}
            avatarUrl={item.avatar_url}
            size="sm"
            onClick={
              onOpenAthlete
                ? () => onOpenAthlete(item.user_id, item.author_name, item.avatar_url)
                : undefined
            }
          />

          {/* Center: Author, text, and metadata */}
          <div className="flex-1 min-w-0 text-xs space-y-1">
            <div className="leading-relaxed">
              <button
                type="button"
                onClick={
                  onOpenAthlete
                    ? () => onOpenAthlete(item.user_id, item.author_name, item.avatar_url)
                    : undefined
                }
                className="font-bold text-white mr-1.5 hover:underline cursor-pointer text-left"
              >
                {item.author_name || 'Атлет'}
              </button>
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
                className={`w-4 h-4 transition-colors ${
                  item.has_upvoted
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Nested Replies */}
        {hasReplies && isExpanded && (
          <div className="pl-7 sm:pl-9 space-y-2.5 pt-1 border-l-2 border-dark-750 ml-3 sm:ml-4">
            {item.children.map((child) => renderCommentItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="program-comments-section" className="bg-dark-900/90 border border-dark-750 p-4 rounded-2xl space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dark-800 pb-2.5">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-brand-400" />
          <h4 className="text-sm font-extrabold text-white">Обсуждение программы</h4>
          <span className="text-xs text-zinc-400 font-mono font-bold">
            ({comments.length})
          </span>
        </div>
      </div>

      {/* Quick Emoji Reaction Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleAddEmoji(emoji)}
            className="text-base sm:text-lg hover:scale-125 active:scale-95 transition-transform p-1 cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Replying To Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between bg-dark-800/90 border border-dark-700 px-3 py-1.5 rounded-xl text-xs">
          <span className="text-zinc-300">
            Ответ для <strong className="text-brand-400">@{replyingTo.author_name}</strong>
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Comment Input Bar (Instagram Style) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          postCommentMutation.mutate();
        }}
        className="flex items-center gap-2"
      >
        <AthleteAvatar
          name={user?.display_name || 'А'}
          avatarUrl={user?.avatar_url}
          size="sm"
        />

        <div className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={
              replyingTo
                ? `Ответить @${replyingTo.author_name}...`
                : 'Оставьте комментарий к сплиту...'
            }
            className="w-full bg-dark-950/80 border border-dark-700 rounded-full px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500 pr-10 transition-colors"
          />

          {commentText.trim() && (
            <button
              type="submit"
              disabled={postCommentMutation.isPending}
              className="absolute right-2 text-brand-400 hover:text-brand-300 font-bold text-xs p-1 cursor-pointer transition-colors"
            >
              <Send className="w-4 h-4 fill-brand-400/20" />
            </button>
          )}
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3 pt-2 max-h-[380px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="text-center py-6 text-xs text-zinc-500">Загрузка комментариев...</div>
        ) : commentTree.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-xs">
            Пока нет комментариев. Напишите первым!
          </div>
        ) : (
          commentTree.map((node) => renderCommentItem(node))
        )}
      </div>
    </div>
  );
};
