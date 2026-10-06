import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  TrendingUp,
  Zap,
  Activity,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  User,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client.ts';
import { Card } from '../../../shared/ui/card.tsx';
import { Button } from '../../../shared/ui/button.tsx';
import { useAuthStore } from '../../../entities/user/model/authStore.ts';

interface Insight {
  id: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  action_item?: string;
}

interface OverloadTarget {
  exercise_id: string;
  exercise_name: string;
  last_best_weight_kg: number;
  last_best_reps: number;
  target_weight_kg: number;
  target_reps: number;
  recommendation: string;
}

interface PlateauAlert {
  exercise_id: string;
  exercise_name: string;
  stagnant_days: number;
  current_1rm_kg: number;
  advice: string;
}

interface MuscleVolume {
  muscle_name: string;
  total_sets: number;
  volume_kg: number;
  percentage: number;
}

interface CoachInsights {
  readiness_score: number;
  recovery_status: string;
  weekly_workouts_count: number;
  weekly_volume_kg: number;
  days_since_last_train: number;
  suggested_split: string;
  overload_targets: OverloadTarget[];
  plateau_alerts: PlateauAlert[];
  muscle_distribution: MuscleVolume[];
  insights: Insight[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  '🎯 Проанализируй мой прогресс и дай советы',
  '🏋️‍♂️ Что мне тренировать сегодня?',
  '📈 Как прогрессировать в жиме лежа?',
  '🛑 Как преодолеть силовое плато?',
  '🥗 Оптимальное восстановление для моего объема',
];

export const AICoachPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'coach',
      content: `Привет, ${user?.display_name || 'Атлет'}! 🦾 Я твой персональный ИИ-тренер duda.uz. Я анализирую каждый твой подход, тоннаж и восстановление, чтобы максимизировать гипертрофию и силу без перетренированности. Чем могу помочь сегодня?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch AI Insights
  const { data: insights, isLoading: isInsightsLoading, refetch: refetchInsights } = useQuery<CoachInsights>({
    queryKey: ['coach', 'insights'],
    queryFn: () => apiClient.get('/coach/insights'),
  });

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
          content: 'Извини, возникла ошибка связи с ИИ-сервером. Попробуй еще раз!',
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
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    return 'text-red-400 border-red-500/40 bg-red-500/10';
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-950/60 via-dark-800 to-dark-800 border border-brand-500/30 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
                <Bot className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">AI Strength Coach</h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-brand-400" /> Evidence-Based
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Personalized progressive overload, recovery tracking & adaptive programming.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetchInsights()}
            className="gap-1.5 text-xs border-dark-600 self-end sm:self-auto"
            disabled={isInsightsLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isInsightsLoading ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Readiness & Recovery Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Readiness Gauge */}
        <Card className="p-5 bg-dark-800/80 border-dark-700/80 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-brand-400" />
              Recovery & Readiness
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getScoreColor(
                insights?.readiness_score || 85
              )}`}
            >
              {insights?.recovery_status || 'Optimal'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-dark-900 border border-dark-700 shadow-inner">
              <span className="text-3xl font-extrabold text-zinc-100">
                {insights?.readiness_score || 85}
              </span>
              <span className="text-xs font-bold text-zinc-500 absolute bottom-2">/ 100</span>
            </div>
            <div className="space-y-1 text-xs text-zinc-300">
              <div className="font-semibold text-zinc-100">CNS Readiness Score</div>
              <div className="text-zinc-400">
                {insights?.days_since_last_train === 0
                  ? 'Trained today. Recovery processes active.'
                  : `${insights?.days_since_last_train || 1} day(s) since last session.`}
              </div>
            </div>
          </div>
        </Card>

        {/* Weekly Volume Load */}
        <Card className="p-5 bg-dark-800/80 border-dark-700/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-400" />
              7-Day Training Load
            </span>
            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              {insights?.weekly_workouts_count || 0} Sessions
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-2xl font-bold text-zinc-100">
              {((insights?.weekly_volume_kg || 0) / 1000).toFixed(1)} <span className="text-sm font-normal text-zinc-400">Tons</span>
            </div>
            <div className="w-full bg-dark-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(10, ((insights?.weekly_workouts_count || 1) / 5) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              Acute workload is within productive adaptation range.
            </p>
          </div>
        </Card>

        {/* Suggested Split for Today */}
        <Card className="p-5 bg-gradient-to-br from-dark-800 to-brand-950/30 border-dark-700/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Target Session Today
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-base font-bold text-zinc-100 leading-snug">
              {insights?.suggested_split || 'Push Day (Chest, Shoulders, Triceps)'}
            </div>
            <p className="text-xs text-zinc-400">
              Optimal rotation based on recovery intervals and muscle group frequency.
            </p>
          </div>
        </Card>
      </div>

      {/* Progressive Overload & Insights Grid */}
      {insights?.overload_targets && insights.overload_targets.length > 0 && (
        <Card className="p-5 bg-dark-800/80 border-dark-700/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              AI Progressive Overload Targets
            </h2>
            <span className="text-xs text-zinc-400">Calculated for next session</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.overload_targets.slice(0, 6).map((target, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-dark-900/80 border border-dark-700/60 hover:border-brand-500/40 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-200 line-clamp-1">
                    {target.exercise_name}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">
                    Last: {target.last_best_weight_kg}kg × {target.last_best_reps}
                  </span>
                  <span className="text-brand-400 font-bold bg-brand-500/10 px-2 py-0.5 rounded">
                    Goal: {target.target_weight_kg}kg × {target.target_reps}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 italic">
                  {target.recommendation}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Interactive AI Coach Chat Terminal */}
      <Card className="p-0 overflow-hidden bg-dark-800/90 border-dark-700/80 flex flex-col shadow-2xl rounded-2xl">
        {/* Chat Header */}
        <div className="px-5 py-3.5 bg-dark-900/90 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
                <Bot className="w-4 h-4" />
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute top-0 right-0 ring-2 ring-dark-900 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                AI Coach Consultation
              </div>
              <div className="text-[10px] text-zinc-400">Live AI Sports Science Assistant</div>
            </div>
          </div>
        </div>

        {/* Chat Messages Log */}
        <div className="p-4 space-y-4 min-h-[300px] max-h-[450px] overflow-y-auto bg-dark-950/40">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    isUser
                      ? 'bg-brand-500 text-dark-950 font-bold'
                      : 'bg-dark-800 border border-dark-700 text-brand-400'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-md ${
                    isUser
                      ? 'bg-brand-500 text-dark-950 font-medium rounded-tr-none'
                      : 'bg-dark-800/90 text-zinc-200 border border-dark-700/80 rounded-tl-none'
                  }`}
                >
                  {msg.content}
                  <div
                    className={`text-[9px] mt-1.5 text-right ${
                      isUser ? 'text-dark-950/60 font-semibold' : 'text-zinc-500'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {chatMutation.isPending && (
            <div className="flex gap-3 max-w-[80%] mr-auto items-center animate-pulse">
              <div className="w-7 h-7 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center text-brand-400">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="p-3 rounded-2xl bg-dark-800 text-zinc-400 text-xs border border-dark-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-400 animate-spin" />
                Тренер анализирует данные и формулирует ответ...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2.5 bg-dark-900/60 border-t border-dark-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt.replace(/^[^\s]+\s/, ''))}
              className="px-3 py-1.5 rounded-full bg-dark-800 hover:bg-dark-700 border border-dark-700 text-xs text-zinc-300 whitespace-nowrap transition-colors flex items-center gap-1 shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-dark-900 border-t border-dark-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Спроси тренера о программе, прогрессии или технике..."
            className="flex-1 bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-brand-500"
          />
          <Button
            type="submit"
            variant="primary"
            className="rounded-xl px-4 py-2.5"
            disabled={!inputMessage.trim() || chatMutation.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
};
