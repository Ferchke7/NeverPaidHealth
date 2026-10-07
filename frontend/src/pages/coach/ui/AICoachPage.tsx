import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Trash2,
  User,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: string;
}

export const AICoachPage: React.FC = () => {
  const { t, language } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const getInitialGreeting = () => {
    const name = user?.display_name || 'Атлет';
    if (language === 'en') {
      return `Hey ${name}! 🦾 I'm your AI Strength & Conditioning Coach on duda.uz.\n\nI analyze your exercise logs, weekly volume, and recovery data to give you science-backed advice on progressive overload, technique, and periodization. How can I help you today?`;
    }
    if (language === 'uz') {
      return `Salom, ${name}! 🦾 Men duda.uz platformasidagi sizning shaxsiy AI murabbiyingizman.\n\nMen sizning mashg'ulotlaringiz, haftalik hajm va tiklanishingizni tahlil qilib, progressiv yuklama va to'g'ri texnika bo'yicha maslahat beraman. Bugun sizga qanday yordam bera olaman?`;
    }
    return `Привет, ${name}! 🦾 Я твой персональный ИИ-тренер duda.uz.\n\nЯ анализирую твои поднятые килограммы, подходы, недельный тоннаж и восстановление, чтобы давать научно обоснованные советы по прогрессивной перегрузке, периодизации и питанию. Чем могу помочь сегодня?`;
  };

  const getQuickPrompts = () => {
    if (language === 'en') {
      return [
        '🎯 Analyze my progress and give advice',
        '🏋️‍♂️ What should I train today?',
        '📈 How to progressive overload on bench press?',
        '🛑 How to break through a strength plateau?',
        '🔋 Optimal recovery for my training volume',
        '🥩 Daily protein and nutrition targets',
      ];
    }
    if (language === 'uz') {
      return [
        "🎯 Progressimni tahlil qiling va maslahat bering",
        "🏋️‍♂️ Bugun nima mashq qilishim kerak?",
        "📈 Yotib shtanga ko'tarishda qanday progress qilish mumkin?",
        "🛑 Kuch to'xtab qolganda (plato) nima qilish kerak?",
        "🔋 Mashg'ulot hajmi uchun optimal tiklanish",
        "🥩 Kunlik oqsil va ovqatlanish me'yori",
      ];
    }
    return [
      '🎯 Проанализируй мой прогресс и дай советы',
      '🏋️‍♂️ Что мне тренировать сегодня?',
      '📈 Как прогрессировать в жиме лежа?',
      '🛑 Как преодолеть силовое плато?',
      '🔋 Оптимальное восстановление для моего объема',
      '🥩 Норма белка и спортивное питание',
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Chat Mutation
  const chatMutation = useMutation({
    mutationFn: (msg: string) =>
      apiClient.post<{ reply: string; suggestions?: string[] }>('/coach/chat', {
        message: msg,
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

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || chatMutation.isPending) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    chatMutation.mutate(text);

    // Focus input back on desktop
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
  };

  const quickPrompts = getQuickPrompts();

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-6rem)] bg-dark-900 border border-dark-800/80 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
      {/* 1. Header Bar */}
      <header className="px-4 py-3 bg-dark-900/95 backdrop-blur-md border-b border-dark-800 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-dark-900 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-tight">
                {t('coach.title')}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-400 border border-brand-500/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-brand-400" />
                Gemini AI
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Evidence-Based Strength & Hypertrophy</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClearChat}
            className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 transition-all text-xs flex items-center gap-1.5"
            title="Очистить диалог"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold">{t('common.discard')}</span>
          </button>
        </div>
      </header>

      {/* 2. Scrollable Messages Area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-gradient-to-b from-dark-950/60 to-dark-900 scrollbar-thin scrollbar-thumb-dark-700">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-[80%] ${
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
                className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-md ${
                  isUser
                    ? 'bg-brand-500 text-dark-950 font-medium rounded-tr-sm'
                    : 'bg-dark-850/90 text-zinc-100 border border-dark-700/80 rounded-tl-sm backdrop-blur-sm'
                }`}
              >
                {msg.content}
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

        {/* Typing Loading Indicator */}
        {chatMutation.isPending && (
          <div className="flex gap-2.5 sm:gap-3 max-w-[80%] mr-auto items-center animate-in fade-in">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-brand-400 shrink-0">
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-dark-850 text-zinc-300 text-xs border border-dark-700/80 rounded-tl-sm flex items-center gap-2 shadow-md">
              <Sparkles className="w-4 h-4 text-brand-400 animate-spin" />
              <span>{t('common.loading')}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 3. Quick Suggestions Carousel */}
      <div className="px-3 sm:px-4 py-2 bg-dark-900/90 border-t border-dark-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt.replace(/^[^\s]+\s/, ''))}
            disabled={chatMutation.isPending}
            className="px-3 py-1.5 rounded-xl bg-dark-800/90 hover:bg-dark-700 text-zinc-300 hover:text-white border border-dark-700/70 text-xs whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 disabled:opacity-50"
          >
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* 4. Bottom Sticky Input Form */}
      <footer className="p-2.5 sm:p-3 bg-dark-950 border-t border-dark-800/90 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 max-w-4xl mx-auto"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={t('coach.placeholder')}
            className="flex-1 bg-dark-850/90 border border-dark-700/90 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500/70 focus:ring-1 focus:ring-brand-500/30 transition-all shadow-inner"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim() || chatMutation.isPending}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:bg-dark-800 text-dark-950 disabled:text-zinc-600 font-bold flex items-center justify-center transition-all shadow-md shadow-brand-500/20 active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
};
