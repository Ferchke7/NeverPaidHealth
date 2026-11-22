import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Trash2,
  Camera,
  X,
  Activity,
  TrendingUp,
  Dumbbell,
  Copy,
  Check,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Play,
  Flame,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import { usePageSEO } from '../../../shared/lib/seo/usePageSEO.ts';
import {
  SmartPhotoPickerModal,
  CompressedPhoto,
} from '../../../shared/ui/photo-picker/SmartPhotoPickerModal.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { Card, CardContent } from '../../../shared/ui/card.tsx';
import { useStartWorkout } from '../../../features/start-workout/model/useStartWorkout.ts';
import { generateUUID } from '../../../shared/lib/uuid.ts';
import { FormattedChatMessage } from './FormattedChatMessage.tsx';
import { CoachWorkoutCard, SuggestedWorkoutAction } from './CoachWorkoutCard.tsx';

interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  imageUrl?: string;
  suggestedWorkout?: SuggestedWorkoutAction;
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

interface CNSMetrics {
  readiness_score: number;
  recovery_status: string;
  acute_load_7d_kg: number;
  chronic_load_28d_avg_kg: number;
  acwr: number;
  acwr_zone: string;
  axial_fatigue_index: number;
  systemic_fatigue_pct: number;
  hours_since_last_train: number;
}

interface MuscleRecoveryStatus {
  muscle_group: string;
  hours_since_trained: number;
  recovery_percent: number;
  weekly_sets_7d: number;
  weekly_sets_28d_avg: number;
  volume_status: string;
  mev: number;
  mav: number;
  mrv: number;
}

interface BodyCompositionSummary {
  current_weight_kg: number;
  lean_body_mass_kg?: number;
  bmi?: number;
  protein_target_min_g: number;
  protein_target_max_g: number;
  estimated_tdee_kcal: number;
  recommended_kcal: number;
  nutritional_goal: string;
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
  cns_metrics?: CNSMetrics;
  muscle_recovery?: MuscleRecoveryStatus[];
  body_composition?: BodyCompositionSummary;
  recommended_workout?: SuggestedWorkoutAction;
}

const MUSCLE_LABELS_RU: Record<string, string> = {
  Chest: 'Грудь',
  Back: 'Спина',
  Legs: 'Ноги',
  Shoulders: 'Плечи',
  Arms: 'Руки',
  Core: 'Кор',
};

const MUSCLE_LABELS_UZ: Record<string, string> = {
  Chest: "Ko'krak",
  Back: 'Orqa',
  Legs: 'Oyoqlar',
  Shoulders: 'Yelka',
  Arms: "Qo'llar",
  Core: 'Press',
};

