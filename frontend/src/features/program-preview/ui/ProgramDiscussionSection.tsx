import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  ThumbsUp,
  CornerDownRight,
  Trash2,
  Send,
  ChevronDown,
  ChevronRight,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Button } from '../../../shared/ui/button.tsx';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { ProgramComment } from '../../../entities/program/model/types.ts';

interface CommentNode extends ProgramComment {
  children: CommentNode[];
}

interface ProgramDiscussionSectionProps {
  programId: string;
  programAuthorId?: string;
  programAuthorName?: string;
}

export const ProgramDiscussionSection: React.FC<ProgramDiscussionSectionProps> = ({
  programId,
  programAuthorId,
}) => {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [rootContent, setRootContent] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sortBy, setSortBy] = useState<'oldest' | 'popular' | 'newest'>('oldest');
  const [collapsedThreads, setCollapsedThreads] = useState<Record<string, boolean>>({});

  // Fetch comments
  const { data: rawComments, isLoading } = useQuery<ProgramComment[]>({
    queryKey: ['program-comments', programId],
    queryFn: () => apiClient<ProgramComment[]>(`/programs/${programId}/comments`),
    enabled: !!programId,
  });
  const comments = Array.isArray(rawComments) ? rawComments : [];

  // Post comment mutation
  const postCommentMutation = useMutation({
    mutationFn: async ({
      content,
      parentId,
    }: {
      content: string;
      parentId?: string | null;
    }) => {
      return apiClient<ProgramComment>(`/programs/${programId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          parent_id: parentId || null,
          author_name: user?.display_name || 'Атлет',
        }),
      });
    },
    onSuccess: () => {
      setRootContent('');
      setReplyContent('');
      setReplyingToId(null);
      void queryClient.invalidateQueries({ queryKey: ['program-comments', programId] });
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

  // Upvote mutation
  const toggleUpvoteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiClient<{ upvotes: number; has_upvoted: boolean }>(
        `/programs/${programId}/comments/${commentId}/upvote`,
        { method: 'POST' }
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['program-comments', programId] });
    },
  });

  // Delete mutation
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

  // Build recursive Habr comment tree
  const commentTree = useMemo(() => {
    const map = new Map<string, CommentNode>();
    const roots: CommentNode[] = [];

    // Initialize map
    for (const c of comments) {
      map.set(c.id, { ...c, children: [] });
    }

    // Attach children to parents
    for (const c of comments) {
      const node = map.get(c.id);
      if (!node) continue;

      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort roots
    roots.sort((a, b) => {
      if (sortBy === 'popular') {
        return b.upvotes - a.upvotes;
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      // 'oldest' (chronological Habr default)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return roots;
  }, [comments, sortBy]);

  const toggleCollapse = (id: string) => {
    setCollapsedThreads((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSecs < 60) return 'только что';
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} мин назад`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} ч назад`;
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRootSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootContent.trim()) return;
    postCommentMutation.mutate({ content: rootContent.trim() });
  };

  const handleReplySubmit = (parentId: string) => {
    if (!replyContent.trim()) return;
    postCommentMutation.mutate({ content: replyContent.trim(), parentId });
  };

  // Count total recursive descendants
  const countDescendants = (node: CommentNode): number => {
    let count = node.children.length;
    for (const child of node.children) {
      count += countDescendants(child);
    }
    return count;
  };

  // Recursive Tree Item Component
  const renderComment = (node: CommentNode, depth = 0) => {
    const isCollapsed = collapsedThreads[node.id];
    const isAuthor = programAuthorId && node.user_id === programAuthorId;
    const isOwnComment = user?.id && node.user_id === user.id;
    const isReplying = replyingToId === node.id;
    const totalReplies = countDescendants(node);

    // Clamp indentation for mobile screens so it doesn't get squeezed horizontally
    const indentClass =
      depth === 0
        ? ''
        : depth === 1
        ? 'ml-2.5 sm:ml-4'
        : depth === 2
        ? 'ml-2.5 sm:ml-4'
        : depth === 3
        ? 'ml-2 sm:ml-3'
        : 'ml-1 sm:ml-2';

    return (
      <div key={node.id} className={`group/comment relative ${indentClass} mt-2.5 first:mt-0`}>
        {/* Habr thread guide line */}
        {depth > 0 && (
          <div
            onClick={() => toggleCollapse(node.id)}
            title="Свернуть ветку"
            className="absolute -left-2.5 sm:-left-3.5 top-0 bottom-0 w-1.5 hover:w-2 hover:bg-brand-500/40 rounded-full cursor-pointer transition-all"
          />
        )}

        <div
          className={`rounded-xl border transition-all ${
            depth === 0
              ? 'bg-dark-900/90 border-dark-750 p-3'
              : 'bg-dark-950/60 border-dark-800 p-2.5'
          } ${isCollapsed ? 'opacity-75' : ''}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {/* Collapse button */}
              {node.children.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleCollapse(node.id)}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors cursor-pointer"
                  title={isCollapsed ? 'Развернуть' : 'Свернуть ветку'}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {/* Author name & avatar badge */}
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-dark-750 border border-dark-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 uppercase">
                  {(node.author_name || 'А')[0]}
                </div>
                <span className="font-bold text-zinc-200 truncate max-w-[140px]">
                  {node.author_name || 'Атлет'}
                </span>
              </div>

              {isAuthor && (
                <span className="text-[9px] bg-brand-500/15 text-brand-400 border border-brand-500/30 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" />
                  Автор сплита
                </span>
              )}

              <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatTime(node.created_at)}
              </span>
            </div>

            {/* Action buttons (Delete & Upvote) */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Upvote button */}
              <button
                type="button"
                onClick={() => toggleUpvoteMutation.mutate(node.id)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                  node.has_upvoted
                    ? 'bg-brand-500/20 text-brand-400 border-brand-500/40 shadow-sm'
                    : 'bg-dark-850 border-dark-750 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Плюсануть комментарий"
              >
                <ThumbsUp className={`w-3 h-3 ${node.has_upvoted ? 'fill-current' : ''}`} />
                <span>{node.upvotes || 0}</span>
              </button>

              {/* Delete own comment */}
              {isOwnComment && !node.is_deleted && (
                <button
                  type="button"
                  onClick={() => deleteCommentMutation.mutate(node.id)}
                  className="text-zinc-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                  title="Удалить комментарий"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Comment Body */}
          {isCollapsed ? (
            <div
              onClick={() => toggleCollapse(node.id)}
              className="text-xs text-zinc-500 italic mt-1.5 cursor-pointer hover:text-zinc-400 flex items-center gap-1"
            >
              <span>[Ветка свернута — {totalReplies} {totalReplies === 1 ? 'ответ' : 'ответов'}]</span>
            </div>
          ) : (
            <>
              <div className="mt-2 text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                {node.is_deleted ? (
                  <span className="italic text-zinc-500">{node.content}</span>
                ) : (
                  node.content
                )}
              </div>

              {/* Reply trigger button */}
              {!node.is_deleted && (
                <div className="mt-2 pt-1.5 border-t border-dark-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      if (isReplying) {
                        setReplyingToId(null);
                        setReplyContent('');
                      } else {
                        setReplyingToId(node.id);
                        setReplyContent('');
                      }
                    }}
                    className="text-xs font-bold text-zinc-400 hover:text-brand-400 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    <span>{isReplying ? 'Отмена' : 'Ответить'}</span>
                  </button>

                  {depth >= 3 && (
                    <span className="text-[10px] text-zinc-600 font-mono">уровень {depth}</span>
                  )}
                </div>
              )}

              {/* Inline Reply Box */}
              {isReplying && (
                <div className="mt-2.5 pt-2 border-t border-dark-750/80 space-y-2 animate-fade-in">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`Ответить пользователю @${node.author_name}...`}
                    rows={2}
                    autoFocus
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500 transition-colors resize-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2.5"
                      onClick={() => {
                        setReplyingToId(null);
                        setReplyContent('');
                      }}
                    >
                      Отмена
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="text-xs h-7 px-3 gap-1 font-bold"
                      isLoading={postCommentMutation.isPending}
                      disabled={!replyContent.trim()}
                      onClick={() => handleReplySubmit(node.id)}
                    >
                      <Send className="w-3 h-3" />
                      <span>Отправить</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Children recursive list */}
              {node.children.length > 0 && (
                <div className="mt-2 border-l border-dark-800 pl-2 sm:pl-3 space-y-2">
                  {node.children.map((child) => renderComment(child, depth + 1))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Discussion Info Banner */}
      <div className="bg-dark-900/60 p-3 rounded-2xl border border-dark-800 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-400 shrink-0" />
          <span className="text-zinc-300 font-medium">
            Обсуждение сплита, техники, адаптации под себя и прогресса
          </span>
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
          <span className="text-zinc-500 hidden sm:inline">Сортировка:</span>
          <button
            type="button"
            onClick={() => setSortBy('oldest')}
            className={`px-2 py-0.5 rounded-lg border transition-all ${
              sortBy === 'oldest'
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 font-bold'
                : 'bg-dark-850 border-dark-750 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            По порядку
          </button>
          <button
            type="button"
            onClick={() => setSortBy('popular')}
            className={`px-2 py-0.5 rounded-lg border transition-all ${
              sortBy === 'popular'
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 font-bold'
                : 'bg-dark-850 border-dark-750 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Топ
          </button>
          <button
            type="button"
            onClick={() => setSortBy('newest')}
            className={`px-2 py-0.5 rounded-lg border transition-all ${
              sortBy === 'newest'
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 font-bold'
                : 'bg-dark-850 border-dark-750 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Новые
          </button>
        </div>
      </div>

      {/* Main Root Comment Box */}
      <form
        onSubmit={handleRootSubmit}
        className="bg-dark-900 border border-dark-750 p-3.5 rounded-2xl space-y-2.5 shadow-md"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 font-bold flex items-center justify-center text-xs">
            {(user?.display_name || 'А')[0]}
          </div>
          <span className="text-xs font-bold text-white">Написать в обсуждение</span>
        </div>

        <textarea
          value={rootContent}
          onChange={(e) => setRootContent(e.target.value)}
          placeholder="Задайте вопрос автору или атлетам, поделитесь результатами, замените упражнение..."
          rows={3}
          className="w-full bg-dark-950/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500 transition-colors resize-none"
        />

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-brand-400" />
            Ветки поддерживают вложенные ответы как на Хабре
          </span>

          <Button
            variant="primary"
            size="sm"
            type="submit"
            className="text-xs font-bold gap-1.5"
            isLoading={postCommentMutation.isPending}
            disabled={!rootContent.trim()}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Опубликовать</span>
          </Button>
        </div>
      </form>

      {/* Comment Tree List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-dark-900/60 rounded-xl animate-pulse border border-dark-800"
              />
            ))}
          </div>
        ) : commentTree.length === 0 ? (
          <div className="text-center py-10 bg-dark-900/40 rounded-2xl border border-dashed border-dark-800 space-y-2">
            <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
            <h4 className="text-xs font-bold text-zinc-300">Пока нет комментариев</h4>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              Задайте первый вопрос автору программы или начните обсуждение с другими атлетами.
            </p>
          </div>
        ) : (
          commentTree.map((rootNode) => renderComment(rootNode, 0))
        )}
      </div>
    </div>
  );
};
