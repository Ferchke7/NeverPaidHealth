import React, { useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { Trophy, TrendingUp, Calendar, Layers, Dumbbell } from 'lucide-react';
import { EChartsReact } from '../../../shared/ui/EChartsReact.tsx';
import { formatWeight, kgToLb } from '../../../shared/lib/units.ts';
import { formatDate } from '../../../shared/lib/dates.ts';

export interface HistoryDataPoint {
  workout_id: string;
  date: string;
  best_weight_kg: number;
  best_e1rm_kg?: number | null;
  total_exercise_volume_kg: number;
}

interface ExerciseProgressionChartProps {
  dataPoints: HistoryDataPoint[];
  exerciseName: string;
  unitPref: 'kg' | 'lb';
  className?: string;
}

type MetricMode = 'weight' | 'e1rm' | 'volume';
type TimeRange = '1m' | '3m' | 'all';

export const ExerciseProgressionChart: React.FC<ExerciseProgressionChartProps> = ({
  dataPoints,
  exerciseName,
  unitPref,
  className = '',
}) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('weight');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  // Filter & sort chronologically
  const filteredPoints = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return [];

    const sorted = [...dataPoints].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (timeRange === 'all') return sorted;

    const now = new Date();
    const daysBack = timeRange === '1m' ? 30 : 90;
    const cutoff = new Date(now.getTime() - daysBack * 86400 * 1000);

    const filtered = sorted.filter((p) => new Date(p.date) >= cutoff);
    return filtered.length > 0 ? filtered : sorted.slice(-5);
  }, [dataPoints, timeRange]);

  // Overall metrics & insights
  const stats = useMemo(() => {
    if (filteredPoints.length === 0) {
      return { pr: 0, initial: 0, growthPct: 0, count: 0 };
    }

    const values = filteredPoints.map((p) => {
      if (metricMode === 'e1rm') return p.best_e1rm_kg || p.best_weight_kg;
      if (metricMode === 'volume') return p.total_exercise_volume_kg;
      return p.best_weight_kg;
    });

    const pr = Math.max(...values);
    const initial = values[0];
    const growth = initial > 0 ? ((values[values.length - 1] - initial) / initial) * 100 : 0;

    return {
      pr,
      initial,
      growthPct: Math.round(growth * 10) / 10,
      count: filteredPoints.length,
    };
  }, [filteredPoints, metricMode]);

  // ECharts Option
  const option = useMemo<echarts.EChartsOption>(() => {
    if (filteredPoints.length === 0) {
      return {
        backgroundColor: 'transparent',
        title: {
          text: 'Нет записей для графика',
          left: 'center',
          top: 'center',
          textStyle: { color: '#64748b', fontSize: 13, fontFamily: 'monospace' },
        },
      };
    }

    const dates = filteredPoints.map((p) => {
      const d = new Date(p.date);
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    });

    const values = filteredPoints.map((p) => {
      let raw = p.best_weight_kg;
      if (metricMode === 'e1rm') raw = p.best_e1rm_kg || p.best_weight_kg;
      if (metricMode === 'volume') raw = p.total_exercise_volume_kg;
      const converted = unitPref === 'lb' ? kgToLb(raw) : raw;
      return Math.round(converted * 10) / 10;
    });

    const unitLabel = unitPref.toUpperCase();
    const metricTitle =
      metricMode === 'weight'
        ? 'Лучший рабочий вес'
        : metricMode === 'e1rm'
        ? 'Расчётный 1RM'
        : 'Объём сессии (Тоннаж)';

    // Theme color based on metric
    const colorHex =
      metricMode === 'weight'
        ? '#22c55e'
        : metricMode === 'e1rm'
        ? '#f59e0b'
        : '#38bdf8';

    const areaColor =
      metricMode === 'weight'
        ? 'rgba(34, 197, 94, '
        : metricMode === 'e1rm'
        ? 'rgba(245, 158, 11, '
        : 'rgba(56, 189, 248, ';

    return {
      backgroundColor: 'transparent',
      animationDuration: 900,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        borderRadius: 14,
        padding: [10, 14],
        extraCssText: 'box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6); backdrop-filter: blur(12px);',
        axisPointer: {
          type: 'cross',
          crossStyle: { color: '#3b82f6', width: 1, type: 'dashed' },
          label: {
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            fontFamily: 'monospace',
            borderRadius: 6,
          },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const item = params[0];
          const rawPoint = filteredPoints[item.dataIndex];
          const curVal = item.value;
          const prevVal = item.dataIndex > 0 ? values[item.dataIndex - 1] : null;
          const diff = prevVal !== null ? Math.round((curVal - prevVal) * 10) / 10 : null;

          let diffHtml = '';
          if (diff !== null) {
            const isPos = diff >= 0;
            diffHtml = `
              <div style="font-size: 11px; font-weight: bold; margin-top: 4px; color: ${
                isPos ? '#4ade80' : '#f87171'
              }; font-family: monospace;">
                ${isPos ? '▲ +' : '▼ '}${diff} ${unitLabel} (${isPos ? '+' : ''}${Math.round(
              (diff / (prevVal || 1)) * 100
            )}%)
              </div>
            `;
          }

          return `
            <div style="font-family: inherit; min-width: 140px;">
              <div style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 4px;">
                ${formatDate(rawPoint.date)}
              </div>
              <div style="display: flex; items-center; justify-content: space-between; gap: 12px;">
                <span style="font-size: 11px; color: #cbd5e1;">${metricTitle}:</span>
                <span style="font-size: 13px; font-weight: 800; color: ${colorHex}; font-family: monospace;">
                  ${curVal} ${unitLabel}
                </span>
              </div>
              ${diffHtml}
            </div>
          `;
        },
      },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '4%',
        top: '12%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          fontFamily: 'monospace',
          margin: 10,
        },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          fontFamily: 'monospace',
          formatter: `{value} ${unitLabel}`,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: metricTitle,
          type: 'line',
          data: values,
          smooth: 0.35,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: (val) => {
            // Highlight all-time peak with bigger symbol
            const isMax = val === Math.max(...values);
            return isMax ? 10 : 6;
          },
          itemStyle: {
            color: colorHex,
            borderWidth: 2,
            borderColor: '#0f172a',
          },
          lineStyle: {
            width: 3.5,
            color: colorHex,
            shadowColor: `${areaColor} 0.5)`,
            shadowBlur: 14,
            shadowOffsetY: 4,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${areaColor} 0.35)` },
              { offset: 0.8, color: `${areaColor} 0.04)` },
              { offset: 1, color: `${areaColor} 0.0)` },
            ]),
          },
          markPoint: {
            symbol: 'pin',
            symbolSize: 42,
            data: [{ type: 'max', name: 'PR' }],
            itemStyle: {
              color: '#f59e0b',
              shadowColor: 'rgba(245, 158, 11, 0.5)',
              shadowBlur: 10,
            },
            label: {
              formatter: 'PR',
              fontSize: 10,
              fontWeight: 'bold',
              color: '#0f172a',
            },
          },
        },
      ],
    };
  }, [filteredPoints, metricMode, timeRange, unitPref]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Filter and Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Metric Modes: Weight vs 1RM vs Volume */}
        <div className="flex items-center gap-1 bg-dark-900/90 p-1 rounded-xl border border-dark-750">
          <button
            type="button"
            onClick={() => setMetricMode('weight')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              metricMode === 'weight'
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>Вес снаряда</span>
          </button>

          <button
            type="button"
            onClick={() => setMetricMode('e1rm')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              metricMode === 'e1rm'
                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Расчётный 1RM</span>
          </button>

          <button
            type="button"
            onClick={() => setMetricMode('volume')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              metricMode === 'volume'
                ? 'bg-sky-500/15 border border-sky-500/40 text-sky-400 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Объём (Тоннаж)</span>
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1 bg-dark-900/90 p-1 rounded-xl border border-dark-750 self-start sm:self-auto">
          {(['1m', '3m', 'all'] as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                timeRange === r
                  ? 'bg-dark-750 text-white border border-dark-600 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {r === '1m' ? '1 мес' : r === '3m' ? '3 мес' : 'Все'}
            </button>
          ))}
        </div>
      </div>

      {/* Main ECharts Canvas Card */}
      <div className="bg-dark-950/80 rounded-2xl border border-dark-750 p-4 shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-1 border-b border-dark-800/80 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">
              {exerciseName}
            </h4>
          </div>

          <span className="text-[11px] font-mono text-zinc-500">
            {stats.count} {stats.count === 1 ? 'сессия' : 'сессий'}
          </span>
        </div>

        {/* ECharts Component */}
        <EChartsReact
          option={option}
          style={{ height: '310px', width: '100%' }}
        />

        {/* Micro KPI Strip Below Chart */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-dark-800/80">
          <div className="p-2.5 rounded-xl bg-dark-900/70 border border-dark-750/70 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase font-bold text-zinc-500">Рекорд (PR)</div>
              <div className="text-sm font-mono font-black text-amber-400">
                {stats.pr > 0 ? formatWeight(stats.pr, unitPref) : '—'}
              </div>
            </div>
            <Trophy className="w-4 h-4 text-amber-400/50" />
          </div>

          <div className="p-2.5 rounded-xl bg-dark-900/70 border border-dark-750/70 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase font-bold text-zinc-500">Прирост</div>
              <div
                className={`text-sm font-mono font-black ${
                  stats.growthPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {stats.growthPct >= 0 ? `+${stats.growthPct}%` : `${stats.growthPct}%`}
              </div>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-400/50" />
          </div>

          <div className="p-2.5 rounded-xl bg-dark-900/70 border border-dark-750/70 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase font-bold text-zinc-500">Старт</div>
              <div className="text-sm font-mono font-black text-zinc-300">
                {stats.initial > 0 ? formatWeight(stats.initial, unitPref) : '—'}
              </div>
            </div>
            <Calendar className="w-4 h-4 text-zinc-500" />
          </div>
        </div>
      </div>
    </div>
  );
};
