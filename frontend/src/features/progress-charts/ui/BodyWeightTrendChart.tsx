import React, { useMemo } from 'react';
import * as echarts from 'echarts';
import { Scale } from 'lucide-react';
import { EChartsReact } from '../../../shared/ui/EChartsReact.tsx';
import { kgToLb } from '../../../shared/lib/units.ts';

interface BodyTrendPoint {
  date: string;
  weight_kg: number;
  sma_7day_kg: number;
}

interface BodyWeightTrendChartProps {
  trendPoints: BodyTrendPoint[];
  targetWeightKg?: number;
  unitPref: 'kg' | 'lb';
  className?: string;
}

export const BodyWeightTrendChart: React.FC<BodyWeightTrendChartProps> = ({
  trendPoints,
  targetWeightKg,
  unitPref,
  className = '',
}) => {
  const sortedPoints = useMemo(() => {
    if (!trendPoints || trendPoints.length === 0) return [];
    return [...trendPoints].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [trendPoints]);

  const option = useMemo<echarts.EChartsOption>(() => {
    if (sortedPoints.length === 0) {
      return {
        backgroundColor: 'transparent',
        title: {
          text: 'Нет записей веса тела. Внесите первое взвешивание.',
          left: 'center',
          top: 'center',
          textStyle: { color: '#64748b', fontSize: 13, fontFamily: 'monospace' },
        },
      };
    }

    const dates = sortedPoints.map((p) => {
      const d = new Date(p.date);
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    });

    const dailyWeights = sortedPoints.map((p) => {
      const w = unitPref === 'lb' ? kgToLb(p.weight_kg) : p.weight_kg;
      return Math.round(w * 10) / 10;
    });

    const smaWeights = sortedPoints.map((p) => {
      const w = unitPref === 'lb' ? kgToLb(p.sma_7day_kg || p.weight_kg) : (p.sma_7day_kg || p.weight_kg);
      return Math.round(w * 10) / 10;
    });

    const unitLabel = unitPref.toUpperCase();

    const targetVal = targetWeightKg
      ? Math.round((unitPref === 'lb' ? kgToLb(targetWeightKg) : targetWeightKg) * 10) / 10
      : null;

    const seriesList: any[] = [
      {
        name: 'Ежедневный вес',
        type: 'line',
        data: dailyWeights,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#64748b', borderColor: '#0f172a', borderWidth: 1.5 },
        lineStyle: { width: 1.5, color: '#64748b', type: 'dotted' },
      },
      {
        name: 'Тренд (7-дн. среднее)',
        type: 'line',
        data: smaWeights,
        smooth: 0.35,
        symbol: 'none',
        lineStyle: {
          width: 3.5,
          color: '#38bdf8',
          shadowColor: 'rgba(56, 189, 248, 0.5)',
          shadowBlur: 14,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(56, 189, 248, 0.35)' },
            { offset: 1, color: 'rgba(56, 189, 248, 0.0)' },
          ]),
        },
      },
    ];

    if (targetVal) {
      seriesList.push({
        name: 'Целевой вес',
        type: 'line',
        data: [],
        markLine: {
          symbol: 'none',
          data: [{ yAxis: targetVal, name: 'Цель' }],
          lineStyle: { color: '#22c55e', type: 'dashed', width: 2 },
          label: {
            formatter: `Цель: ${targetVal} ${unitLabel}`,
            color: '#22c55e',
            fontSize: 10,
            fontFamily: 'monospace',
            fontWeight: 'bold',
          },
        },
      });
    }

    return {
      backgroundColor: 'transparent',
      animationDuration: 800,
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
          crossStyle: { color: '#38bdf8', width: 1, type: 'dashed' },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const point = sortedPoints[idx];
          const dWeight = dailyWeights[idx];
          const sWeight = smaWeights[idx];

          return `
            <div style="font-family: inherit; min-width: 150px;">
              <div style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 4px;">
                ${point.date}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 3px;">
                <span style="font-size: 11px; color: #cbd5e1;">Тренд (7-дн):</span>
                <span style="font-size: 13px; font-weight: 800; color: #38bdf8; font-family: monospace;">
                  ${sWeight} ${unitLabel}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <span style="font-size: 11px; color: #94a3b8;">Замер дня:</span>
                <span style="font-size: 12px; font-weight: 700; color: #94a3b8; font-family: monospace;">
                  ${dWeight} ${unitLabel}
                </span>
              </div>
            </div>
          `;
        },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
        data: ['Тренд (7-дн. среднее)', 'Ежедневный вес'],
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
      series: seriesList,
    };
  }, [sortedPoints, targetWeightKg, unitPref]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-dark-950/80 rounded-2xl border border-dark-750 p-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-dark-800/80 mb-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand-400" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200">
              График динамики веса тела
            </h4>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {sortedPoints.length} записей
          </span>
        </div>

        <EChartsReact
          option={option}
          style={{ height: '300px', width: '100%' }}
        />
      </div>
    </div>
  );
};
