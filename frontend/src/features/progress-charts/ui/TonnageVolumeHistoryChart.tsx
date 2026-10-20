import React, { useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { BarChart3 } from 'lucide-react';
import { EChartsReact } from '../../../shared/ui/EChartsReact.tsx';
import { WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { kgToLb } from '../../../shared/lib/units.ts';

interface TonnageVolumeHistoryChartProps {
  workouts: WorkoutHistoryItem[];
  unitPref: 'kg' | 'lb';
  className?: string;
}

export const TonnageVolumeHistoryChart: React.FC<TonnageVolumeHistoryChartProps> = ({
  workouts,
  unitPref,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'sessions' | 'weekly'>('sessions');

  const processedData = useMemo(() => {
    if (!workouts || workouts.length === 0) return [];

    // Filter finished workouts and sort ascending by date
    const valid = workouts
      .filter((w) => w.started_at && (w.total_volume_kg || 0) > 0)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

    if (viewMode === 'sessions') {
      return valid.map((w) => {
        const d = new Date(w.started_at);
        const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const volume = unitPref === 'lb' ? kgToLb(w.total_volume_kg || 0) : (w.total_volume_kg || 0);
        const durationMins = Math.round((w.duration_seconds || 0) / 60);
        return {
          label,
          fullDate: w.started_at,
          name: w.name,
          volumeKg: Math.round(volume),
          sets: w.completed_sets_count || 0,
          durationMins,
        };
      });
    }

    // Weekly aggregation
    const weekMap = new Map<string, { volume: number; sets: number; count: number }>();
    for (const w of valid) {
      const d = new Date(w.started_at);
      // Start of week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const key = monday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

      const prev = weekMap.get(key) || { volume: 0, sets: 0, count: 0 };
      const v = unitPref === 'lb' ? kgToLb(w.total_volume_kg || 0) : (w.total_volume_kg || 0);
      weekMap.set(key, {
        volume: prev.volume + v,
        sets: prev.sets + (w.completed_sets_count || 0),
        count: prev.count + 1,
      });
    }

    return Array.from(weekMap.entries()).map(([key, data]) => ({
      label: key,
      fullDate: key,
      name: `${data.count} тренировок`,
      volumeKg: Math.round(data.volume),
      sets: data.sets,
      durationMins: 0,
    }));
  }, [workouts, viewMode, unitPref]);

  const summary = useMemo(() => {
    if (processedData.length === 0) return { totalVol: 0, avgVol: 0, maxVol: 0 };
    const vols = processedData.map((d) => d.volumeKg);
    const total = vols.reduce((a, b) => a + b, 0);
    return {
      totalVol: total,
      avgVol: Math.round(total / vols.length),
      maxVol: Math.max(...vols),
    };
  }, [processedData]);

  const option = useMemo<echarts.EChartsOption>(() => {
    if (processedData.length === 0) {
      return {
        backgroundColor: 'transparent',
        title: {
          text: 'Нет завершенных тренировок с объёмом',
          left: 'center',
          top: 'center',
          textStyle: { color: '#64748b', fontSize: 13, fontFamily: 'monospace' },
        },
      };
    }

    const categories = processedData.map((d) => d.label);
    const volumes = processedData.map((d) => d.volumeKg);
    const sets = processedData.map((d) => d.sets);
    const unitLabel = unitPref.toUpperCase();

    return {
      backgroundColor: 'transparent',
      animationDuration: 850,
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
          type: 'shadow',
          shadowStyle: { color: 'rgba(34, 197, 94, 0.08)' },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const item = processedData[idx];

          return `
            <div style="font-family: inherit; min-width: 150px;">
              <div style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 2px;">
                ${item.label}
              </div>
              <div style="font-size: 12px; color: #ffffff; font-weight: bold; margin-bottom: 6px;">
                ${item.name}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <span style="font-size: 11px; color: #cbd5e1;">Тоннаж:</span>
                <span style="font-size: 13px; font-weight: 800; color: #38bdf8; font-family: monospace;">
                  ${item.volumeKg.toLocaleString('ru-RU')} ${unitLabel}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 3px;">
                <span style="font-size: 11px; color: #cbd5e1;">Сетов:</span>
                <span style="font-size: 12px; font-weight: 700; color: #4ade80; font-family: monospace;">
                  ${item.sets}
                </span>
              </div>
              ${
                item.durationMins > 0
                  ? `<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 3px;">
                      <span style="font-size: 11px; color: #cbd5e1;">Время:</span>
                      <span style="font-size: 11px; font-weight: 600; color: #cbd5e1; font-family: monospace;">
                        ${item.durationMins} мин
                      </span>
                    </div>`
                  : ''
              }
            </div>
          `;
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
        data: ['Тоннаж (Объём)', 'Сеты'],
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: '4%',
        top: '16%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          fontFamily: 'monospace',
          margin: 10,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: unitLabel,
          nameTextStyle: { color: '#64748b', fontSize: 10, fontFamily: 'monospace' },
          scale: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#64748b',
            fontSize: 10,
            fontFamily: 'monospace',
            formatter: (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`),
          },
          splitLine: {
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.05)',
              type: 'dashed',
            },
          },
        },
        {
          type: 'value',
          name: 'Сеты',
          nameTextStyle: { color: '#64748b', fontSize: 10, fontFamily: 'monospace' },
          scale: true,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: '#64748b',
            fontSize: 10,
            fontFamily: 'monospace',
          },
        },
      ],
      series: [
        {
          name: 'Тоннаж (Объём)',
          type: 'bar',
          data: volumes,
          barMaxWidth: 24,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#38bdf8' },
              { offset: 1, color: 'rgba(56, 189, 248, 0.2)' },
            ]),
          },
          markPoint: {
            symbol: 'pin',
            symbolSize: 40,
            data: [{ type: 'max', name: 'Max' }],
            itemStyle: {
              color: '#38bdf8',
              shadowColor: 'rgba(56, 189, 248, 0.6)',
              shadowBlur: 10,
            },
            label: {
              formatter: 'TOP',
              fontSize: 9,
              fontWeight: 'bold',
              color: '#0f172a',
            },
          },
        },
        {
          name: 'Сеты',
          type: 'line',
          yAxisIndex: 1,
          data: sets,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: {
            color: '#22c55e',
          },
          lineStyle: {
            width: 2.5,
            color: '#22c55e',
            shadowColor: 'rgba(34, 197, 94, 0.4)',
            shadowBlur: 8,
          },
        },
      ],
    };
  }, [processedData, unitPref]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Controls & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-400" />
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200">
            Динамика объёма и тоннажа
          </h4>
        </div>

        <div className="flex items-center gap-1 bg-dark-900/90 p-1 rounded-xl border border-dark-750 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('sessions')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'sessions'
                ? 'bg-dark-750 text-white border border-dark-600 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            По тренировкам
          </button>
          <button
            type="button"
            onClick={() => setViewMode('weekly')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'weekly'
                ? 'bg-dark-750 text-white border border-dark-600 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            По неделям
          </button>
        </div>
      </div>

      {/* Main ECharts Card */}
      <div className="bg-dark-950/80 rounded-2xl border border-dark-750 p-4 shadow-xl relative overflow-hidden">
        <EChartsReact
          option={option}
          style={{ height: '300px', width: '100%' }}
        />

        {/* Micro stats footer */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-dark-800/80">
          <div className="p-2.5 rounded-xl bg-dark-900/70 border border-dark-750/70">
            <div className="text-[10px] uppercase font-bold text-zinc-500">Общий объём</div>
            <div className="text-sm font-mono font-black text-sky-400 mt-0.5">
              {summary.totalVol > 1000
                ? `${(summary.totalVol / 1000).toFixed(1)} т`
                : `${summary.totalVol} ${unitPref}`}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-dark-900/70 border border-dark-750/70">
            <div className="text-[10px] uppercase font-bold text-zinc-500">В среднем / тренировка</div>
            <div className="text-sm font-mono font-black text-emerald-400 mt-0.5">
              {summary.avgVol > 1000
                ? `${(summary.avgVol / 1000).toFixed(1)} т`
                : `${summary.avgVol} ${unitPref}`}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-dark-900/70 border border-dark-750/70">
            <div className="text-[10px] uppercase font-bold text-zinc-500">Пиковый объём</div>
            <div className="text-sm font-mono font-black text-amber-400 mt-0.5">
              {summary.maxVol > 1000
                ? `${(summary.maxVol / 1000).toFixed(1)} т`
                : `${summary.maxVol} ${unitPref}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
