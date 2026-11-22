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
        backgroundColor: '#FFFFFF',
        borderColor: '#ECEAF6',
        borderWidth: 1,
        borderRadius: 12,
        padding: [10, 12],
        axisPointer: {
          type: 'shadow',
          shadowStyle: { color: 'rgba(109, 40, 217, 0.05)' },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const std = standards[idx];

          return `
            <div style="min-width: 170px;">
              <div style="font-size: 13px; font-weight: 700; color: #1E1B4B; margin-bottom: 6px;">
                ${std.name}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; color: #6B7280;">1RM:</span>
                <span style="font-size: 13px; font-weight: 700; color: #6D28D9;">
                  ${std.best1RM > 0 ? `${toUnit(std.best1RM)} ${unitPref}` : '—'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11px; color: #6B7280;">Level:</span>
                <span style="font-size: 11px; font-weight: 600; color: #1E1B4B; text-transform: uppercase;">
                  ${std.level}
                </span>
              </div>
              <div style="border-top: 1px solid #ECEAF6; padding-top: 4px; font-size: 10px; color: #6B7280;">
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
          color: '#6B7280',
          fontSize: 10,
          formatter: `{value} ${unitPref}`,
        },
        splitLine: {
          lineStyle: {
            color: '#ECEAF6',
            type: 'solid',
          },
        },
      },
      yAxis: {
        type: 'category',
        data: liftNames,
        axisLine: { lineStyle: { color: '#ECEAF6' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#1E1B4B',
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
            color: '#F4F3FA',
            borderRadius: [0, 6, 6, 0],
          },
          tooltip: { show: false },
        },
        {
          name: '1RM',
          type: 'bar',
          data: athleteValues,
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: '#6D28D9',
          },
          label: {
            show: true,
            position: 'right',
            formatter: (p: any) => (p.value > 0 ? `${p.value} ${unitPref}` : ''),
            color: '#1E1B4B',
            fontSize: 10,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [standards, unitPref]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-white rounded-[22px] border border-[#ECEAF6] p-5 space-y-3 royal-card-shadow">
        <div className="flex items-center justify-between pb-2 border-b border-[#ECEAF6]">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#6D28D9]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E1B4B]">
              Силовая классификация атлета
            </h4>
          </div>
          <span className="text-[11px] font-medium text-[#6B7280]">Шкала до Elite</span>
        </div>

        <EChartsReact
          option={option}
          style={{ height: '280px', width: '100%' }}
        />
      </div>
    </div>
  );
};
