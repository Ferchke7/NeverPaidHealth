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
  TrendingUp,
  Utensils,
  Dumbbell,
  Copy,
  Check,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Play,
  Flame,
  Zap,
  ChevronDown,
  ChevronUp,
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
import { Card, CardHeader, CardTitle, CardContent } from '../../../shared/ui/card.tsx';
import { Textarea } from '../../../shared/ui/input.tsx';
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
  const [showBriefingCard, setShowBriefingCard] = useState(true);
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
    setShowBriefingCard(true);
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
    <div className="space-y-6 select-text max-w-full overflow-x-hidden">
      {/* 1. Royal Violet Page Header */}
      <div className="royal-hero-gradient rounded-[24px] p-5 sm:p-7 text-white royal-card-shadow flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
              {t('coach.title')}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-white border border-white/25 shrink-0">
              <Sparkles className="w-3 h-3 text-[#C4B5FD]" />
              RAG 90d
            </span>
          </div>
          <p className="text-sm text-white/80 mt-1">{t('coach.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {insights?.recommended_workout && (
            <button
              type="button"
              onClick={handleQuickStartDailyWorkout}
              title={insights.recommended_workout.title}
              className="min-h-[42px] px-4 rounded-[12px] bg-white text-[#3B0CA3] hover:bg-[#F5F3FF] font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {language === 'uz' ? 'Bugungi' : language === 'en' ? 'Start Day' : 'Старт дня'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowInsightsModal(true)}
            title={t('coach.telemetryTitle')}
            className="min-h-[42px] px-3.5 rounded-[12px] bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Activity className="w-4 h-4 text-[#6EE7B7]" />
            <span className="font-mono tabular-nums font-bold">
              {readinessScore}%
            </span>
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="min-h-[42px] min-w-[42px] rounded-[12px] bg-white/10 hover:bg-white/20 border border-white/20 text-white/85 hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
              title={t('coach.clearHistory')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Royal Violet 2-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.9fr] gap-4 items-start min-w-0">
        {/* Left: Chat Room & Composer */}
        <Card className="p-0 overflow-hidden bg-white border-[#ECEAF6] min-w-0 w-full">
          <CardHeader className="px-4 sm:px-5 py-3.5 border-b border-[#ECEAF6] mb-0 flex flex-row flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-[12px] bg-[#F0EFFE] border border-[#DDD6FE] text-[#6D28D9] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base truncate">{t('coach.discussTitle')}</CardTitle>
                <p className="text-[11px] font-mono tabular-nums text-[#6B7280] truncate">
                  {t('coach.workoutsCount', { count: weeklyWorkouts })} · {weeklyVolumeTons} {t('summary.tons')} · ACWR{' '}
                  {acwrValue.toFixed(2)}
                </p>
              </div>
            </div>

            {messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsClearModalOpen(true)}
                className="shrink-0 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5 text-[#6B7280]" />
                <span className="hidden sm:inline">{t('coach.clearHistory')}</span>
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-0 flex flex-col relative min-w-0">
            {/* Scrollable Chat History */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              className="h-[440px] sm:h-[520px] lg:h-[560px] overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-3.5 space-y-3 bg-[#F4F3FA] overscroll-y-contain relative select-text min-w-0"
            >
              {/* Collapsible Athlete Briefing */}
              <div className="rounded-[16px] bg-white border border-[#ECEAF6] p-3.5 space-y-2.5 royal-card-shadow">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-[8px] bg-[#F0EFFE] border border-[#DDD6FE] flex items-center justify-center text-[#6D28D9] shrink-0">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-xs font-bold text-[#1E1B4B] truncate">
                      {getInitialGreeting()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBriefingCard((v) => !v)}
                    className="min-w-[40px] min-h-[40px] -my-2 -mr-2 flex items-center justify-center rounded-[10px] text-[#6B7280] hover:text-[#1E1B4B] hover:bg-[#F8F7FC] transition-colors shrink-0 cursor-pointer"
                    aria-label={t('coach.telemetryDetails')}
                  >
                    {showBriefingCard ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {showBriefingCard && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowInsightsModal(true)}
                      className="min-h-[44px] p-2.5 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6] hover:border-[#C4B5FD] text-left transition-colors cursor-pointer"
                    >
                      <div className="text-[10px] text-[#6B7280] flex items-center justify-between font-medium">
                        <span>ЦНС / ACWR</span>
                        <Activity className="w-3 h-3 text-[#6D28D9]" />
                      </div>
                      <div className="font-mono tabular-nums font-bold text-[#1E1B4B] mt-0.5">
                        <span className="text-[#6D28D9]">{readinessScore}%</span>{' '}
                        <span className="text-[#94A3B8]">·</span>{' '}
                        <span>{acwrValue.toFixed(2)}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowInsightsModal(true)}
                      className="min-h-[44px] p-2.5 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6] hover:border-[#C4B5FD] text-left transition-colors cursor-pointer"
                    >
                      <div className="text-[10px] text-[#6B7280] flex items-center justify-between font-medium">
                        <span>
                          {language === 'uz'
                            ? 'Mushaklar'
                            : language === 'en'
                            ? 'Ready'
                            : 'Готовы'}
                        </span>
                        <Dumbbell className="w-3 h-3 text-[#0891B2]" />
                      </div>
                      <div className="font-semibold text-[#1E1B4B] truncate mt-0.5">
                        {readyMuscles.length > 0
                          ? readyMuscles.map((m) => localizeMuscle(m.muscle_group)).join(', ')
                          : `${weeklyWorkouts} / ${weeklyVolumeTons} t`}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendMessage(t('coach.prompt6').replace(/^[^\s]+\s/, ''))}
                      className="min-h-[44px] p-2.5 rounded-[12px] bg-[#F8F7FC] border border-[#ECEAF6] hover:border-[#C4B5FD] text-left transition-colors cursor-pointer"
                    >
                      <div className="text-[10px] text-[#6B7280] flex items-center justify-between font-medium">
                        <span>
                          {language === 'uz'
                            ? 'Oqsil / LBM'
                            : language === 'en'
                            ? 'Macros'
                            : 'Белок LBM'}
                        </span>
                        <Utensils className="w-3 h-3 text-[#EA580C]" />
                      </div>
                      <div className="font-mono tabular-nums font-bold text-[#1E1B4B] truncate mt-0.5">
                        {bodyComp && bodyComp.protein_target_min_g > 0
                          ? `${Math.round(bodyComp.protein_target_min_g)}г · ${bodyComp.recommended_kcal}`
                          : insights?.today_protein_g
                          ? `${Math.round(insights.today_protein_g)}г / ${insights.today_calories || 0}`
                          : 'КБЖУ →'}
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Conversation Thread */}
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 w-full max-w-full sm:max-w-[92%] min-w-0 ${
                      isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 border ${
                        isUser
                          ? 'bg-[#6D28D9] border-[#6D28D9] text-white'
                          : 'bg-white border-[#ECEAF6] text-[#6D28D9]'
                      }`}
                    >
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    <div
                      className={`min-w-0 flex-1 overflow-hidden flex flex-col rounded-[16px] border text-xs sm:text-sm p-3 sm:p-3.5 space-y-2.5 ${
                        isUser
                          ? 'bg-[#F0EFFE] border-[#DDD6FE] text-[#1E1B4B]'
                          : 'bg-white border-[#ECEAF6] text-[#1E1B4B] royal-card-shadow'
                      }`}
                    >
                      {msg.imageUrl && (
                        <div className="relative rounded-[12px] overflow-hidden border border-[#ECEAF6] bg-[#F8F7FC] max-w-xs">
                          <img
                            src={msg.imageUrl}
                            alt="Attached"
                            className="max-h-48 sm:max-h-60 w-full object-cover cursor-pointer"
                            onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                            className="mt-1.5 mb-1.5 mx-1.5 min-h-[38px] px-3 rounded-[10px] bg-white border border-[#ECEAF6] text-[#1E1B4B] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <ZoomIn className="w-3.5 h-3.5 text-[#6D28D9]" />
                            <span>Zoom</span>
                          </button>
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

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#ECEAF6] text-[11px] font-mono tabular-nums text-[#94A3B8]">
                        <span>{msg.timestamp}</span>

                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="min-h-[36px] px-2.5 -my-1.5 rounded-[8px] hover:bg-[#F4F3FA] text-[#6B7280] hover:text-[#6D28D9] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            title={t('coach.copy')}
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#10B981]" />
                                <span className="text-[#10B981] font-sans font-semibold text-xs">
                                  {t('coach.copied')}
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="font-sans text-xs">{t('coach.copyReply')}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {chatMutation.isPending && (
                <div className="flex gap-2.5 max-w-[85%] mr-auto items-center">
                  <div className="w-7 h-7 rounded-[10px] bg-white border border-[#ECEAF6] flex items-center justify-center text-[#6D28D9] shrink-0">
                    <Bot className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="px-3.5 py-2.5 rounded-[14px] bg-white text-[#1E1B4B] text-xs border border-[#ECEAF6] royal-card-shadow flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#6D28D9] animate-spin" />
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
                      className="min-w-[40px] min-h-[40px] px-3 rounded-full bg-white hover:bg-[#F0EFFE] text-[#1E1B4B] border border-[#ECEAF6] royal-float-shadow flex items-center justify-center cursor-pointer"
                      title={t('coach.scrollToTop')}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  )}

                  {showScrollBottom && (
                    <button
                      type="button"
                      onClick={() => scrollToBottom(true)}
                      className={`min-w-[40px] min-h-[40px] px-3 rounded-full border royal-float-shadow flex items-center justify-center gap-1.5 cursor-pointer ${
                        hasUnreadResponse
                          ? 'bg-[#6D28D9] text-white font-semibold border-[#6D28D9]'
                          : 'bg-white hover:bg-[#F0EFFE] text-[#1E1B4B] border-[#ECEAF6]'
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

            {/* Bottom Composer & Quick Prompts */}
            <div className="border-t border-[#ECEAF6] p-3.5 sm:p-4 space-y-3 bg-white">
              {/* Quick Prompts */}
              <div className="flex flex-wrap gap-1.5">
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
                      className={`min-h-[38px] px-3 py-1.5 rounded-[10px] border text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer font-medium ${
                        isPhotoPrompt
                          ? 'bg-[#F0EFFE] text-[#6D28D9] border-[#DDD6FE] hover:bg-[#DDD6FE]/60'
                          : 'bg-[#F8F7FC] border-[#ECEAF6] text-[#1E1B4B] hover:border-[#C4B5FD]'
                      }`}
                    >
                      <span>{prompt}</span>
                    </button>
                  );
                })}
              </div>

              {photoError && (
                <div className="p-2.5 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
                  {photoError}
                </div>
              )}

              {attachedPhoto && (
                <div className="px-3 py-2 bg-[#F5F3FF] border border-[#DDD6FE] rounded-[12px] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={attachedPhoto.dataUrl}
                      alt="Attached preview"
                      className="w-10 h-10 object-cover rounded-[8px] border border-[#DDD6FE] cursor-pointer shrink-0"
                      onClick={() => setPreviewModalImg(attachedPhoto.dataUrl)}
                    />
                    <div className="text-xs min-w-0">
                      <p className="font-semibold text-[#1E1B4B] flex items-center gap-1 truncate">
                        <Sparkles className="w-3.5 h-3.5 text-[#6D28D9] shrink-0" />
                        {t('coach.photoAttached')}
                      </p>
                      <p className="text-[11px] text-[#6B7280] truncate">{t('coach.photoHint')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedPhoto(null)}
                    className="min-w-[40px] min-h-[40px] rounded-[10px] text-[#6B7280] hover:text-[#EF4444] hover:bg-white flex items-center justify-center shrink-0 cursor-pointer"
                    aria-label={t('coach.photoDelete')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="space-y-2.5"
              >
                <Textarea
                  ref={textareaRef}
                  label={t('coach.yourQuestion')}
                  rows={2}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={attachedPhoto ? t('coach.photoQuestionPlaceholder') : t('coach.placeholder')}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPhotoPickerOpen(true)}
                    disabled={chatMutation.isPending}
                  >
                    <Camera className="w-4 h-4 mr-1.5 text-[#6D28D9]" />
                    {t('coach.attachPhoto')}
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={(!inputMessage.trim() && !attachedPhoto) || chatMutation.isPending}
                  >
                    {chatMutation.isPending ? (
                      <Sparkles className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1.5" />
                    )}
                    {t('coach.send')}
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Right: Readiness, Overload Targets & Prescribed Workout */}
        <div className="min-w-0 space-y-4">
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
                <Utensils className="w-3.5 h-3.5" />
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
        description={t('coach.clearModalDesc')}
        headerIcon={<AlertTriangle className="w-5 h-5 text-[#EF4444]" />}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsClearModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={handleClearChatConfirm}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('coach.clearHistory')}
            </Button>
          </>
        }
      >
        <p className="text-xs text-[#6B7280]">{t('coach.clearConfirm')}</p>
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
