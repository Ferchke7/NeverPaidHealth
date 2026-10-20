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
import {
  SmartPhotoPickerModal,
  CompressedPhoto,
} from '../../../shared/ui/photo-picker/SmartPhotoPickerModal.tsx';
import { Modal } from '../../../shared/ui/modal.tsx';
import { Button } from '../../../shared/ui/button.tsx';
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
  const { t, language } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const startWorkout = useStartWorkout();

  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showBriefingCard, setShowBriefingCard] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedPhoto, setAttachedPhoto] = useState<CompressedPhoto | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
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
    <div className="flex flex-col h-full w-full bg-dark-900 md:border md:border-dark-800 md:rounded-2xl shadow-2xl overflow-hidden relative select-text min-h-0">
      {/* 1. Compact Header with 1-Click Actions */}
      <header className="bg-dark-900/95 backdrop-blur-md border-b border-dark-800 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-brand-500/20 to-emerald-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-sm">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-dark-900 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs sm:text-sm font-extrabold text-white tracking-tight leading-tight truncate">
                {t('coach.title')}
              </h1>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 flex items-center gap-0.5 shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-brand-400" />
                RAG 90d
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 truncate mt-0.5">
              <span>
                ЦНС <strong className="text-emerald-400 font-mono">{readinessScore}%</strong>
              </span>
              <span>•</span>
              <span>
                ACWR <strong className="text-brand-300 font-mono">{acwrValue.toFixed(2)}</strong>
              </span>
              {readyMuscles.length > 0 && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline text-zinc-300 truncate">
                    {readyMuscles.map((m) => `${localizeMuscle(m.muscle_group)} ${m.recovery_percent}%`).join(', ')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 1-Click Quick Start Today's Prescribed Workout */}
          {insights?.recommended_workout && (
            <button
              onClick={handleQuickStartDailyWorkout}
              className="px-2.5 py-1.5 rounded-xl bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/40 text-brand-300 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              title={insights.recommended_workout.title}
            >
              <Play className="w-3 h-3 fill-current text-brand-400" />
              <span className="hidden xs:inline">
                {language === 'uz' ? 'Bugungi' : language === 'en' ? 'Start Day' : 'Старт дня'}
              </span>
            </button>
          )}

          {/* Telemetry Modal Button */}
          <button
            onClick={() => setShowInsightsModal(true)}
            className="px-2 sm:px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95 bg-dark-800/80 hover:bg-dark-750 border-dark-700 text-zinc-300 hover:text-white cursor-pointer"
            title={t('coach.telemetryTitle')}
          >
            <Activity className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-emerald-400 font-mono font-bold">{readinessScore}%</span>
          </button>

          {/* Clear Chat Button */}
          {messages.length > 0 && (
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-dark-800 hover:border-red-900/30 transition-all active:scale-95 cursor-pointer"
              title={t('coach.clearHistory')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Scrollable Feed with Interactive Coach Briefing Card */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 bg-gradient-to-b from-dark-950/80 via-dark-900 to-dark-950/80 overscroll-y-contain relative select-text"
      >
        {/* Interactive Smart Coach Briefing Card (replaces bloated text greeting) */}
        <div className="rounded-2xl bg-dark-850/95 border border-dark-700/80 p-3 sm:p-3.5 space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs font-bold text-white truncate">{getInitialGreeting()}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowBriefingCard((v) => !v)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-dark-800 transition-colors shrink-0 cursor-pointer"
            >
              {showBriefingCard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showBriefingCard && (
            <div className="space-y-2.5 pt-0.5 animate-in fade-in duration-150">
              {/* 3 Compact Telemetry Pills */}
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowInsightsModal(true)}
                  className="p-2 rounded-xl bg-dark-900/90 border border-dark-750 hover:border-brand-500/40 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                    <span>ЦНС / ACWR</span>
                    <Activity className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="font-mono font-extrabold text-white mt-0.5">
                    <span className="text-emerald-400">{readinessScore}%</span>{' '}
                    <span className="text-zinc-500 font-normal">•</span>{' '}
                    <span className="text-brand-300">{acwrValue.toFixed(2)}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInsightsModal(true)}
                  className="p-2 rounded-xl bg-dark-900/90 border border-dark-750 hover:border-brand-500/40 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                    <span>{language === 'uz' ? 'Mushaklar' : language === 'en' ? 'Ready' : 'Готовы'}</span>
                    <Dumbbell className="w-3 h-3 text-brand-400" />
                  </div>
                  <div className="font-bold text-zinc-200 truncate mt-0.5">
                    {readyMuscles.length > 0
                      ? readyMuscles.map((m) => localizeMuscle(m.muscle_group)).join(', ')
                      : `${weeklyWorkouts} тр. / ${weeklyVolumeTons}т`}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMessage(t('coach.prompt6').replace(/^[^\s]+\s/, ''))}
                  className="p-2 rounded-xl bg-dark-900/90 border border-dark-750 hover:border-brand-500/40 text-left transition-colors cursor-pointer"
                >
                  <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                    <span>{language === 'uz' ? 'Oqsil / LBM' : language === 'en' ? 'Macros' : 'Белок LBM'}</span>
                    <Utensils className="w-3 h-3 text-amber-400" />
                  </div>
                  <div className="font-mono font-bold text-white truncate mt-0.5">
                    {bodyComp && bodyComp.protein_target_min_g > 0
                      ? `${Math.round(bodyComp.protein_target_min_g)}г • ${bodyComp.recommended_kcal}`
                      : insights?.today_protein_g
                      ? `${Math.round(insights.today_protein_g)}г / ${insights.today_calories || 0}`
                      : 'КБЖУ →'}
                  </div>
                </button>
              </div>

              {/* Recommended Workout of the Day Card */}
              {insights?.recommended_workout && (
                <CoachWorkoutCard workout={insights.recommended_workout} compact />
              )}

              {/* Clickable Progressive Overload Targets */}
              {insights?.overload_targets && insights.overload_targets.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5">
                  <span className="text-[10px] font-bold text-zinc-400 shrink-0 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-brand-400" />
                    {language === 'uz' ? 'Progress:' : language === 'en' ? 'Targets:' : 'Цели весов:'}
                  </span>
                  {insights.overload_targets.slice(0, 4).map((ov, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        handleSendMessage(`План прогрессии в упражнении «${ov.exercise_name}»`)
                      }
                      className="px-2 py-1 rounded-lg bg-dark-900 hover:bg-dark-800 border border-dark-750 hover:border-brand-500/40 text-[10px] flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                    >
                      <span className="text-zinc-300 font-medium truncate max-w-[120px]">
                        {ov.exercise_name}
                      </span>
                      <span className="font-mono font-bold text-brand-400">
                        {ov.target_weight_kg}кг×{ov.target_reps}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Messages */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2 sm:gap-2.5 max-w-[94%] sm:max-w-[85%] md:max-w-[78%] group ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5 ${
                  isUser
                    ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-dark-950 font-bold'
                    : 'bg-dark-800 border border-dark-700 text-brand-400'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`flex flex-col rounded-2xl text-xs sm:text-sm shadow-md transition-all ${
                  isUser
                    ? 'bg-gradient-to-tr from-brand-500 to-brand-400 text-dark-950 font-medium rounded-tr-xs px-3 py-2.5 shadow-brand-500/10'
                    : 'bg-dark-850/95 text-zinc-100 border border-dark-700/80 rounded-tl-xs backdrop-blur-md p-3 sm:p-3.5 space-y-2.5'
                }`}
              >
                {/* Photo Attachment Thumbnail */}
                {msg.imageUrl && (
                  <div className="relative group/img rounded-xl overflow-hidden border border-dark-950/30 shadow-inner bg-dark-900 max-w-xs">
                    <img
                      src={msg.imageUrl}
                      alt="Attached"
                      className="max-h-48 sm:max-h-64 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                    />
                    <button
                      onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                      className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-dark-950/80 backdrop-blur text-white text-[10px] font-semibold flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity shadow-md"
                    >
                      <ZoomIn className="w-3 h-3" />
                      <span>Zoom</span>
                    </button>
                  </div>
                )}

                {/* Text Content */}
                {isUser ? (
                  <div className="whitespace-pre-wrap select-text leading-snug font-medium break-words">
                    {msg.content}
                  </div>
                ) : (
                  <FormattedChatMessage content={msg.content} />
                )}

                {/* Interactive Prescribed Workout Card inside Chat Reply */}
                {!isUser && msg.suggestedWorkout && (
                  <div className="pt-1">
                    <CoachWorkoutCard workout={msg.suggestedWorkout} />
                  </div>
                )}

                {/* Footer bar */}
                <div
                  className={`flex items-center justify-between gap-2 pt-1 border-t text-[9px] sm:text-[10px] font-mono ${
                    isUser
                      ? 'border-dark-950/10 text-dark-950/70'
                      : 'border-dark-800/80 text-zinc-500'
                  }`}
                >
                  <span>{msg.timestamp}</span>

                  {!isUser && (
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-dark-800 text-zinc-400 hover:text-brand-400 transition-colors cursor-pointer"
                      title={t('coach.copy')}
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

        {/* Typing Indicator */}
        {chatMutation.isPending && (
          <div className="flex gap-2.5 max-w-[85%] mr-auto items-center animate-in fade-in">
            <div className="w-7 h-7 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-brand-400 shrink-0">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="px-3 py-2.5 rounded-2xl bg-dark-850 text-zinc-300 text-xs border border-dark-700/80 rounded-tl-xs flex items-center gap-2 shadow-lg">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" />
              </div>
              <span className="text-zinc-300 font-medium text-[11px]">
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

      {/* 3. Dynamic Quick Suggestions Carousel */}
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
              className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all flex items-center gap-1 shrink-0 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer ${
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
      <footer className="p-2 sm:p-2.5 bg-dark-950 border-t border-dark-800 shrink-0 z-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex flex-col gap-1.5 max-w-4xl mx-auto"
        >
          {attachedPhoto && (
            <div className="px-2.5 py-1.5 bg-dark-900 border border-brand-500/40 rounded-xl flex items-center justify-between animate-in fade-in shadow-sm">
              <div className="flex items-center gap-2.5">
                <img
                  src={attachedPhoto.dataUrl}
                  alt="Attached preview"
                  className="w-9 h-9 object-cover rounded-lg border border-brand-500/50 cursor-pointer"
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
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1.5">
            <button
              type="button"
              onClick={() => setIsPhotoPickerOpen(true)}
              disabled={chatMutation.isPending}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center shrink-0 active:scale-95 h-9 w-9 cursor-pointer ${
                attachedPhoto
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-400 ring-2 ring-brand-500/30'
                  : 'bg-dark-850 hover:bg-dark-800 border-dark-700 text-zinc-400 hover:text-brand-400'
              }`}
              title={t('coach.attachPhoto')}
            >
              <Camera className="w-4 h-4" />
            </button>

            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={attachedPhoto ? t('coach.photoQuestionPlaceholder') : t('coach.placeholder')}
                className="w-full bg-dark-850/90 border border-dark-700/90 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500/70 focus:ring-1 focus:ring-brand-500/30 transition-all shadow-inner resize-none max-h-24 min-h-[36px]"
              />
            </div>

            <button
              type="submit"
              disabled={(!inputMessage.trim() && !attachedPhoto) || chatMutation.isPending}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 disabled:from-dark-800 disabled:to-dark-800 text-dark-950 disabled:text-zinc-600 font-bold flex items-center justify-center transition-all shadow-md shadow-brand-500/20 active:scale-95 shrink-0 cursor-pointer"
              title={t('coach.send')}
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

      {/* 5. Scientific Telemetry & Recovery Matrix Modal */}
      <Modal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
        title={t('coach.telemetryTitle')}
        description="Banister CNS Decay • ACWR • MEV/MAV/MRV • LBM Macros"
        headerIcon={<Activity className="w-4 h-4 text-brand-400" />}
        size="md"
        footer={
          <div className="flex items-center gap-2 w-full">
            {insights?.recommended_workout && (
              <Button
                variant="primary"
                className="flex-1 text-xs font-bold"
                onClick={() => {
                  setShowInsightsModal(false);
                  void handleQuickStartDailyWorkout();
                }}
              >
                <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                {language === 'uz' ? 'Mashqni boshlash' : language === 'en' ? 'Start Prescribed Workout' : 'Начать тренировку дня'}
              </Button>
            )}
            <Button
              variant="outline"
              className="text-xs font-semibold"
              onClick={() => setShowInsightsModal(false)}
            >
              {t('common.close')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
          {/* CNS & ACWR Row */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-dark-900 border border-dark-750 space-y-1">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> {t('coach.cnsReadiness')}
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-extrabold font-mono text-emerald-400">{readinessScore}%</p>
                <span className="text-[10px] font-mono text-brand-300">ACWR {acwrValue.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-zinc-400 truncate">
                {insights?.cns_metrics?.acwr_zone || targetSplit}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-dark-900 border border-dark-750 space-y-1">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-brand-400" /> {t('coach.workload7d')}
              </span>
              <p className="text-lg font-extrabold font-mono text-white">
                {weeklyVolumeTons} т <span className="text-xs font-normal text-zinc-400">({weeklyWorkouts} тр.)</span>
              </p>
              <p className="text-[10px] text-zinc-400">
                28д норма: {((insights?.cns_metrics?.chronic_load_28d_avg_kg || 0) / 1000).toFixed(1)} т/нед
              </p>
            </div>
          </div>

          {/* Per-Muscle Recovery & Volume Matrix */}
          {insights?.muscle_recovery && insights.muscle_recovery.length > 0 && (
            <div className="p-3 rounded-xl bg-dark-900 border border-dark-750 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-zinc-200 flex items-center gap-1">
                  <Dumbbell className="w-3.5 h-3.5 text-brand-400" />
                  {language === 'uz'
                    ? 'Mushaklar tiklanishi va haftalik hajm (MEV–MAV)'
                    : language === 'en'
                    ? 'Muscle Recovery & Weekly Volume (MEV–MAV)'
                    : 'Восстановление мышц и недельный объем (MEV–MAV)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {insights.muscle_recovery.map((m) => {
                  const barColor =
                    m.recovery_percent >= 85
                      ? 'bg-emerald-400'
                      : m.recovery_percent >= 60
                      ? 'bg-amber-400'
                      : 'bg-red-400';
                  return (
                    <div key={m.muscle_group} className="p-2 rounded-lg bg-dark-850 border border-dark-750 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-200">{localizeMuscle(m.muscle_group)}</span>
                        <span className="font-mono font-bold text-emerald-400">{m.recovery_percent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-dark-750 overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${m.recovery_percent}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-zinc-400 font-mono">
                        <span>{m.weekly_sets_7d} сетов/нед</span>
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
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-1">
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-bold">
                <Utensils className="w-3.5 h-3.5" />
                {language === 'uz'
                  ? 'Tana rekompozitsiyasi (LBM hisobi)'
                  : language === 'en'
                  ? 'LBM Recomposition Targets'
                  : 'Цели КБЖУ по сухой массе (LBM)'}
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-zinc-200">
                <span>
                  Вес: <strong>{bodyComp.current_weight_kg} кг</strong> (LBM: <strong>{bodyComp.lean_body_mass_kg} кг</strong>)
                </span>
                <span>
                  Цель: <strong className="text-emerald-400">{bodyComp.recommended_kcal} ккал</strong>
                </span>
                <span>
                  Белок: <strong className="text-brand-300">{Math.round(bodyComp.protein_target_min_g)}–{Math.round(bodyComp.protein_target_max_g)} г</strong>
                </span>
              </div>
            </div>
          )}

          {/* Overload Target Badges */}
          {insights?.overload_targets && insights.overload_targets.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-brand-400" /> {t('coach.overloadGoals')}
              </p>
              <div className="space-y-1">
                {insights.overload_targets.slice(0, 5).map((target, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-dark-900 border border-dark-750 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-zinc-200 truncate mr-2">
                      {target.exercise_name}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono shrink-0 text-[11px]">
                      <span className="text-zinc-500">
                        {target.last_best_weight_kg}×{target.last_best_reps} →
                      </span>
                      <span className="text-brand-400 font-bold">
                        {target.target_weight_kg}кг × {target.target_reps}
                      </span>
                    </div>
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
            <Button variant="ghost" size="sm" onClick={() => setIsClearModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={handleClearChatConfirm}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {t('coach.clearHistory')}
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-400">{t('coach.clearConfirm')}</p>
      </Modal>

      {/* 7. Smart Photo Picker Modal */}
      <SmartPhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onPhotoSelected={handlePhotoCaptured}
        title={t('coach.photoTitle')}
        subtitle={t('coach.photoSubtitle')}
      />

      {/* 8. Fullscreen Image Lightbox */}
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
              alt="Preview"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl border border-dark-700"
            />
          </div>
        </div>
      )}
    </div>
  );
};
