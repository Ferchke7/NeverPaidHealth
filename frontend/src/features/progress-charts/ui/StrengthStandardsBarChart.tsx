import React, { useMemo } from 'react';
import * as echarts from 'echarts';
import { Shield } from 'lucide-react';
import { EChartsReact } from '../../../shared/ui/EChartsReact.tsx';
import { kgToLb } from '../../../shared/lib/units.ts';

interface StrengthStandardItem {
  name: string;
  best1RM: number;
  level: string;
  progressPct: number;
  badgeColor: string;
  beginner: number;
  intermediate: number;
  advanced: number;
  elite: number;
}

interface StrengthStandardsBarChartProps {
  standards: StrengthStandardItem[];
  unitPref: 'kg' | 'lb';
  className?: string;
}

export const StrengthStandardsBarChart: React.FC<StrengthStandardsBarChartProps> = ({
  standards,
  unitPref,
  className = '',
}) => {
  const option = useMemo<echarts.EChartsOption>(() => {
    const toUnit = (valKg: number) =>
      unitPref === 'lb' ? Math.round(kgToLb(valKg)) : valKg;

    const liftNames = standards.map((s) => s.name);
    const athleteValues = standards.map((s) => toUnit(s.best1RM));
    const eliteValues = standards.map((s) => toUnit(s.elite));

    return {
      backgroundColor: 'transparent',
      animationDuration: 1000,
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
          shadowStyle: { color: 'rgba(255, 255, 255, 0.04)' },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const std = standards[idx];

          return `
            <div style="font-family: inherit; min-width: 170px;">
              <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">
                ${std.name}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; color: #94a3b8;">Ваш 1RM:</span>
                <span style="font-size: 13px; font-weight: 800; color: #4ade80; font-family: monospace;">
                  ${std.best1RM > 0 ? `${toUnit(std.best1RM)} ${unitPref}` : 'Нет данных'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11px; color: #94a3b8;">Ранг:</span>
                <span style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">
                  ${std.level}
                </span>
              </div>
              <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; font-size: 10px; color: #64748b; font-family: monospace;">
                Nov: ${toUnit(std.beginner)}${unitPref} • Adv: ${toUnit(std.advanced)}${unitPref} • Elite: ${toUnit(std.elite)}${unitPref}
              </div>
            </div>
          `;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '4%',
        top: '6%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          fontFamily: 'monospace',
          formatter: `{value} ${unitPref}`,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)',
            type: 'dashed',
          },
        },
      },
      yAxis: {
        type: 'category',
        data: liftNames,
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#cbd5e1',
          fontSize: 11,
          fontWeight: 'bold',
          width: 140,
          overflow: 'truncate',
        },
      },
      series: [
        {
          name: 'Elite Standard',
          type: 'bar',
          data: eliteValues,
          barMaxWidth: 20,
          barGap: '-100%',
          itemStyle: {
            color: 'rgba(255, 255, 255, 0.04)',
            borderRadius: [0, 8, 8, 0],
          },
          tooltip: { show: false },
        },
        {
          name: 'Ваш 1RM',
          type: 'bar',
          data: athleteValues,
          barMaxWidth: 20,
          itemStyle: {
            borderRadius: [0, 8, 8, 0],
            color: (params: any) => {
              const std = standards[params.dataIndex];
              if (std.level === 'Elite') {
                return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: '#f59e0b' },
                  { offset: 1, color: '#fbbf24' },
                ]);
              }
              if (std.level === 'Advanced') {
                return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: '#a855f7' },
                  { offset: 1, color: '#c084fc' },
                ]);
              }
              if (std.level === 'Intermediate') {
                return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: '#22c55e' },
                  { offset: 1, color: '#4ade80' },
                ]);
              }
              return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#38bdf8' },
                { offset: 1, color: '#60a5fa' },
              ]);
            },
            shadowColor: 'rgba(34, 197, 94, 0.3)',
            shadowBlur: 10,
          },
          label: {
            show: true,
            position: 'right',
            formatter: (p: any) => (p.value > 0 ? `${p.value} ${unitPref}` : ''),
            color: '#cbd5e1',
            fontSize: 10,
            fontFamily: 'monospace',
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [standards, unitPref]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-dark-950/80 rounded-2xl border border-dark-750 p-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-dark-800/80 mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-400" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200">
              Силовая классификация атлета
            </h4>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">Шкала до Elite</span>
        </div>

        <EChartsReact
          option={option}
          style={{ height: '300px', width: '100%' }}
        />
      </div>
    </div>
  );
};
