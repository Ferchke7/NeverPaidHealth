import React, { useState, useMemo, useRef } from 'react';
import {
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
import { AthleteAvatar } from '../../../entities/user/ui/AthleteAvatar.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface CommentNode extends ProgramComment {
  children: CommentNode[];
}

interface InstagramCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  programTitle: string;
  programAuthorId?: string;
  onOpenAthlete?: (athleteId: string, name?: string, avatarUrl?: string) => void;
}

const QUICK_EMOJIS = ['🔥', '👏', '💪', '⚡', '🦾', '💯', '🏋️', '✅'];

function loadLocalComments(programId: string): ProgramComment[] {
  if (typeof window === 'undefined' || !programId) return [];
  try {
    const raw = localStorage.getItem(`np_program_comments_${programId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalComments(programId: string, list: ProgramComment[]): void {
  if (typeof window === 'undefined' || !programId) return;
  try {
    localStorage.setItem(`np_program_comments_${programId}`, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

export const InstagramCommentsModal: React.FC<InstagramCommentsModalProps> = ({
  isOpen,
  onClose,
  programId,
  programTitle,
  programAuthorId,
  onOpenAthlete,
}) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; author_name: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [localVersion, setLocalVersion] = useState(0);

  // Query comments
  const { data: rawComments, isLoading } = useQuery<ProgramComment[]>({
    queryKey: ['program-comments', programId],
    queryFn: () => apiClient<ProgramComment[]>(`/programs/${programId}/comments`),
    enabled: isOpen && !!programId,
  });

  const comments = useMemo(() => {
    const serverList = Array.isArray(rawComments) ? rawComments : [];
    const localList = loadLocalComments(programId);
    if (localList.length === 0) return serverList;
    const seenIds = new Set(serverList.map((c) => c.id));
    const merged = [...serverList];
    for (const lc of localList) {
      if (!seenIds.has(lc.id)) {
        merged.push(lc);
      }
    }
    return merged;
  }, [rawComments, programId, localVersion]);

  // Mutations
  const postCommentMutation = useMutation({
    mutationFn: async () => {
      const trimmed = commentText.trim();
      if (!trimmed) return;
      try {
        return await apiClient<ProgramComment>(`/programs/${programId}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            content: trimmed,
            parent_id: replyingTo?.id || null,
            author_name: user?.display_name || 'Атлет',
            avatar_url: user?.avatar_url || '',
          }),
        });
      } catch {
        const fallbackComment: ProgramComment = {
          id: `local-${Date.now()}`,
          program_id: programId,
          user_id: user?.id || 'local-user',
          author_name: user?.display_name || 'Атлет',
          avatar_url: user?.avatar_url || '',
          parent_id: replyingTo?.id || null,
          content: trimmed,
          upvotes: 0,
          has_upvoted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        };
        const currentLocal = loadLocalComments(programId);
        saveLocalComments(programId, [...currentLocal, fallbackComment]);
        setLocalVersion((v) => v + 1);
        return fallbackComment;
      }
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
      if (commentId.startsWith('local-')) {
        const remaining = loadLocalComments(programId).filter((c) => c.id !== commentId);
        saveLocalComments(programId, remaining);
        setLocalVersion((v) => v + 1);
        return { deleted: commentId };
      }
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
          <AthleteAvatar
            name={item.author_name}
            avatarUrl={item.avatar_url}
            size="sm"
            onClick={
              onOpenAthlete
                ? () => {
                    onClose();
                    onOpenAthlete(item.user_id, item.author_name, item.avatar_url);
                  }
                : undefined
            }
          />

          {/* Center: Author, text, and metadata */}
          <div className="flex-1 min-w-0 text-xs space-y-1">
            <div className="leading-relaxed">
              <span
                onClick={
                  onOpenAthlete
                    ? () => {
                        onClose();
                        onOpenAthlete(item.user_id, item.author_name, item.avatar_url);
                      }
                    : undefined
                }
                className="font-bold text-[#1E1B4B] mr-1.5 hover:text-[#6D28D9] hover:underline cursor-pointer"
              >
                {item.author_name || 'Атлет'}
              </span>
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
                  title={t('common.delete')}
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
          <div className="ml-7 pl-3 border-l-2 border-[#ECEAF6] space-y-3 pt-1">
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
          <MessageCircle className="w-5 h-5 text-[#6D28D9]" />
          <span className="font-bold text-[#1E1B4B] text-base">{t('programs.commentsCount')}</span>
          <span className="text-xs font-mono bg-[#F0EFFE] text-[#6D28D9] border border-[#DDD6FE] px-2 py-0.5 rounded-full font-bold">
            {comments.length}
          </span>
        </div>
      }
      subtitle={programTitle}
    >
      <div className="flex flex-col h-[65vh] max-h-[580px] -mx-4 -mb-4">
        {/* Comments Feed Area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-[#ECEAF6]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-[#ECEAF6] rounded w-1/4" />
                    <div className="h-3 bg-[#ECEAF6] rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : commentTree.length === 0 ? (
            <div className="text-center py-16 space-y-2 text-[#6B7280]">
              <MessageCircle className="w-10 h-10 mx-auto text-[#C4B5FD]" />
              <div className="text-xs font-bold text-[#1E1B4B]">{t('programs.noCommentsYet') || 'Пока нет комментариев'}</div>
            </div>
          ) : (
            commentTree.map((item) => renderCommentItem(item, 0))
          )}
        </div>

        {/* Sticky Comment Input Bar */}
        <div className="border-t border-[#ECEAF6] bg-[#F8F7FC] p-3 space-y-2">
          {/* Quick Emojis */}
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
            <div className="flex items-center justify-between bg-[#F0EFFE] px-3 py-1 rounded-lg text-xs text-[#1E1B4B] border border-[#DDD6FE]">
              <span className="flex items-center gap-1.5">
                <span className="text-[#6B7280]">→</span>
                <span className="font-bold text-[#6D28D9]">@{replyingTo.author_name}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-[#6B7280] hover:text-[#1E1B4B] p-0.5 cursor-pointer"
                title={t('common.cancel')}
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
            <AthleteAvatar
              name={user?.display_name || 'А'}
              avatarUrl={user?.avatar_url}
              size="xs"
              className="w-7 h-7"
            />

            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                replyingTo
                  ? `@${replyingTo.author_name}...`
                  : t('programs.commentPlaceholder') || 'Написать комментарий...'
              }
              className="flex-1 bg-white border border-[#E2E0F0] rounded-full px-4 py-2 text-xs text-[#1E1B4B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9] transition-colors"
            />

            <button
              type="submit"
              disabled={!commentText.trim() || postCommentMutation.isPending}
              className={`text-xs font-bold px-3 py-2 rounded-full transition-all cursor-pointer ${
                commentText.trim() && !postCommentMutation.isPending
                  ? 'text-[#6D28D9] hover:text-[#4C1D95]'
                  : 'text-[#94A3B8] cursor-not-allowed'
              }`}
            >
              {postCommentMutation.isPending ? '...' : t('common.save') || 'OK'}
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
};
