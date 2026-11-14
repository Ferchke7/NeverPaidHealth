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
      animationDuration: 500,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#171717',
        borderColor: '#404040',
        borderWidth: 1,
        borderRadius: 10,
        padding: [10, 12],
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: 'rgba(255, 255, 255, 0.03)' },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const std = standards[idx];

          return `
            <div style="min-width: 170px;">
              <div style="font-size: 13px; font-weight: 700; color: #fafafa; margin-bottom: 6px;">
                ${std.name}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; color: #a3a3a3;">1RM:</span>
                <span style="font-size: 13px; font-weight: 700; color: #34d399;">
                  ${std.best1RM > 0 ? `${toUnit(std.best1RM)} ${unitPref}` : '—'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11px; color: #a3a3a3;">Level:</span>
                <span style="font-size: 11px; font-weight: 600; color: #fafafa; text-transform: uppercase;">
                  ${std.level}
                </span>
              </div>
              <div style="border-top: 1px solid #262626; padding-top: 4px; font-size: 10px; color: #737373;">
                Nov: ${toUnit(std.beginner)}${unitPref} · Adv: ${toUnit(std.advanced)}${unitPref} · Elite: ${toUnit(std.elite)}${unitPref}
              </div>
            </div>
          `;
        },
      },
      grid: {
        left: '3%',
        right: '6%',
        bottom: '4%',
        top: '6%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#737373',
          fontSize: 10,
          formatter: `{value} ${unitPref}`,
        },
        splitLine: {
          lineStyle: {
            color: '#262626',
            type: 'solid',
          },
        },
      },
      yAxis: {
        type: 'category',
        data: liftNames,
        axisLine: { lineStyle: { color: '#262626' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#d4d4d4',
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
          barMaxWidth: 18,
          barGap: '-100%',
          itemStyle: {
            color: '#262626',
            borderRadius: [0, 4, 4, 0],
          },
          tooltip: { show: false },
        },
        {
          name: '1RM',
          type: 'bar',
          data: athleteValues,
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: '#34d399',
          },
          label: {
            show: true,
            position: 'right',
            formatter: (p: any) => (p.value > 0 ? `${p.value} ${unitPref}` : ''),
            color: '#d4d4d4',
            fontSize: 10,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [standards, unitPref]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-[#171717] rounded-[14px] border border-[#404040] p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#34d399]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#fafafa]">
              Силовая классификация атлета
            </h4>
          </div>
          <span className="text-[11px] text-[#737373]">Шкала до Elite</span>
        </div>

        <EChartsReact
          option={option}
          style={{ height: '280px', width: '100%' }}
        />
      </div>
    </div>
  );
};
