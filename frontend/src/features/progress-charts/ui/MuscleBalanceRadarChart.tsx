import React, { useMemo } from 'react';
import * as echarts from 'echarts';
import { Layers } from 'lucide-react';
import { EChartsReact } from '../../../shared/ui/EChartsReact.tsx';
import { Badge } from '../../../shared/ui/card.tsx';

interface MuscleBalanceRadarChartProps {
  muscleSets: Record<string, number>;
  targetSets?: number;
  className?: string;
}

export const MuscleBalanceRadarChart: React.FC<MuscleBalanceRadarChartProps> = ({
  muscleSets,
  targetSets = 16,
  className = '',
}) => {
  const entries = useMemo(() => {
    return Object.entries(muscleSets).map(([muscle, sets]) => ({
      muscle,
      sets,
      pct: Math.min(150, Math.round((sets / targetSets) * 100)),
      status:
        sets >= 10 && sets <= 20
          ? { label: 'Оптимум (MEV–MRV)', variant: 'success' as const }
          : sets > 20
          ? { label: 'Высокая нагрузка', variant: 'warning' as const }
          : sets > 0
          ? { label: 'Поддержка (MV)', variant: 'info' as const }
          : { label: 'Без нагрузки', variant: 'neutral' as const },
    }));
  }, [muscleSets, targetSets]);

  const maxSetsFound = useMemo(() => {
    const vals = Object.values(muscleSets);
    return Math.max(22, ...vals);
  }, [muscleSets]);

  const option = useMemo<echarts.EChartsOption>(() => {
    const indicatorList = entries.map((e) => ({
      name: e.muscle,
      max: maxSetsFound,
    }));

    const actualValues = entries.map((e) => e.sets);
    const benchmarkValues = entries.map(() => targetSets);

    return {
      backgroundColor: 'transparent',
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        borderRadius: 14,
        padding: [10, 14],
        textStyle: { color: '#f8fafc', fontSize: 12, fontFamily: 'monospace' },
        extraCssText: 'box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6); backdrop-filter: blur(12px);',
      },
      legend: {
        bottom: 0,
        itemGap: 20,
        textStyle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
        data: [
          { name: 'Ваш объём сетов', icon: 'circle', itemStyle: { color: '#22c55e' } },
          { name: 'Ориентир (16 сетов)', icon: 'circle', itemStyle: { color: '#f59e0b' } },
        ],
      },
      radar: {
        indicator: indicatorList,
        shape: 'polygon',
        splitNumber: 4,
        center: ['50%', '48%'],
        radius: '68%',
        axisName: {
          color: '#cbd5e1',
          fontSize: 11,
          fontWeight: 'bold',
          padding: [2, 6],
          borderRadius: 4,
          backgroundColor: 'rgba(30, 41, 59, 0.6)',
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.08)',
            type: 'dashed',
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(15, 23, 42, 0.6)', 'rgba(30, 41, 59, 0.3)'],
          },
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
      series: [
        {
          name: 'Баланс мышечных групп',
          type: 'radar',
          data: [
            {
              value: benchmarkValues,
              name: 'Ориентир (16 сетов)',
              symbol: 'none',
              lineStyle: {
                width: 2,
                color: '#f59e0b',
                type: 'dashed',
              },
              itemStyle: {
                color: '#f59e0b',
              },
            },
            {
              value: actualValues,
              name: 'Ваш объём сетов',
              symbol: 'circle',
              symbolSize: 6,
              itemStyle: {
                color: '#22c55e',
                borderColor: '#ffffff',
                borderWidth: 1.5,
              },
              lineStyle: {
                width: 3,
                color: '#22c55e',
                shadowColor: 'rgba(34, 197, 94, 0.5)',
                shadowBlur: 12,
              },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(34, 197, 94, 0.45)' },
                  { offset: 1, color: 'rgba(56, 189, 248, 0.15)' },
                ]),
              },
            },
          ],
        },
      ],
    };
  }, [entries, maxSetsFound, targetSets]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left: Radar Chart */}
        <div className="lg:col-span-7 bg-dark-950/80 rounded-2xl border border-dark-750 p-4 shadow-xl relative overflow-hidden flex flex-col justify-center items-center">
          <div className="w-full flex items-center justify-between pb-2 border-b border-dark-800/80 mb-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-400" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200">
                Радар баланса гипертрофии
              </h4>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">MEV-MRV модель</span>
          </div>

          <EChartsReact
            option={option}
            style={{ height: '330px', width: '100%' }}
          />
        </div>

        {/* Right: Detailed breakdown pills */}
        <div className="lg:col-span-5 space-y-2.5">
          {entries.map((item) => (
            <div
              key={item.muscle}
              className="p-3 rounded-xl bg-dark-900/80 border border-dark-750 hover:border-dark-600 transition-all space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200">{item.muscle}</span>
                <Badge variant={item.status.variant} size="sm">
                  {item.status.label}
                </Badge>
              </div>

              {/* Custom Mini Glowing Bar */}
              <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    item.status.variant === 'success'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/30'
                      : item.status.variant === 'warning'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-sm shadow-amber-500/30'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, item.pct)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>
                  <strong className="text-white">{item.sets}</strong> сетов
                </span>
                <span className="text-zinc-500">цель: 12–16 сетов</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
