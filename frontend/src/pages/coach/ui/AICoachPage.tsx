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
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface AttachedPhoto {
  dataUrl: string;
  base64: string;
  mimeType: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  imageUrl?: string;
  timestamp: string;
}

const compressImage = (file: File): Promise<AttachedPhoto> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        resolve({ dataUrl, base64, mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const AICoachPage: React.FC = () => {
  const { t, language } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const getInitialGreeting = () => {
    const name = user?.display_name || 'Атлет';
    if (language === 'en') {
      return `Hey ${name}! 🦾 I'm your AI Strength & Conditioning Coach on duda.uz.\n\nI analyze your exercise logs, weekly volume, body metrics, and nutrition. You can also send me a photo of your physique or exercise technique for a detailed visual assessment! How can I help you today?`;
    }
    if (language === 'uz') {
      return `Salom, ${name}! 🦾 Men duda.uz platformasidagi sizning shaxsiy AI murabbiyingizman.\n\nMen mashg'ulotlaringiz, tana ko'rsatkichlaringiz va ovqatlanishingizni tahlil qilaman. Shuningdek, formangiz yoki texnikangizni baholash uchun rasm yuborishingiz mumkin! Bugun sizga qanday yordam bera olaman?`;
    }
    return `Привет, ${name}! 🦾 Я твой персональный ИИ-тренер duda.uz.\n\nЯ анализирую твои поднятые килограммы, недельный тоннаж, замеры тела и рацион. Ты можешь задавать любые вопросы или **отправить фото своей формы / техники**, чтобы я дал честную визуальную оценку и рекомендации! Чем займемся?`;
  };

  const getQuickPrompts = () => {
    if (language === 'en') {
      return [
        '📸 Check my physique photo',
        '🎯 Analyze my progress and plan',
        '🏋️‍♂️ What should I train today?',
        '📈 How to progressive overload on bench?',
        '🔋 Optimal recovery for my volume',
        '🥩 Daily protein and nutrition targets',
      ];
    }
    if (language === 'uz') {
      return [
        '📸 Forma rasmini baholash',
        '🎯 Progressimni tahlil qiling va reja',
        '🏋️‍♂️ Bugun nima mashq qilishim kerak?',
        '📈 Yotib shtanga ko\'tarishda progress',
        '🔋 Tiklanish bo\'yicha maslahatlar',
        '🥩 Kunlik oqsil va kaloriya me\'yori',
      ];
    }
    return [
      '📸 Оценить форму по фото',
      '🎯 Проанализируй мой прогресс и план',
      '🏋️‍♂️ Что мне тренировать сегодня?',
      '📈 Как прогрессировать в жиме лежа?',
      '🔋 Оптимальное восстановление',
      '🥩 Норма белка и калорий',
    ];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'coach',
      content: getInitialGreeting(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedPhoto, setAttachedPhoto] = useState<AttachedPhoto | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Chat Mutation
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
              ? 'Sorry, unable to connect to AI Coach server. Please try again.'
              : language === 'uz'
              ? "Kechirasiz, AI server bilan aloqa uzildi. Iltimos, qayta urinib ko'ring."
              : 'Извини, возникла ошибка связи с ИИ-сервером. Попробуй еще раз!',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    },
  });

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setAttachedPhoto(compressed);
      if (!inputMessage.trim()) {
        setInputMessage(
          language === 'en'
            ? 'Please assess my physique, body composition, and give training/diet advice.'
            : language === 'uz'
            ? 'Mening formam va tana tuzilishimni baholab, mashg\'ulot va ovqatlanish bo\'yicha maslahat bering.'
            : 'Оцени мою форму и телосложение по фото, дай честную оценку и рекомендации по тренировкам и питанию.'
        );
      }
    } catch (err) {
      console.error('Failed to compress image:', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if ((!text && !attachedPhoto) || chatMutation.isPending) return;

    const messageText = text || (
      language === 'en'
        ? 'Please evaluate my physique from this photo.'
        : language === 'uz'
        ? 'Ushbu rasm bo\'yicha formamni baholang.'
        : 'Оцени мою форму по этому фото.'
    );

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
      inputRef.current?.focus();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'coach',
        content: getInitialGreeting(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setAttachedPhoto(null);
  };

  const quickPrompts = getQuickPrompts();

  return (
    <div className="flex flex-col h-full w-full bg-dark-900 md:border md:border-dark-800/80 md:rounded-2xl shadow-2xl overflow-hidden animate-fade-in relative">
      {/* 1. Header Bar */}
      <header className="px-3 sm:px-4 py-2.5 bg-dark-900/95 backdrop-blur-md border-b border-dark-800 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-sm">
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
                Gemini AI
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">Evidence-Based Strength & Hypertrophy</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleClearChat}
            className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 transition-all text-xs flex items-center gap-1.5"
            title="Очистить диалог"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold">{t('common.discard')}</span>
          </button>
        </div>
      </header>

      {/* 2. Scrollable Messages Area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gradient-to-b from-dark-950/80 via-dark-900 to-dark-950 scrollbar-thin scrollbar-thumb-dark-700">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2 sm:gap-3 max-w-[94%] sm:max-w-[85%] ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-sm ${
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

                <div className="whitespace-pre-wrap">{msg.content}</div>

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
                  fileInputRef.current?.click();
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
          <div className="flex items-center gap-1.5 sm:gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={chatMutation.isPending}
              className={`p-2 sm:p-2.5 rounded-xl border transition-all flex items-center justify-center shrink-0 active:scale-95 ${
                attachedPhoto
                  ? 'bg-brand-500/20 border-brand-500/50 text-brand-400 ring-2 ring-brand-500/30'
                  : 'bg-dark-850 hover:bg-dark-800 border-dark-700/90 text-zinc-400 hover:text-brand-400'
              }`}
              title={t('coach.attachPhoto')}
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={attachedPhoto ? 'Добавьте комментарий или вопрос...' : t('coach.placeholder')}
              className="flex-1 bg-dark-850/90 border border-dark-700/90 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500/70 focus:ring-1 focus:ring-brand-500/30 transition-all shadow-inner"
            />

            <button
              type="submit"
              disabled={(!inputMessage.trim() && !attachedPhoto) || chatMutation.isPending}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:bg-dark-800 text-dark-950 disabled:text-zinc-600 font-bold flex items-center justify-center transition-all shadow-md shadow-brand-500/20 active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </footer>

      {/* 5. Fullscreen Image Modal / Lightbox */}
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

