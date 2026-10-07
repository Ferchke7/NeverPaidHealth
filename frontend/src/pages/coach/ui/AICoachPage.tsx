import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';
import {
  SmartPhotoPickerModal,
  CompressedPhoto,
} from '../../../shared/ui/photo-picker/SmartPhotoPickerModal.tsx';

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. Fetch live telemetry & insights from backend
  const { data: insights } = useQuery<CoachInsights>({
    queryKey: ['coach-insights'],
    queryFn: () => apiClient<CoachInsights>('/coach/insights'),
    staleTime: 60 * 1000,
  });

  const getInitialGreeting = () => {
    const name = user?.display_name || 'Атлет';
    if (language === 'en') {
      return `Hey ${name}! 🦾 I'm your AI Strength & Conditioning Coach on duda.uz.\n\nI track your training volume, recovery readiness, body weight progress, and daily nutrition targets. You can ask me anything about workouts, diet, or **attach a photo of your physique or exercise form** for an objective visual evaluation!`;
    }
    if (language === 'uz') {
      return `Salom, ${name}! 🦾 Men duda.uz platformasidagi sizning shaxsiy AI murabbiyingizman.\n\nMen mashg'ulotlaringiz hajmi, tiklanish holati, tana vazningiz dinamikasi va kunlik ovqatlanishingizni tahlil qilaman. Shuningdek, formangiz yoki texnikangizni baholash uchun **forma rasmini yuborishingiz mumkin**!`;
    }
    return `Привет, ${name}! 🦾 Я твой персональный ИИ-тренер duda.uz.\n\nЯ анализирую твои тренировки, тоннаж, готовность ЦНС к нагрузкам, динамику веса и калории/БЖУ. Задавай любые вопросы или **отправь фото своей формы / техники**, чтобы я дал детальную оценку и рекомендации!`;
  };

  const getQuickPrompts = () => {
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
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('np_ai_coach_messages_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(-20); // Keep last 20 messages (last 10 questions + answers)
        }
      }
    } catch {
      // Ignore parse errors
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

  // Persist messages to localStorage whenever updated
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem('np_ai_coach_messages_v3', JSON.stringify(messages.slice(-20)));
      }
    } catch {
      // Ignore storage errors
    }
  }, [messages]);

  // 2. Chat Mutation with Gemini / Rule Engine
  const chatMutation = useMutation({
    mutationFn: (payload: { message: string; image_base64?: string; mime_type?: string }) =>
      apiClient.post<{ reply: string; suggestions?: string[] }>('/coach/chat', {
        message: payload.message,
        image_base64: payload.image_base64,
        mime_type: payload.mime_type,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'coach',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
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
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatMutation.isPending]);

  const handlePhotoCaptured = (photo: CompressedPhoto) => {
    setAttachedPhoto(photo);
    if (!inputMessage.trim()) {
      setInputMessage(
        language === 'en'
          ? 'Please assess my physique, body composition, and give training/diet advice.'
          : language === 'uz'
          ? 'Mening formam va tana tuzilishimni baholab, mashg\'ulot va ovqatlanish bo\'yicha maslahat bering.'
          : 'Оцени мою форму и телосложение по фото, дай честную оценку и рекомендации по тренировкам и питанию.'
      );
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if ((!text && !attachedPhoto) || chatMutation.isPending) return;

    const messageText =
      text ||
      (language === 'en'
        ? 'Please evaluate my physique from this photo.'
        : language === 'uz'
        ? 'Ushbu rasm bo\'yicha formamni baholang.'
        : 'Оцени мою форму по этому фото.');

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

  const handleClearChat = () => {
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
  };

  const quickPrompts = getQuickPrompts();
  const readinessScore = insights?.readiness_score ?? 85;
  const readinessStatus = insights?.recovery_status ?? 'Optimal';
  const weeklyWorkouts = insights?.weekly_workouts_count ?? 0;
  const weeklyVolumeTons = ((insights?.weekly_volume_kg ?? 0) / 1000).toFixed(1);
  const targetSplit = insights?.suggested_split || 'Push Day (Chest, Shoulders, Triceps)';

  return (
    <div className="flex flex-col h-full w-full bg-dark-900 md:border md:border-dark-800 md:rounded-2xl shadow-2xl overflow-hidden animate-fade-in relative select-text min-h-0">
      {/* 1. Header Bar with Telemetry Status Banner */}
      <header className="px-3 sm:px-4 py-2 sm:py-2.5 bg-dark-900/95 backdrop-blur-md border-b border-dark-800 flex flex-col shrink-0 z-10 gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-brand-500/20 to-emerald-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-dark-900 animate-pulse" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-tight truncate">
                  {t('coach.title')}
                </h1>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 flex items-center gap-1 shrink-0">
                  <Sparkles className="w-2.5 h-2.5 text-brand-400" />
                  Gemini Vision
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">Evidence-Based Strength & Hypertrophy Coach</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowInsightsDrawer(!showInsightsDrawer)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
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

            <button
              onClick={handleClearChat}
              className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 transition-all text-xs flex items-center gap-1.5"
              title="Очистить диалог"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">{t('common.discard')}</span>
            </button>
          </div>
        </div>

        {/* Compact Telemetry Chips Bar (Always visible or expandable) */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none text-[11px] text-zinc-300 pt-0.5">
          {/* Readiness Chip */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-800/80 border border-dark-700/80 shrink-0">
            <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>CNS Readiness:</span>
            <strong className="text-emerald-400 font-bold">{readinessScore}/100</strong>
            <span className="text-zinc-500 text-[10px]">({readinessStatus})</span>
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
            <span className="text-brand-300 font-medium truncate max-w-[170px] sm:max-w-none">
              {targetSplit}
            </span>
          </div>

          {/* Nutrition Calories/Protein if present */}
          {insights?.today_calories !== undefined && insights.today_calories > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 shrink-0">
              <Utensils className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-medium">
                {insights.today_calories} kcal
              </span>
            </div>
          )}
        </div>

        {/* Expandable Full Telemetry & Progressive Overload Drawer */}
        {showInsightsDrawer && (
          <div className="mt-1 pt-2 pb-1 border-t border-dark-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in slide-in-from-top-2 text-xs">
            <div className="p-2.5 rounded-xl bg-dark-850/80 border border-dark-700/70 space-y-1">
              <div className="font-bold text-zinc-200 flex items-center justify-between">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Activity className="w-3.5 h-3.5" />
                  Recovery & Nervous System
                </span>
                <span className="text-emerald-400 font-extrabold">{readinessScore} / 100</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                {insights?.days_since_last_train !== undefined
                  ? `${insights.days_since_last_train} day(s) since last session. Acute workload is within productive adaptation range.`
                  : 'Acute training load is within optimal hypertrophy recovery range.'}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-dark-850/80 border border-dark-700/70 space-y-1">
              <div className="font-bold text-zinc-200 flex items-center justify-between">
                <span className="flex items-center gap-1 text-brand-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Progressive Overload
                </span>
                <span className="text-brand-400 font-bold">{targetSplit.split('(')[0]}</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                AI Coach analyzes your last weights and computes target weight/reps for optimal overload.
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

      {/* 2. Scrollable Messages Area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 sm:space-y-4 bg-gradient-to-b from-dark-950/90 via-dark-900 to-dark-950/90 overscroll-contain min-h-0">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2 sm:gap-3 max-w-[95%] sm:max-w-[85%] ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5 ${
                  isUser
                    ? 'bg-brand-500 text-dark-950 font-bold'
                    : 'bg-dark-800 border border-dark-700 text-brand-400'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </div>

              {/* Speech Bubble */}
              <div
                className={`p-3 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-md ${
                  isUser
                    ? 'bg-brand-500 text-dark-950 font-medium rounded-tr-sm'
                    : 'bg-dark-850/95 text-zinc-100 border border-dark-700/80 rounded-tl-sm backdrop-blur-sm'
                }`}
              >
                {/* User Attached Photo Thumbnail */}
                {msg.imageUrl && (
                  <div className="mb-2 relative group rounded-xl overflow-hidden border border-dark-950/30 shadow-inner bg-dark-900">
                    <img
                      src={msg.imageUrl}
                      alt="User photo"
                      className="max-h-56 sm:max-h-72 w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                    />
                    <button
                      onClick={() => setPreviewModalImg(msg.imageUrl || null)}
                      className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-dark-950/80 backdrop-blur text-white text-[10px] font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ZoomIn className="w-3 h-3" />
                      Увеличить
                    </button>
                  </div>
                )}

                <div className="whitespace-pre-wrap select-text">{msg.content}</div>

                <div
                  className={`text-[9px] mt-1.5 text-right font-mono ${
                    isUser ? 'text-dark-950/60 font-semibold' : 'text-zinc-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing / Analyzing Loading Indicator */}
        {chatMutation.isPending && (
          <div className="flex gap-2 sm:gap-3 max-w-[85%] mr-auto items-center animate-in fade-in">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-brand-400 shrink-0">
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="p-3 sm:p-3.5 rounded-2xl bg-dark-850 text-zinc-300 text-xs border border-dark-700/80 rounded-tl-sm flex items-center gap-2.5 shadow-md">
              <Sparkles className="w-4 h-4 text-brand-400 animate-spin" />
              <span>{t('coach.evaluatingPhoto')}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 3. Quick Suggestions Carousel */}
      <div className="px-2.5 sm:px-3 py-1.5 bg-dark-900/90 border-t border-dark-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
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
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 disabled:opacity-50 ${
                isPhotoPrompt
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/40 hover:bg-brand-500/25 font-semibold'
                  : 'bg-dark-800/90 hover:bg-dark-700 text-zinc-300 hover:text-white border border-dark-700/70'
              }`}
            >
              <span>{prompt}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Bottom Sticky Input Form */}
      <footer className="p-2 sm:p-3 bg-dark-950 border-t border-dark-800/90 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex flex-col gap-1.5 max-w-4xl mx-auto"
        >
          {/* Photo Attachment Preview Bar */}
          {attachedPhoto && (
            <div className="px-2.5 py-1.5 bg-dark-900 border border-brand-500/40 rounded-xl flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <img
                  src={attachedPhoto.dataUrl}
                  alt="Attached preview"
                  className="w-10 h-10 object-cover rounded-lg border border-brand-500/50 shadow-sm"
                />
                <div className="text-xs">
                  <p className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                    {t('coach.photoAttached')}
                  </p>
                  <p className="text-[10px] text-zinc-400">Gemini Vision оценит форму и пропорции</p>
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
          <div className="flex items-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsPhotoPickerOpen(true)}
              disabled={chatMutation.isPending}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-center shrink-0 active:scale-95 h-10 ${
                attachedPhoto
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-400 ring-2 ring-brand-500/30'
                  : 'bg-dark-850 hover:bg-dark-800 border-dark-700/90 text-zinc-400 hover:text-brand-400'
              }`}
              title={t('coach.attachPhoto')}
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedPhoto ? 'Добавьте комментарий или вопрос к фото...' : t('coach.placeholder')}
              className="flex-1 bg-dark-850/90 border border-dark-700/90 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500/70 focus:ring-1 focus:ring-brand-500/30 transition-all shadow-inner resize-none max-h-28 min-h-[40px]"
            />

            <button
              type="submit"
              disabled={(!inputMessage.trim() && !attachedPhoto) || chatMutation.isPending}
              className="w-10 h-10 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:bg-dark-800 text-dark-950 disabled:text-zinc-600 font-bold flex items-center justify-center transition-all shadow-md shadow-brand-500/20 active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </footer>

      {/* 5. Smart Photo Picker Modal (In-App Camera / Gallery) */}
      <SmartPhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onPhotoSelected={handlePhotoCaptured}
        title="Фото для ИИ-тренера"
        subtitle="Оценка формы, пропорций или техники упражнений"
      />

      {/* 6. Fullscreen Image Modal / Lightbox */}
      {previewModalImg && (
        <div
          onClick={() => setPreviewModalImg(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
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
