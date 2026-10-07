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
  ChevronDown,
  ChevronUp,
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
  const { t, language } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [showInsightsDrawer, setShowInsightsDrawer] = useState(false);
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

  const scrollContainerRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. Fetch live telemetry & insights from backend
  const { data: insights } = useQuery<CoachInsights>({
    queryKey: ['coach-insights'],
    queryFn: () => apiClient<CoachInsights>('/coach/insights'),
    staleTime: 60 * 1000,
  });

  const getInitialGreeting = useCallback(() => {
    const name = user?.display_name || 'Атлет';
    if (language === 'en') {
      return `Hey ${name}! 🦾 I'm your AI Strength & Conditioning Coach on duda.uz.\n\nI analyze your live training telemetry, CNS readiness, volume overload, and daily nutrition targets.\n\n### What I can help you with:\n• **Physique & Form Analysis:** Attach a photo of your physique or exercise execution for computer vision evaluation.\n• **Progressive Overload:** Compute exact weights and reps to break plateaus.\n• **Workout Programming:** Recommend optimal training splits based on your recovery.\n• **Diet & Macros:** Calculate daily protein and calories.`;
    }
    if (language === 'uz') {
      return `Salom, ${name}! 🦾 Men duda.uz platformasidagi shaxsiy AI murabbiyingizman.\n\nMen mashg'ulotlaringiz hajmi, asab tizimi (CNS) tayyorgarligi, og'irliklar progressi va kunlik ovqatlanishingizni tahlil qilaman.\n\n### Qanday yordam bera olaman:\n• **Forma va Texnika Tahlili:** Forma yoki mashq bajarish rasmini yuboring va neyrotarmoq bahosini oling.\n• **Progressive Overload:** Platoning oldini olish uchun aniq vazn va takrorlar tavsiyasi.\n• **Mashg'ulot Dasturi:** Tiklanishingizga mos optimal mashg'ulot splitlari.\n• **Ovqatlanish va BJU:** Kunlik oqsil va kaloriya me'yori.`;
    }
    return `Привет, ${name}! 🦾 Я твой персональный ИИ-тренер duda.uz.\n\nЯ анализирую твои реальные тренировки, готовность ЦНС к нагрузкам, прогрессию тоннажа и суточное БЖУ.\n\n### Чем я могу помочь:\n• **Оценка формы по фото:** Прикрепи фото формы или техники выполнения для визуальной оценки Gemini Vision.\n• **Прогрессивная перегрузка:** Точный расчет рабочих весов и повторов для преодоления плато.\n• **План тренировок:** Подбор оптимального сплита на основе восстановления.\n• **Питание и калории:** Расчет индивидуальной нормы белка и калорий.`;
  }, [user?.display_name, language]);

  const getQuickPrompts = useCallback(() => {
    if (language === 'en') {
      return [
        '📸 Check physique photo',
        '🎯 Analyze my progress & split',
        '🏋️‍♂️ What should I train today?',
        '📈 How to progressive overload on bench?',
        '🔋 Optimal recovery for my volume',
        '🥩 Daily protein and nutrition targets',
      ];
    }
    if (language === 'uz') {
      return [
        '📸 Forma rasmini baholash',
        '🎯 Progressimni tahlil qiling',
        '🏋️‍♂️ Bugun nima mashq qilishim kerak?',
        '📈 Yotib shtanga ko\'tarishda progress',
        '🔋 Tiklanish bo\'yicha maslahatlar',
        '🥩 Kunlik oqsil va kaloriya me\'yori',
      ];
    }
    return [
      '📸 Оценить форму по фото',
      '🎯 Проанализируй мой прогресс и сплит',
      '🏋️‍♂️ Что мне тренировать сегодня?',
      '📈 Как прогрессировать в жиме лежа?',
      '🔋 Оптимальное восстановление',
      '🥩 Норма белка и калорий',
    ];
  }, [language]);

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
          content:
            language === 'en'
              ? 'Sorry, unable to connect to AI Coach server. Please check connection and try again.'
              : language === 'uz'
              ? "Kechirasiz, AI server bilan aloqa uzildi. Iltimos, qayta urinib ko'ring."
              : 'Извини, возникла ошибка связи с ИИ-сервером. Попробуй еще раз!',
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

    const messageText =
      text ||
      (language === 'en'
        ? 'Please analyze this photo: if it is food, estimate calories & macros; if physique/exercise, evaluate form & symmetry.'
        : language === 'uz'
        ? "Ushbu rasmni tahlil qiling: agar taom bo'lsa kaloriya va BJU hisoblang, agar forma bo'lsa texnikani baholang."
        : 'Проанализируй фото: если это еда — рассчитай калории и БЖУ; если форма — оцени пропорции и технику.');

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

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
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
    <div className="flex flex-col h-full w-full bg-dark-900 md:border md:border-dark-800 md:rounded-2xl shadow-2xl overflow-hidden animate-fade-in relative select-text min-h-0">
      {/* 1. Header Bar with Status & Controls */}
      <header className="px-3 sm:px-4 py-2.5 bg-dark-900/95 backdrop-blur-md border-b border-dark-800 flex flex-col shrink-0 z-20 gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-500/20 via-brand-500/10 to-emerald-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-dark-900 animate-pulse" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-tight truncate">
                  {t('coach.title')}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3 text-brand-400 animate-spin" />
                  Gemini Vision 3.8
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">Готовность ЦНС: <strong className="text-emerald-400 font-semibold">{readinessScore}/100</strong> • {readinessStatus}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Telemetry Toggle */}
            <button
              onClick={() => setShowInsightsDrawer(!showInsightsDrawer)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                showInsightsDrawer
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-400'
                  : 'bg-dark-800/80 hover:bg-dark-750 border-dark-700 text-zinc-300'
              }`}
              title="Показать / скрыть показатели готовности и нагрузки"
            >
              <Activity className="w-3.5 h-3.5 text-brand-400" />
              <span className="hidden sm:inline">Telemetry</span>
              {showInsightsDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Clear Chat Button */}
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-dark-800 hover:border-red-900/30 transition-all text-xs flex items-center gap-1.5 active:scale-95"
              title="Очистить диалог"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:inline font-semibold">{t('common.discard')}</span>
            </button>
          </div>
        </div>

        {/* Compact Telemetry Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none text-[11px] text-zinc-300 pt-0.5">
          {/* Readiness Chip */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-800/80 border border-dark-700/80 shrink-0">
            <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>CNS Readiness:</span>
            <strong className="text-emerald-400 font-bold">{readinessScore}/100</strong>
          </div>

          {/* 7-Day Training Load */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-800/80 border border-dark-700/80 shrink-0">
            <Dumbbell className="w-3 h-3 text-brand-400 shrink-0" />
            <span>7-Day Load:</span>
            <strong className="text-white font-bold">{weeklyWorkouts} sess</strong>
            <span className="text-zinc-400 text-[10px]">({weeklyVolumeTons}t)</span>
          </div>

          {/* Target Today */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 border border-brand-500/25 shrink-0">
            <Calendar className="w-3 h-3 text-brand-400 shrink-0" />
            <span className="text-brand-300 font-medium truncate max-w-[180px] sm:max-w-none">
              {targetSplit}
            </span>
          </div>

          {/* Nutrition Calories/Protein if present */}
          {insights?.today_calories !== undefined && insights.today_calories > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 shrink-0">
              <Utensils className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-medium">
                {insights.today_calories} kcal • {Math.round(insights.today_protein_g || 0)}g protein
              </span>
            </div>
          )}
        </div>

        {/* Expandable Telemetry Drawer */}
        {showInsightsDrawer && (
          <div className="mt-1 pt-2 pb-1 border-t border-dark-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in slide-in-from-top-2 text-xs">
            <div className="p-2.5 rounded-xl bg-dark-850/80 border border-dark-700/70 space-y-1">
              <div className="font-bold text-zinc-200 flex items-center justify-between">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Activity className="w-3.5 h-3.5" />
                  Готовность и восстановление ЦНС
                </span>
                <span className="text-emerald-400 font-extrabold">{readinessScore} / 100</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                {insights?.days_since_last_train !== undefined
                  ? `${insights.days_since_last_train} дн. с последней тренировки. Острое утомление в норме для гипертрофии.`
                  : 'Тренировочный объем и частота находятся в оптимальном диапазоне гипертрофии.'}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-dark-850/80 border border-dark-700/70 space-y-1">
              <div className="font-bold text-zinc-200 flex items-center justify-between">
                <span className="flex items-center gap-1 text-brand-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Прогрессивная перегрузка
                </span>
                <span className="text-brand-400 font-bold">{targetSplit.split('(')[0]}</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                ИИ рассчитывает шаг весов и повторов на основе тоннажа предыдущих подходов.
              </p>
            </div>

            {/* Overload Target Badges */}
            {insights?.overload_targets && insights.overload_targets.length > 0 && (
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                {insights.overload_targets.slice(0, 3).map((target, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-dark-900 border border-dark-700/60 flex items-center justify-between text-[11px]"
                  >
                    <span className="font-semibold text-zinc-300 truncate mr-2">
                      {target.exercise_name}
                    </span>
                    <span className="text-brand-400 font-mono font-bold shrink-0">
                      {target.target_weight_kg}kg × {target.target_reps}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* 2. Scrollable Messages Area with Smooth Auto-Scroll & Custom Scrollbar */}
      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 space-y-4 bg-gradient-to-b from-dark-950/90 via-dark-900 to-dark-950/90 overscroll-contain min-h-0 relative select-text"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 sm:gap-3 max-w-[96%] sm:max-w-[88%] md:max-w-[82%] group ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5 ${
                  isUser
                    ? 'bg-gradient-to-tr from-brand-600 to-brand-400 text-dark-950 font-bold'
                    : 'bg-dark-800 border border-dark-700 text-brand-400'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Speech Bubble */}
              <div
                className={`flex flex-col rounded-2xl text-xs sm:text-sm shadow-md transition-all ${
                  isUser
                    ? 'bg-gradient-to-tr from-brand-500 to-brand-400 text-dark-950 font-medium rounded-tr-sm p-3.5 sm:p-4 shadow-brand-500/10'
                    : 'bg-dark-850/95 text-zinc-100 border border-dark-700/80 rounded-tl-sm backdrop-blur-md p-3.5 sm:p-4.5'
                }`}
              >
                {/* User Attached Photo Thumbnail */}
                {msg.imageUrl && (
                  <div className="mb-2.5 relative group/img rounded-xl overflow-hidden border border-dark-950/30 shadow-inner bg-dark-900 max-w-sm">
                    <img
                      src={msg.imageUrl}
                      alt="User photo"
                      className="max-h-60 sm:max-h-80 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                    />
                    <button
                      onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                      className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-dark-950/80 backdrop-blur text-white text-[11px] font-semibold flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      Увеличить
                    </button>
                  </div>
                )}

                {/* Message Content */}
                {isUser ? (
                  <div className="whitespace-pre-wrap select-text leading-relaxed font-medium">
                    {msg.content}
                  </div>
                ) : (
                  <FormattedChatMessage content={msg.content} />
                )}

                {/* Footer bar with Timestamp & Action Button */}
                <div
                  className={`flex items-center justify-between gap-2 mt-2 pt-1 border-t text-[10px] font-mono ${
                    isUser
                      ? 'border-dark-950/10 text-dark-950/70'
                      : 'border-dark-800/80 text-zinc-500'
                  }`}
                >
                  <span>{msg.timestamp}</span>

                  {!isUser && (
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-dark-800 text-zinc-400 hover:text-brand-400 transition-colors opacity-80 group-hover:opacity-100"
                      title="Скопировать ответ"
                    >
                      {copiedMessageId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 text-[10px]">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[10px]">Копировать</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing / Analyzing Loading Bubble */}
        {chatMutation.isPending && (
          <div className="flex gap-2.5 sm:gap-3 max-w-[85%] mr-auto items-center animate-in fade-in">
            <div className="w-8 h-8 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-brand-400 shrink-0">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-dark-850 text-zinc-300 text-xs border border-dark-700/80 rounded-tl-sm flex items-center gap-3 shadow-lg">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" />
              </div>
              <span className="text-zinc-300 font-medium">
                {attachedPhoto ? 'Gemini Vision анализирует изображение и биометрию...' : 'ИИ-коуч формирует персональный ответ...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Floating Scroll Navigation Controls (Top / Bottom) */}
      <div className="absolute right-4 bottom-24 sm:bottom-28 z-30 flex flex-col gap-1.5 pointer-events-auto">
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="p-2 rounded-full bg-dark-850/90 hover:bg-dark-800 text-zinc-300 hover:text-white border border-dark-700 shadow-xl backdrop-blur-md transition-all active:scale-90 hover:border-brand-500/50"
            title="Прокрутить наверх"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}

        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom(true)}
            className={`p-2.5 rounded-full border shadow-xl backdrop-blur-md transition-all active:scale-90 flex items-center gap-1.5 ${
              hasUnreadResponse
                ? 'bg-brand-500 text-dark-950 font-bold border-brand-400 ring-2 ring-brand-500/50 animate-bounce'
                : 'bg-dark-850/90 hover:bg-dark-800 text-zinc-300 hover:text-white border-dark-700 hover:border-brand-500/50'
            }`}
            title="Прокрутить вниз"
          >
            <ArrowDown className="w-4 h-4" />
            {hasUnreadResponse && (
              <span className="text-[10px] font-extrabold pr-1">Новый ответ</span>
            )}
          </button>
        )}
      </div>

      {/* 3. Quick Suggestions Carousel */}
      <div className="px-3 py-2 bg-dark-900/95 border-t border-dark-800/90 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 z-10">
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
              className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 disabled:opacity-50 ${
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

      {/* 4. Bottom Sticky Input Form */}
      <footer className="p-2.5 sm:p-3.5 bg-dark-950 border-t border-dark-800/90 shrink-0 z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex flex-col gap-2 max-w-4xl mx-auto"
        >
          {/* Photo Attachment Preview Bar */}
          {attachedPhoto && (
            <div className="px-3 py-2 bg-dark-900 border border-brand-500/40 rounded-xl flex items-center justify-between animate-in fade-in shadow-sm">
              <div className="flex items-center gap-3">
                <img
                  src={attachedPhoto.dataUrl}
                  alt="Attached preview"
                  className="w-11 h-11 object-cover rounded-lg border border-brand-500/50 shadow-sm cursor-pointer"
                  onClick={() => setPreviewModalImg(attachedPhoto.dataUrl)}
                />
                <div className="text-xs">
                  <p className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                    {t('coach.photoAttached')}
                  </p>
                  <p className="text-[11px] text-zinc-400">Gemini Vision оценит форму и технику</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAttachedPhoto(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-dark-800 transition-colors"
                title="Удалить фото"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input & Action Buttons */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setIsPhotoPickerOpen(true)}
              disabled={chatMutation.isPending}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center shrink-0 active:scale-95 h-11 w-11 ${
                attachedPhoto
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-400 ring-2 ring-brand-500/30'
                  : 'bg-dark-850 hover:bg-dark-800 border-dark-700 text-zinc-400 hover:text-brand-400'
              }`}
              title={t('coach.attachPhoto')}
            >
              <Camera className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={attachedPhoto ? 'Добавьте комментарий или вопрос к фото...' : t('coach.placeholder')}
                className="w-full bg-dark-850/90 border border-dark-700/90 rounded-xl px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500/70 focus:ring-1 focus:ring-brand-500/30 transition-all shadow-inner resize-none max-h-32 min-h-[44px]"
              />
            </div>

            <button
              type="submit"
              disabled={(!inputMessage.trim() && !attachedPhoto) || chatMutation.isPending}
              className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 hover:from-brand-500 hover:to-brand-300 disabled:from-dark-800 disabled:to-dark-800 text-dark-950 disabled:text-zinc-600 font-bold flex items-center justify-center transition-all shadow-md shadow-brand-500/20 active:scale-95 shrink-0"
              title="Отправить сообщение"
            >
              {chatMutation.isPending ? (
                <Sparkles className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </footer>

      {/* 5. Clear Chat Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-dark-850 border border-dark-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Очистить историю?</h3>
                <p className="text-xs text-zinc-400">Все сообщения диалога будут сброшены.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-dark-800 hover:bg-dark-750 text-zinc-300 border border-dark-700 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleClearChatConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-red-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Очистить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Smart Photo Picker Modal (In-App Camera / Gallery) */}
      <SmartPhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onPhotoSelected={handlePhotoCaptured}
        title="Фото для ИИ-тренера"
        subtitle="Оценка формы, пропорций или техники упражнений"
      />

      {/* 7. Fullscreen Image Modal / Lightbox */}
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

export default AICoachPage;
