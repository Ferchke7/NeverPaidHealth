import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Trash2,
  User,
  Camera,
  X,
  ZoomIn,
  Activity,
  Calendar,
  TrendingUp,
  Utensils,
  Dumbbell,
  Copy,
  Check,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import {
  SmartPhotoPickerModal,
  CompressedPhoto,
} from '../../../shared/ui/photo-picker/SmartPhotoPickerModal.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { FormattedChatMessage } from './FormattedChatMessage.tsx';

interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  imageUrl?: string;
  timestamp: string;
}

interface ProgressiveOverloadTarget {
  exercise_id: string;
  exercise_name: string;
  last_best_weight_kg: number;
  last_best_reps: number;
  target_weight_kg: number;
  target_reps: number;
  recommendation: string;
}

interface CoachInsights {
  readiness_score: number;
  recovery_status: string;
  weekly_workouts_count: number;
  weekly_volume_kg: number;
  days_since_last_train: number;
  suggested_split: string;
  current_weight_kg?: number;
  body_fat_percentage?: number;
  bmi?: number;
  today_calories?: number;
  today_protein_g?: number;
  overload_targets?: ProgressiveOverloadTarget[];
}

export const AICoachPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedPhoto, setAttachedPhoto] = useState<CompressedPhoto | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Scroll state & control
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hasUnreadResponse, setHasUnreadResponse] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. Fetch live telemetry & insights from backend
  const { data: insights } = useQuery<CoachInsights>({
    queryKey: ['coach-insights'],
    queryFn: () => apiClient<CoachInsights>('/coach/insights'),
    staleTime: 60 * 1000,
  });

  const getInitialGreeting = useCallback(() => {
    const name = user?.display_name || t('coach.athleteDefault');
    return t('coach.greeting', { name });
  }, [user?.display_name, t]);

  const getQuickPrompts = useCallback(() => {
    return [
      t('coach.prompt1'),
      t('coach.prompt2'),
      t('coach.prompt3'),
      t('coach.prompt4'),
      t('coach.prompt5'),
      t('coach.prompt6'),
    ];
  }, [t]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('np_ai_coach_messages_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(-20);
        }
      }
    } catch {
      // Ignore storage error
    }
    return [
      {
        id: 'welcome',
        role: 'coach',
        content: getInitialGreeting(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  // Persist messages to localStorage
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem('np_ai_coach_messages_v3', JSON.stringify(messages.slice(-20)));
      }
    } catch {
      // Ignore
    }
  }, [messages]);

  // Scroll event listener to track position (top / bottom)
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isFarFromBottom = distanceFromBottom > 100;
    const isFarFromTop = el.scrollTop > 200;

    setShowScrollBottom(isFarFromBottom);
    setShowScrollTop(isFarFromTop);

    if (!isFarFromBottom) {
      setHasUnreadResponse(false);
    }
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setHasUnreadResponse(false);
  }, []);

  const scrollToTop = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  // 2. Chat Mutation with Gemini
  const chatMutation = useMutation({
    mutationFn: (payload: { message: string; image_base64?: string; mime_type?: string }) =>
      apiClient.post<{ reply: string; suggestions?: string[] }>('/coach/chat', {
        message: payload.message,
        image_base64: payload.image_base64,
        mime_type: payload.mime_type,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    onSuccess: (data) => {
      const newMsg: ChatMessage = {
        id: String(Date.now()),
        role: 'coach',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, newMsg]);

      // If user is scrolled up, show unread indicator; else scroll down
      const el = scrollContainerRef.current;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 150) {
        setHasUnreadResponse(true);
      } else {
        setTimeout(() => scrollToBottom(true), 80);
      }
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'coach',
          content: t('coach.connError'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setTimeout(() => scrollToBottom(true), 80);
    },
  });

  // Initial scroll to bottom on mount
  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  const handlePhotoCaptured = (photo: CompressedPhoto) => {
    setAttachedPhoto(photo);
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if ((!text && !attachedPhoto) || chatMutation.isPending) return;

    const messageText = text || t('coach.defaultPhotoPrompt');

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: messageText,
      imageUrl: attachedPhoto?.dataUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const photoPayload = attachedPhoto;
    setInputMessage('');
    setAttachedPhoto(null);

    chatMutation.mutate({
      message: messageText,
      image_base64: photoPayload?.base64,
      mime_type: photoPayload?.mimeType,
    });

    setTimeout(() => scrollToBottom(true), 50);

    if (window.innerWidth > 640) {
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard write error
    }
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleClearChatConfirm = () => {
    localStorage.removeItem('np_ai_coach_messages_v3');
    setMessages([
      {
        id: 'welcome-reset-' + Date.now(),
        role: 'coach',
        content: getInitialGreeting(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setAttachedPhoto(null);
    setIsClearModalOpen(false);
    setTimeout(() => scrollToBottom(false), 50);
  };

  const quickPrompts = getQuickPrompts();
  const readinessScore = insights?.readiness_score ?? 85;
  const readinessStatus = insights?.recovery_status ?? 'Optimal';
  const weeklyWorkouts = insights?.weekly_workouts_count ?? 0;
  const weeklyVolumeTons = ((insights?.weekly_volume_kg ?? 0) / 1000).toFixed(1);
  const targetSplit = insights?.suggested_split || 'Push Day (Chest, Shoulders, Triceps)';

  return (
    <div className="flex flex-col h-full w-full bg-dark-900 md:border md:border-dark-800 md:rounded-2xl shadow-2xl overflow-hidden relative select-text min-h-0">
      {/* 1. Ultra-Clean Single-Row Header */}
      <header className="bg-dark-900/95 backdrop-blur-md border-b border-dark-800 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-brand-500/20 to-emerald-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-sm">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-dark-900 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-white tracking-tight leading-tight truncate">
                {t('coach.title')}
              </h1>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 flex items-center gap-0.5 shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-brand-400" />
                AI
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
              {t('coach.cnsStatus')}: <strong className="text-emerald-400 font-semibold">{readinessScore}%</strong> • {readinessStatus}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Telemetry Button */}
          <button
            onClick={() => setShowInsightsModal(true)}
            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 bg-dark-800/80 hover:bg-dark-750 border-dark-700 text-zinc-300 hover:text-white shadow-sm"
            title={t('coach.telemetryTitle')}
            aria-label={t('coach.telemetryTitle')}
          >
            <Activity className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden sm:inline">{t('coach.cnsReadiness')}</span>
            <span className="text-emerald-400 font-bold">{readinessScore}%</span>
          </button>

          {/* Clear Dialog Button */}
          <button
            onClick={() => setIsClearModalOpen(true)}
            className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-dark-800 hover:border-red-900/30 transition-all active:scale-95"
            title={t('coach.clearHistory')}
            aria-label={t('coach.clearHistory')}
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* 2. Scrollable Messages Feed with Native Touch Momentum */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3.5 bg-gradient-to-b from-dark-950/80 via-dark-900 to-dark-950/80 overscroll-y-contain relative select-text"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2 sm:gap-3 max-w-[92%] sm:max-w-[85%] md:max-w-[80%] group ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5 ${
                  isUser
                    ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-dark-950 font-bold'
                    : 'bg-dark-800 border border-dark-700 text-brand-400'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`flex flex-col rounded-2xl text-xs sm:text-sm shadow-md transition-all ${
                  isUser
                    ? 'bg-gradient-to-tr from-brand-500 to-brand-400 text-dark-950 font-medium rounded-tr-xs p-3 sm:p-3.5 shadow-brand-500/10'
                    : 'bg-dark-850/95 text-zinc-100 border border-dark-700/80 rounded-tl-xs backdrop-blur-md p-3.5 sm:p-4'
                }`}
              >
                {/* Photo Attachment Thumbnail */}
                {msg.imageUrl && (
                  <div className="mb-2 relative group/img rounded-xl overflow-hidden border border-dark-950/30 shadow-inner bg-dark-900 max-w-xs">
                    <img
                      src={msg.imageUrl}
                      alt="User photo"
                      className="max-h-48 sm:max-h-72 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                    />
                    <button
                      onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                      className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-dark-950/80 backdrop-blur text-white text-[10px] font-semibold flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity shadow-md"
                    >
                      <ZoomIn className="w-3 h-3" />
                      <span className="text-[10px]">Zoom</span>
                    </button>
                  </div>
                )}

                {/* Content */}
                {isUser ? (
                  <div className="whitespace-pre-wrap select-text leading-relaxed font-medium break-words">
                    {msg.content}
                  </div>
                ) : (
                  <FormattedChatMessage content={msg.content} />
                )}

                {/* Footer bar with Timestamp & Action Button */}
                <div
                  className={`flex items-center justify-between gap-2 mt-1.5 pt-1 border-t text-[9px] sm:text-[10px] font-mono ${
                    isUser
                      ? 'border-dark-950/10 text-dark-950/70'
                      : 'border-dark-800/80 text-zinc-500'
                  }`}
                >
                  <span>{msg.timestamp}</span>

                  {!isUser && (
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-dark-800 text-zinc-400 hover:text-brand-400 transition-colors"
                      title={t('coach.copy')}
                      aria-label={t('coach.copy')}
                    >
                      {copiedMessageId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 text-[10px]">{t('coach.copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[10px]">{t('coach.copy')}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing / Analyzing Loading Indicator */}
        {chatMutation.isPending && (
          <div className="flex gap-2 sm:gap-3 max-w-[85%] mr-auto items-center animate-in fade-in">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-brand-400 shrink-0">
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
            </div>
            <div className="p-3 sm:p-3.5 rounded-2xl bg-dark-850 text-zinc-300 text-xs border border-dark-700/80 rounded-tl-xs flex items-center gap-2.5 shadow-lg">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" />
              </div>
              <span className="text-zinc-300 font-medium text-[11px] sm:text-xs">
                {attachedPhoto ? t('coach.evaluatingPhoto') : t('coach.generating')}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>


      {/* Floating Scroll Navigation Controls */}
      <div className="absolute right-3 bottom-24 sm:bottom-28 z-30 flex flex-col gap-1.5 pointer-events-auto">
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="p-2 rounded-full bg-dark-850/90 hover:bg-dark-800 text-zinc-300 hover:text-white border border-dark-700 shadow-xl backdrop-blur-md transition-all active:scale-90"
            title={t('coach.scrollToTop')}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}

        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom(true)}
            className={`p-2 rounded-full border shadow-xl backdrop-blur-md transition-all active:scale-90 flex items-center gap-1.5 ${
              hasUnreadResponse
                ? 'bg-brand-500 text-dark-950 font-bold border-brand-400 ring-2 ring-brand-500/50 animate-bounce'
                : 'bg-dark-850/90 hover:bg-dark-800 text-zinc-300 hover:text-white border-dark-700'
            }`}
            title={t('coach.scrollToBottom')}
          >
            <ArrowDown className="w-3.5 h-3.5" />
            {hasUnreadResponse && (
              <span className="text-[10px] font-extrabold pr-1">{t('coach.newResponse')}</span>
            )}
          </button>
        )}
      </div>

      {/* 3. Quick Suggestions Carousel */}
      <div className="px-2.5 py-1.5 bg-dark-900/95 border-t border-dark-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 z-10">
        {quickPrompts.map((prompt, i) => {
          const isPhotoPrompt = prompt.includes('📸');
          return (
            <button
              key={i}
              onClick={() => {
                if (isPhotoPrompt) {
                  setIsPhotoPickerOpen(true);
                } else {
                  handleSendMessage(prompt.replace(/^[^\s]+\s/, ''));
                }
              }}
              disabled={chatMutation.isPending}
              className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs whitespace-nowrap transition-all flex items-center gap-1 shrink-0 shadow-sm active:scale-95 disabled:opacity-50 ${
                isPhotoPrompt
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/40 hover:bg-brand-500/25 font-semibold'
                  : 'bg-dark-800/90 hover:bg-dark-750 text-zinc-300 hover:text-white border border-dark-700/80'
              }`}
            >
              <span>{prompt}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Bottom Fixed Input Bar */}
      <footer className="p-2 sm:p-3 bg-dark-950 border-t border-dark-800 shrink-0 z-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex flex-col gap-1.5 max-w-4xl mx-auto"
        >
          {/* Photo Attachment Preview Bar */}
          {attachedPhoto && (
            <div className="px-2.5 py-1.5 bg-dark-900 border border-brand-500/40 rounded-xl flex items-center justify-between animate-in fade-in shadow-sm">
              <div className="flex items-center gap-2.5">
                <img
                  src={attachedPhoto.dataUrl}
                  alt="Attached preview"
                  className="w-10 h-10 object-cover rounded-lg border border-brand-500/50 shadow-sm cursor-pointer"
                  onClick={() => setPreviewModalImg(attachedPhoto.dataUrl)}
                />
                <div className="text-xs">
                  <p className="font-bold text-zinc-200 flex items-center gap-1 text-[11px]">
                    <Sparkles className="w-3 h-3 text-brand-400" />
                    {t('coach.photoAttached')}
                  </p>
                  <p className="text-[10px] text-zinc-400">{t('coach.photoHint')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachedPhoto(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-dark-800 transition-colors"
                title={t('coach.photoDelete')}
                aria-label={t('coach.photoDelete')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input & Action Buttons */}
          <div className="flex items-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsPhotoPickerOpen(true)}
              disabled={chatMutation.isPending}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center shrink-0 active:scale-95 h-10 w-10 ${
                attachedPhoto
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-400 ring-2 ring-brand-500/30'
                  : 'bg-dark-850 hover:bg-dark-800 border-dark-700 text-zinc-400 hover:text-brand-400'
              }`}
              title={t('coach.attachPhoto')}
              aria-label={t('coach.attachPhoto')}
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={attachedPhoto ? t('coach.photoQuestionPlaceholder') : t('coach.placeholder')}
                className="w-full bg-dark-850/90 border border-dark-700/90 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500/70 focus:ring-1 focus:ring-brand-500/30 transition-all shadow-inner resize-none max-h-28 min-h-[40px]"
              />
            </div>

            <button
              type="submit"
              disabled={(!inputMessage.trim() && !attachedPhoto) || chatMutation.isPending}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 disabled:from-dark-800 disabled:to-dark-800 text-dark-950 disabled:text-zinc-600 font-bold flex items-center justify-center transition-all shadow-md shadow-brand-500/20 active:scale-95 shrink-0"
              title={t('coach.send')}
              aria-label={t('coach.send')}
            >
              {chatMutation.isPending ? (
                <Sparkles className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </footer>

      {/* 5. Telemetry & Insights Modal Drawer */}
      <Modal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
        title={t('coach.telemetryTitle')}
        description={t('coach.telemetryDesc')}
        headerIcon={<Activity className="w-4 h-4 text-brand-400" />}
        size="md"
        footer={
          <Button
            variant="outline"
            className="w-full text-xs font-semibold"
            onClick={() => setShowInsightsModal(false)}
          >
            {t('common.close')}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-dark-900 border border-dark-750 space-y-1">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> {t('coach.cnsReadiness')}
              </span>
              <p className="text-base font-bold text-emerald-400">{readinessScore} / 100</p>
              <p className="text-[10px] text-zinc-400">{readinessStatus}</p>
            </div>

            <div className="p-3 rounded-xl bg-dark-900 border border-dark-750 space-y-1">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5 text-brand-400" /> {t('coach.workload7d')}
              </span>
              <p className="text-base font-bold text-white">{t('coach.workoutsCount', { count: weeklyWorkouts })}</p>
              <p className="text-[10px] text-zinc-400">{t('coach.totalTonnage', { tons: weeklyVolumeTons })}</p>
            </div>

            <div className="col-span-2 p-3 rounded-xl bg-dark-900 border border-dark-750 space-y-1">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-brand-400" /> {t('coach.recommendedSplit')}
              </span>
              <p className="font-bold text-brand-300">{targetSplit}</p>
            </div>

            {insights?.today_calories !== undefined && insights.today_calories > 0 && (
              <div className="col-span-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-1">
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                  <Utensils className="w-3.5 h-3.5" /> {t('coach.todayNutrition')}
                </span>
                <p className="text-sm font-bold text-white">
                  {t('coach.todayNutritionDesc', { calories: insights.today_calories, protein: Math.round(insights.today_protein_g || 0) })}
                </p>
              </div>
            )}
          </div>

          {/* Overload Target Badges */}
          {insights?.overload_targets && insights.overload_targets.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-dark-750">
              <p className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-brand-400" /> {t('coach.overloadGoals')}
              </p>
              <div className="space-y-1">
                {insights.overload_targets.slice(0, 3).map((target, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-dark-900 border border-dark-750 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-zinc-200 truncate mr-2">
                      {target.exercise_name}
                    </span>
                    <span className="text-brand-400 font-mono font-bold shrink-0">
                      {target.target_weight_kg}kg × {target.target_reps}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 6. Clear Chat Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title={t('coach.clearModalTitle')}
        description={t('coach.clearModalDesc')}
        headerIcon={<AlertTriangle className="w-5 h-5 text-red-400" />}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsClearModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearChatConfirm}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {t('coach.clearHistory')}
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-400">
          {t('coach.clearConfirm')}
        </p>
      </Modal>

      {/* 7. Smart Photo Picker Modal (In-App Camera / Gallery) */}
      <SmartPhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onPhotoSelected={handlePhotoCaptured}
        title={t('coach.photoTitle')}
        subtitle={t('coach.photoSubtitle')}
      />


      {/* 8. Fullscreen Image Modal / Lightbox */}
      {previewModalImg && (
        <div
          onClick={() => setPreviewModalImg(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewModalImg(null)}
              className="absolute -top-10 right-0 text-white hover:text-zinc-300 p-2 rounded-full bg-dark-800/80 border border-dark-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewModalImg}
              alt="Physique Full Preview"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl border border-dark-700"
            />
          </div>
        </div>
      )}
    </div>
  );
};