export const AICoachPage: React.FC = () => {
  usePageSEO({ pageKey: 'coach', canonicalPath: '/coach' });
  const { t, language } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const startWorkout = useStartWorkout();

  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedPhoto, setAttachedPhoto] = useState<CompressedPhoto | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);

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
    staleTime: 45 * 1000,
  });

  const localizeMuscle = useCallback(
    (group: string) => {
      if (language === 'ru') return MUSCLE_LABELS_RU[group] || group;
      if (language === 'uz') return MUSCLE_LABELS_UZ[group] || group;
      return group;
    },
    [language]
  );

  const getInitialGreeting = useCallback(() => {
    const name = user?.display_name || t('coach.athleteDefault');
    return t('coach.greeting', { name });
  }, [user?.display_name, t]);

  const getQuickPrompts = useCallback(() => {
    const photoChip = t('coach.prompt1');
    if (dynamicSuggestions.length > 0) {
      return [photoChip, ...dynamicSuggestions];
    }
    return [
      photoChip,
      t('coach.prompt3'),
      t('coach.prompt2'),
      t('coach.prompt4'),
      t('coach.prompt5'),
      t('coach.prompt6'),
    ];
  }, [t, dynamicSuggestions]);

  const userStorageKey = user?.id ? `np_ai_coach_messages_${user.id}` : 'np_ai_coach_messages_guest';

  // Fetch per-user chat messages from PostgreSQL
  const { data: dbMessages } = useQuery<any[]>({
    queryKey: ['coach-messages', user?.id],
    queryFn: () => apiClient<any[]>('/coach/messages'),
    enabled: !!user?.id,
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(userStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(-30);
        }
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });

  // Sync DB messages into state if available
  useEffect(() => {
    if (Array.isArray(dbMessages) && dbMessages.length > 0) {
      const formatted: ChatMessage[] = dbMessages.map((m) => {
        let sw: SuggestedWorkoutAction | undefined;
        if (m.suggested_workout) {
          try {
            sw = typeof m.suggested_workout === 'string' ? JSON.parse(m.suggested_workout) : m.suggested_workout;
          } catch {
            // ignore
          }
        }
        return {
          id: m.id,
          role: m.role === 'user' ? 'user' : 'coach',
          content: m.content,
          suggestedWorkout: sw,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      });
      setMessages(formatted);
    }
  }, [dbMessages]);

  // Persist messages to user-scoped localStorage
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(userStorageKey, JSON.stringify(messages.slice(-30)));
      }
    } catch {
      // Ignore
    }
  }, [messages, userStorageKey]);

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

  // 2. Chat Mutation with Gemini + Hybrid RAG
  const chatMutation = useMutation({
    mutationFn: (payload: { message: string; image_base64?: string; mime_type?: string }) =>
      apiClient.post<{
        reply: string;
        suggestions?: string[];
        suggested_workout?: SuggestedWorkoutAction;
      }>('/coach/chat', {
        message: payload.message,
        image_base64: payload.image_base64,
        mime_type: payload.mime_type,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    onSuccess: (data) => {
      if (data.suggestions && data.suggestions.length > 0) {
        setDynamicSuggestions(data.suggestions);
      }
      const newMsg: ChatMessage = {
        id: String(Date.now()),
        role: 'coach',
        content: data.reply,
        suggestedWorkout: data.suggested_workout,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, newMsg]);

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

  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  const handlePhotoCaptured = (photo: CompressedPhoto) => {
    const approxBytes = Math.ceil((photo.base64.length * 3) / 4);
    if (approxBytes > 8 * 1024 * 1024) {
      setPhotoError(t('coach.photoSizeError'));
      return;
    }
    setPhotoError(null);
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

  const handleClearChatConfirm = async () => {
    try {
      await apiClient.delete('/coach/messages');
    } catch {
      // Ignore network error on delete
    }
    localStorage.removeItem(userStorageKey);
    localStorage.removeItem('np_ai_coach_messages_v4');
    localStorage.removeItem('np_ai_coach_messages_v3');
    setMessages([]);
    setDynamicSuggestions([]);
    setAttachedPhoto(null);
    setIsClearModalOpen(false);
    setTimeout(() => scrollToTop(), 50);
  };

  const handleQuickStartDailyWorkout = async () => {
    const rw = insights?.recommended_workout;
    if (!rw || !rw.exercises || rw.exercises.length === 0) return;
    await startWorkout({
      name: rw.title,
      exercises: rw.exercises.map((ex) => ({
        exercise_id: ex.exercise_id || generateUUID(),
        exercise_name: ex.exercise_name,
        target_sets: ex.target_sets || 3,
        target_reps: ex.target_reps || 10,
        target_weight_kg: ex.target_weight_kg || 0,
      })),
    });
  };

  const quickPrompts = getQuickPrompts();
  const readinessScore = insights?.readiness_score ?? 88;
  const acwrValue = insights?.cns_metrics?.acwr ?? 1.0;
  const weeklyWorkouts = insights?.weekly_workouts_count ?? 0;
  const weeklyVolumeTons = ((insights?.weekly_volume_kg ?? 0) / 1000).toFixed(1);
  const targetSplit = insights?.suggested_split || 'Push Day';
  const readyMuscles = (insights?.muscle_recovery || [])
    .filter((m) => m.muscle_group !== 'Core' && m.recovery_percent >= 80)
    .slice(0, 3);
  const bodyComp = insights?.body_composition;

  return (
    <div className="flex flex-col h-[calc(100dvh-136px)] lg:h-[calc(100dvh-104px)] min-h-[480px] gap-3 select-text max-w-full overflow-hidden">
      {/* 1. Compact Minimalist Coach Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[12px] violet-btn-gradient text-white flex items-center justify-center shrink-0 shadow-sm">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight truncate">
              {t('coach.title')}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {insights?.recommended_workout && (
            <button
              type="button"
              onClick={handleQuickStartDailyWorkout}
              title={insights.recommended_workout.title}
              className="h-9 px-3 rounded-full bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">
                {language === 'uz' ? 'Bugungi' : language === 'en' ? 'Start Day' : 'Старт дня'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowInsightsModal(true)}
            title={t('coach.telemetryTitle')}
            className="h-9 px-3 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[#8B5CF6] text-[var(--text-primary)] font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="font-mono tabular-nums font-bold">{readinessScore}%</span>
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="w-9 h-9 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-rose-400 text-[var(--text-muted)] hover:text-rose-500 inline-flex items-center justify-center transition-colors cursor-pointer"
              title={t('coach.clearHistory')}
              aria-label={t('coach.clearHistory')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Messenger Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.4fr_0.85fr] gap-4 min-w-0">
        {/* Left: Full-Height Sleek Chat Messenger */}
        <Card className="p-0 overflow-hidden bg-[var(--bg-surface)] border-[var(--border-subtle)] flex flex-col min-h-0 min-w-0 w-full h-full">
          <CardContent className="p-0 flex flex-col flex-1 min-h-0 relative min-w-0">
            {/* Scrollable Chat History */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-5 py-4 space-y-3 bg-[var(--bg-canvas)]/45 overscroll-y-contain relative select-text min-w-0"
            >
              {messages.length === 0 && (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-4 py-6 max-w-md mx-auto space-y-4">
                  <div className="w-12 h-12 rounded-[16px] bg-[var(--bg-lilac)] border border-[var(--border-strong)] text-[#7C3AED] flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                      {getInitialGreeting()}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                      ACWR {acwrValue.toFixed(2)} · {targetSplit}
                    </p>
                  </div>
                </div>
              )}

              {/* Conversation Thread */}
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col min-w-0 ${
                      isUser ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`min-w-0 max-w-[88%] sm:max-w-[80%] overflow-hidden flex flex-col text-[13px] sm:text-sm px-3.5 py-2.5 space-y-2 ${
                        isUser
                          ? 'violet-btn-gradient text-white rounded-[20px] rounded-br-[6px] shadow-sm'
                          : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-[20px] rounded-bl-[6px] royal-card-shadow'
                      }`}
                    >
                      {msg.imageUrl && (
                        <div className="relative rounded-[12px] overflow-hidden border border-black/10 max-w-xs">
                          <img
                            src={msg.imageUrl}
                            alt="Attached"
                            className="max-h-48 sm:max-h-60 w-full object-cover cursor-pointer"
                            onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                          />
                        </div>
                      )}

                      {isUser ? (
                        <div className="whitespace-pre-wrap select-text leading-snug font-medium break-words">
                          {msg.content}
                        </div>
                      ) : (
                        <FormattedChatMessage content={msg.content} />
                      )}

                      {!isUser && msg.suggestedWorkout && (
                        <div className="pt-1">
                          <CoachWorkoutCard workout={msg.suggestedWorkout} />
                        </div>
                      )}
                    </div>

                    <div className={`flex items-center gap-2 mt-1 px-1 text-[10px] font-mono tabular-nums text-[var(--text-muted)] ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="h-6 px-1.5 rounded-[6px] hover:bg-[var(--bg-lilac)] text-[var(--text-muted)] hover:text-[#7C3AED] inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title={t('coach.copy')}
                          aria-label={t('coach.copy')}
                        >
                          {copiedMessageId === msg.id ? (
                            <Check className="w-3 h-3 text-[#10B981]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {chatMutation.isPending && (
                <div className="flex items-start">
                  <div className="px-3.5 py-2.5 rounded-[20px] rounded-bl-[6px] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs border border-[var(--border-subtle)] royal-card-shadow flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#7C3AED] animate-spin" />
                    <span className="font-semibold">
                      {attachedPhoto ? t('coach.evaluatingPhoto') : t('coach.generating')}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />

              {/* Floating Scroll Helpers */}
              {(showScrollTop || showScrollBottom) && (
                <div className="sticky bottom-2 ml-auto flex flex-col gap-1.5 items-end pointer-events-auto z-10">
                  {showScrollTop && (
                    <button
                      type="button"
                      onClick={scrollToTop}
                      className="w-9 h-9 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-lilac)] text-[var(--text-primary)] border border-[var(--border-subtle)] royal-float-shadow flex items-center justify-center cursor-pointer"
                      title={t('coach.scrollToTop')}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  )}

                  {showScrollBottom && (
                    <button
                      type="button"
                      onClick={() => scrollToBottom(true)}
                      className={`h-9 px-3 rounded-full border royal-float-shadow flex items-center justify-center gap-1.5 cursor-pointer ${
                        hasUnreadResponse
                          ? 'bg-[#6D28D9] text-white font-semibold border-[#6D28D9]'
                          : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-lilac)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                      }`}
                      title={t('coach.scrollToBottom')}
                    >
                      <ArrowDown className="w-4 h-4" />
                      {hasUnreadResponse && (
                        <span className="text-xs font-semibold">{t('coach.newResponse')}</span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Sleek 1-Row Composer & Horizontal Scroll Chips */}
            <div className="border-t border-[var(--border-subtle)] px-3 py-2.5 space-y-2 bg-[var(--bg-surface)] shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {quickPrompts.map((prompt, i) => {
                  const isPhotoPrompt = prompt.includes('📸');
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (isPhotoPrompt) {
                          setIsPhotoPickerOpen(true);
                        } else {
                          handleSendMessage(prompt.replace(/^[^\s]+\s/, ''));
                        }
                      }}
                      disabled={chatMutation.isPending}
                      className={`h-7 px-2.5 rounded-full border text-[11px] whitespace-nowrap shrink-0 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer font-semibold ${
                        isPhotoPrompt
                          ? 'bg-[var(--bg-lilac)] text-[#7C3AED] border-[var(--border-strong)] hover:opacity-85'
                          : 'bg-[var(--bg-well)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[#8B5CF6] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span>{prompt}</span>
                    </button>
                  );
                })}
              </div>

              {photoError && (
                <div className="px-2.5 py-1.5 rounded-[10px] bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500">
                  {photoError}
                </div>
              )}

              {attachedPhoto && (
                <div className="px-2.5 py-1.5 bg-[var(--bg-lilac)] border border-[var(--border-strong)] rounded-[12px] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={attachedPhoto.dataUrl}
                      alt="Attached preview"
                      className="w-8 h-8 object-cover rounded-[8px] border border-[var(--border-strong)] cursor-pointer shrink-0"
                      onClick={() => setPreviewModalImg(attachedPhoto.dataUrl)}
                    />
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {t('coach.photoAttached')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedPhoto(null)}
                    className="w-7 h-7 rounded-[8px] text-[var(--text-muted)] hover:text-rose-500 flex items-center justify-center shrink-0 cursor-pointer"
                    aria-label={t('coach.photoDelete')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => setIsPhotoPickerOpen(true)}
                  disabled={chatMutation.isPending}
                  className="w-10 h-10 rounded-full bg-[var(--bg-well)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[#7C3AED] hover:border-[#8B5CF6] flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                  title={t('coach.attachPhoto')}
                  aria-label={t('coach.attachPhoto')}
                >
                  <Camera className="w-4 h-4" />
                </button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={attachedPhoto ? t('coach.photoQuestionPlaceholder') : t('coach.placeholder')}
                  className="flex-1 min-w-0 max-h-28 min-h-[40px] px-3.5 py-2 rounded-[20px] bg-[var(--bg-well)] border border-[var(--border-subtle)] focus:border-[#8B5CF6] focus:outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none leading-snug"
                />

                <button
                  type="submit"
                  disabled={(!inputMessage.trim() && !attachedPhoto) || chatMutation.isPending}
                  className="w-10 h-10 rounded-full violet-btn-gradient text-white flex items-center justify-center shrink-0 shadow-sm disabled:opacity-40 cursor-pointer transition-opacity"
                  aria-label={t('coach.send')}
                  title={t('coach.send')}
                >
                  {chatMutation.isPending ? (
                    <Sparkles className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Right (Desktop): Readiness, Overload Targets & Prescribed Workout */}
        <div className="hidden lg:block min-w-0 space-y-4 overflow-y-auto pr-1">
          {/* Card 1: Today's Readiness */}
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#1E1B4B] tracking-tight">
                  {t('coach.readinessToday')}
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Banister CNS · ACWR {acwrValue.toFixed(2)}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669]">
                {insights?.recovery_status || t('coach.fullyRecovered')}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold font-mono tabular-nums text-[#1E1B4B]">
                    {readinessScore}
                  </span>
                  <span className="text-sm font-mono tabular-nums text-[#6B7280]">/ 100</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#6D28D9] font-semibold">
                  {insights?.cns_metrics?.acwr_zone || targetSplit}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#ECEAF6] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#6D28D9]"
                  style={{ width: `${Math.min(100, Math.max(0, readinessScore))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6]">
                <div className="text-[11px] text-[#6B7280]">ACWR</div>
                <div className="text-sm font-mono tabular-nums font-bold text-[#1E1B4B] mt-0.5">
                  {acwrValue.toFixed(2)}
                </div>
              </div>
              <div className="p-2.5 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6]">
                <div className="text-[11px] text-[#6B7280]">7d Volume</div>
                <div className="text-sm font-mono tabular-nums font-bold text-[#6D28D9] mt-0.5">
                  {weeklyVolumeTons} t
                </div>
              </div>
              <div className="p-2.5 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6]">
                <div className="text-[11px] text-[#6B7280]">Split</div>
                <div className="text-sm font-bold text-[#1E1B4B] truncate mt-0.5">
                  {targetSplit}
                </div>
              </div>
            </div>

            {readyMuscles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {readyMuscles.map((m) => (
                  <span
                    key={m.muscle_group}
                    className="px-2.5 py-1 rounded-[10px] bg-[#F8F7FC] border border-[#ECEAF6] text-xs font-mono tabular-nums text-[#1E1B4B]"
                  >
                    {localizeMuscle(m.muscle_group)}{' '}
                    <span className="text-[#10B981] font-bold">{m.recovery_percent}%</span>
                  </span>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowInsightsModal(true)}
            >
              <Activity className="w-4 h-4 mr-1.5 text-[#6D28D9]" />
              {t('coach.telemetryDetails')}
            </Button>
          </Card>

          {/* Card 2: Progressive Overload & Recomp Targets */}
          <Card className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#1E1B4B] tracking-tight flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#6D28D9]" />
                {t('coach.overloadGoals')}
              </h2>
            </div>

            {insights?.overload_targets && insights.overload_targets.length > 0 ? (
              <div className="space-y-2">
                {insights.overload_targets.slice(0, 4).map((ov, i) => (
                  <button
                    key={ov.exercise_id || i}
                    type="button"
                    onClick={() =>
                      handleSendMessage(`План прогрессии в упражнении «${ov.exercise_name}»`)
                    }
                    className="w-full min-h-[44px] p-2.5 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6] hover:border-[#C4B5FD] flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-[#1E1B4B] truncate">
                      {ov.exercise_name}
                    </span>
                    <span className="text-xs font-mono tabular-nums font-bold text-[#6D28D9] shrink-0">
                      {ov.last_best_weight_kg} → {ov.target_weight_kg} kg × {ov.target_reps}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6B7280] bg-[#F8F7FC] border border-[#ECEAF6] rounded-[12px] p-3 leading-relaxed">
                {t('coach.noOverloadYet')}
              </p>
            )}

            {(bodyComp?.current_weight_kg || insights?.today_calories) && (
              <div className="pt-2 border-t border-[#ECEAF6] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280] font-mono tabular-nums">
                {bodyComp && bodyComp.current_weight_kg > 0 ? (
                  <>
                    <span>
                      {t('coach.todayNutrition')}:{' '}
                      <strong className="text-[#1E1B4B]">{bodyComp.recommended_kcal} kcal</strong>
                    </span>
                    <span className="text-[#6D28D9] font-bold">
                      {Math.round(bodyComp.protein_target_min_g)}–
                      {Math.round(bodyComp.protein_target_max_g)}g P
                    </span>
                  </>
                ) : (
                  <span>
                    {t('coach.todayNutritionDesc', {
                      calories: insights?.today_calories ?? 0,
                      protein: Math.round(insights?.today_protein_g ?? 0),
                    })}
                  </span>
                )}
              </div>
            )}
          </Card>

          {/* Card 3: Prescribed Workout */}
          {insights?.recommended_workout ? (
            <CoachWorkoutCard workout={insights.recommended_workout} />
          ) : (
            <Card className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 text-base font-bold text-[#1E1B4B]">
                <Flame className="w-4 h-4 text-[#6D28D9]" />
                {t('coach.recommendedSplit')}
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed">{t('coach.noWorkoutYet')}</p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleSendMessage(t('coach.prompt3').replace(/^[^\s]+\s/, ''))}
              >
                {t('coach.askAboutWorkout')}
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* 3. Scientific Telemetry & Recovery Matrix Modal */}
      <Modal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
        title={t('coach.telemetryTitle')}
        description="Banister CNS Decay · ACWR · MEV/MAV/MRV · LBM Macros"
        headerIcon={<Activity className="w-4 h-4 text-[#6D28D9]" />}
        size="md"
        footer={
          <div className="flex flex-wrap items-center gap-2 w-full">
            {insights?.recommended_workout && (
              <Button
                variant="primary"
                className="flex-1 text-xs font-semibold"
                onClick={() => {
                  setShowInsightsModal(false);
                  void handleQuickStartDailyWorkout();
                }}
              >
                <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                {language === 'uz'
                  ? 'Mashqni boshlash'
                  : language === 'en'
                  ? 'Start Prescribed Workout'
                  : 'Начать тренировку дня'}
              </Button>
            )}
            <Button
              variant="outline"
              className="text-xs font-medium"
              onClick={() => setShowInsightsModal(false)}
            >
              {t('common.close')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
          {/* CNS & ACWR Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6] space-y-1">
              <span className="text-[11px] text-[#6B7280] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#6D28D9]" /> {t('coach.cnsReadiness')}
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold font-mono tabular-nums text-[#6D28D9]">
                  {readinessScore}%
                </p>
                <span className="text-[11px] font-mono tabular-nums text-[#1E1B4B]">
                  ACWR {acwrValue.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] truncate">
                {insights?.cns_metrics?.acwr_zone || targetSplit}
              </p>
            </div>

            <div className="p-3 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6] space-y-1">
              <span className="text-[11px] text-[#6B7280] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#6D28D9]" /> {t('coach.workload7d')}
              </span>
              <p className="text-lg font-bold font-mono tabular-nums text-[#1E1B4B]">
                {weeklyVolumeTons} t{' '}
                <span className="text-xs font-normal text-[#6B7280]">({weeklyWorkouts})</span>
              </p>
              <p className="text-[11px] text-[#6B7280] font-mono tabular-nums">
                28d avg:{' '}
                {((insights?.cns_metrics?.chronic_load_28d_avg_kg || 0) / 1000).toFixed(1)} t/wk
              </p>
            </div>
          </div>

          {/* Per-Muscle Recovery & Volume Matrix */}
          {insights?.muscle_recovery && insights.muscle_recovery.length > 0 && (
            <div className="p-3 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6] space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#1E1B4B] flex items-center gap-1.5">
                  <Dumbbell className="w-3.5 h-3.5 text-[#6D28D9]" />
                  {language === 'uz'
                    ? 'Mushaklar tiklanishi va haftalik hajm (MEV–MAV)'
                    : language === 'en'
                    ? 'Muscle Recovery & Weekly Volume (MEV–MAV)'
                    : 'Восстановление мышц и недельный объем (MEV–MAV)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {insights.muscle_recovery.map((m) => {
                  const barColor =
                    m.recovery_percent >= 85
                      ? 'bg-[#10B981]'
                      : m.recovery_percent >= 60
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#EF4444]';
                  return (
                    <div
                      key={m.muscle_group}
                      className="p-2.5 rounded-[12px] bg-white border border-[#ECEAF6] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#1E1B4B]">
                          {localizeMuscle(m.muscle_group)}
                        </span>
                        <span className="font-mono tabular-nums font-bold text-[#6D28D9]">
                          {m.recovery_percent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#ECEAF6] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${m.recovery_percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#6B7280] font-mono tabular-nums">
                        <span>{m.weekly_sets_7d} sets</span>
                        <span>MAV: {m.mav}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Body Recomposition & LBM Macros */}
          {bodyComp && bodyComp.current_weight_kg > 0 && (
            <div className="p-3 rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
              <span className="text-[11px] text-[#059669] flex items-center gap-1.5 font-bold">
                <Activity className="w-3.5 h-3.5" />
                {language === 'uz'
                  ? 'Tana rekompozitsiyasi (LBM hisobi)'
                  : language === 'en'
                  ? 'LBM Recomposition Targets'
                  : 'Цели КБЖУ по сухой массе (LBM)'}
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono tabular-nums text-[#1E1B4B]">
                <span>
                  {bodyComp.current_weight_kg} kg (LBM: {bodyComp.lean_body_mass_kg} kg)
                </span>
                <span className="text-[#059669] font-bold">{bodyComp.recommended_kcal} kcal</span>
                <span>
                  {Math.round(bodyComp.protein_target_min_g)}–
                  {Math.round(bodyComp.protein_target_max_g)} g P
                </span>
              </div>
            </div>
          )}

          {/* Overload Target Badges */}
          {insights?.overload_targets && insights.overload_targets.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-[#1E1B4B] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#6D28D9]" /> {t('coach.overloadGoals')}
              </p>
              <div className="space-y-1.5">
                {insights.overload_targets.slice(0, 5).map((target, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6] flex items-center justify-between text-xs gap-2"
                  >
                    <span className="font-semibold text-[#1E1B4B] truncate">
                      {target.exercise_name}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono tabular-nums shrink-0 text-[11px]">
                      <span className="text-[#6B7280]">
                        {target.last_best_weight_kg}×{target.last_best_reps} →
                      </span>
                      <span className="text-[#6D28D9] font-bold">
                        {target.target_weight_kg} kg × {target.target_reps}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 4. Clear Chat Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title={t('coach.clearModalTitle')}
        headerIcon={<AlertTriangle className="w-5 h-5 text-[#EF4444]" />}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setIsClearModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" size="md" onClick={handleClearChatConfirm}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('coach.clearHistory')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t('coach.clearConfirm')}</p>
      </Modal>

      {/* 5. Smart Photo Picker Modal */}
      <SmartPhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onPhotoSelected={handlePhotoCaptured}
        title={t('coach.photoTitle')}
        subtitle={t('coach.photoSubtitle')}
      />

      {/* 6. Fullscreen Image Lightbox */}
      {previewModalImg && (
        <div
          onClick={() => setPreviewModalImg(null)}
          className="fixed inset-0 z-50 bg-[#1B1145]/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewModalImg(null)}
              className="mb-3 ml-auto min-w-[44px] min-h-[44px] text-[#1E1B4B] hover:text-[#6D28D9] px-3 rounded-[12px] bg-white border border-[#ECEAF6] flex items-center justify-center cursor-pointer shadow-md"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewModalImg}
              alt="Preview"
              className="max-h-[82vh] max-w-full object-contain rounded-[18px] border border-white/25 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
