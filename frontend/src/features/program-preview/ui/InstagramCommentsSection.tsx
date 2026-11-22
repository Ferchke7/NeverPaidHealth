import React, { useState, useMemo, useRef } from 'react';
import {
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

const QUICK_EMOJIS = ['🔥', '👏', '💪', '⚡', '🦾', '💯', '🏋️', '✅'];

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
                className="font-bold text-[#1E1B4B] mr-1.5 hover:text-[#6D28D9] hover:underline cursor-pointer text-left"
              >
                {item.author_name || 'Атлет'}
              </button>
              {isProgramAuthor && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-[#F0EFFE] text-[#6D28D9] border border-[#DDD6FE] px-1.5 py-0.2 rounded-full mr-1.5 align-middle">
                  <Shield className="w-2.5 h-2.5" />
                  Автор
                </span>
              )}
              <span className={`text-[#374151] break-words ${item.is_deleted ? 'italic text-[#94A3B8]' : ''}`}>
                {item.content}
              </span>
            </div>

            {/* Subline: time, reply, delete */}
            <div className="flex items-center gap-3 text-[11px] text-[#6B7280] font-medium">
              <span>{formatShortTime(item.created_at)}</span>

              {!item.is_deleted && (
                <button
                  type="button"
                  onClick={() => handleStartReply(item.id, item.author_name)}
                  className="font-bold text-[#6D28D9] hover:text-[#4C1D95] transition-colors cursor-pointer"
                >
                  Ответить
                </button>
              )}

              {isOwn && !item.is_deleted && (
                <button
                  type="button"
                  onClick={() => deleteCommentMutation.mutate(item.id)}
                  className="text-[#94A3B8] hover:text-[#EF4444] transition-colors p-0.5 cursor-pointer"
                  title="Удалить"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Expand / Collapse Replies Button */}
            {hasReplies && (
              <button
                type="button"
                onClick={() => toggleExpand(item.id)}
                className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-[#6D28D9] hover:text-[#4C1D95] transition-colors cursor-pointer"
              >
                <div className="w-6 h-px bg-[#DDD6FE]" />
                <span>
                  {isExpanded
                    ? 'Скрыть ответы'
                    : `Посмотреть ответы (${item.children.length})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Nested Replies */}
        {hasReplies && isExpanded && (
          <div className="pl-7 sm:pl-9 space-y-2.5 pt-1 border-l-2 border-[#ECEAF6] ml-3 sm:ml-4">
            {item.children.map((child) => renderCommentItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="program-comments-section" className="bg-white border border-[#ECEAF6] p-4 rounded-[20px] space-y-3.5 royal-card-shadow">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#ECEAF6] pb-2.5">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#6D28D9]" />
          <h4 className="text-sm font-bold text-[#1E1B4B]">Обсуждение программы</h4>
          <span className="text-xs text-[#6B7280] font-mono font-bold">
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
        <div className="flex items-center justify-between bg-[#F0EFFE] border border-[#DDD6FE] px-3 py-1.5 rounded-xl text-xs">
          <span className="text-[#1E1B4B]">
            Ответ для <strong className="text-[#6D28D9]">@{replyingTo.author_name}</strong>
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-[#6B7280] hover:text-[#1E1B4B] p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Comment Input Bar */}
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
            className="w-full bg-[#F8F7FC] border border-[#E2E0F0] rounded-full px-3.5 py-2 text-xs text-[#1E1B4B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9] pr-10 transition-colors"
          />

          {commentText.trim() && (
            <button
              type="submit"
              disabled={postCommentMutation.isPending}
              className="absolute right-2 text-[#6D28D9] hover:text-[#4C1D95] font-bold text-xs p-1 cursor-pointer transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3 pt-2 max-h-[380px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="text-center py-6 text-xs text-[#6B7280]">Загрузка комментариев...</div>
        ) : commentTree.length === 0 ? (
          <div className="text-center py-6 text-[#6B7280] text-xs">
            Пока нет комментариев. Напишите первым!
          </div>
        ) : (
          commentTree.map((node) => renderCommentItem(node))
        )}
      </div>
    </div>
  );
};
