import React, { useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { EChartsReact } from '../../../shared/ui/EChartsReact.tsx';
import { formatWeight, kgToLb } from '../../../shared/lib/units.ts';
import { formatDate } from '../../../shared/lib/dates.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

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
  unitPref,
  className = '',
}) => {
  const { language } = useTranslation();
  const [metricMode, setMetricMode] = useState<MetricMode>('weight');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const lbl = useMemo(() => {
    if (language === 'uz') {
      return {
        weight: 'Snaryad vazni',
        e1rm: 'Hisoblangan 1RM',
        volume: 'Hajm',
        m1: '1 oy',
        m3: '3 oy',
        all: 'Barchasi',
        noData: 'Grafik uchun ma’lumot yo‘q',
        currentPR: 'Joriy rekord',
        growth: 'Davr boshidan',
        startWeight: 'Boshlang‘ich vazn',
      };
    }
    if (language === 'en') {
      return {
        weight: 'Working Weight',
        e1rm: 'Est. 1RM',
        volume: 'Volume',
        m1: '1 mo',
        m3: '3 mo',
        all: 'All',
        noData: 'No records for chart',
        currentPR: 'Current PR',
        growth: 'Since start',
        startWeight: 'Starting weight',
      };
    }
    return {
      weight: 'Вес снаряда',
      e1rm: 'Расчётный 1RM',
      volume: 'Объём',
      m1: '1 мес',
      m3: '3 мес',
      all: 'Все',
      noData: 'Нет записей для графика',
      currentPR: 'Текущий рекорд',
      growth: 'От начала периода',
      startWeight: 'Стартовый вес',
    };
  }, [language]);

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

  const option = useMemo<echarts.EChartsOption>(() => {
    if (filteredPoints.length === 0) {
      return {
        backgroundColor: 'transparent',
        title: {
          text: lbl.noData,
          left: 'center',
          top: 'center',
          textStyle: { color: '#737373', fontSize: 12 },
        },
      };
    }

    const dates = filteredPoints.map((p) => {
      const d = new Date(p.date);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const values = filteredPoints.map((p) => {
      let raw = p.best_weight_kg;
      if (metricMode === 'e1rm') raw = p.best_e1rm_kg || p.best_weight_kg;
      if (metricMode === 'volume') raw = p.total_exercise_volume_kg;
      const converted = unitPref === 'lb' ? kgToLb(raw) : raw;
      return Math.round(converted * 10) / 10;
    });

    const unitLabel = unitPref === 'lb' ? 'lb' : 'кг';
    const metricTitle =
      metricMode === 'weight' ? lbl.weight : metricMode === 'e1rm' ? lbl.e1rm : lbl.volume;

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
        textStyle: { color: '#fafafa', fontSize: 12 },
        axisPointer: {
          type: 'line',
          lineStyle: { color: '#404040', width: 1, type: 'dashed' },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const item = params[0];
          const rawPoint = filteredPoints[item.dataIndex];
          const curVal = item.value;
          return `
            <div style="min-width:130px;">
              <div style="font-size:11px;color:#a3a3a3;margin-bottom:4px;">${formatDate(rawPoint.date)}</div>
              <div style="display:flex;justify-content:space-between;gap:12px;">
                <span style="font-size:12px;color:#a3a3a3;">${metricTitle}:</span>
                <span style="font-size:13px;font-weight:700;color:#34d399;">${curVal} ${unitLabel}</span>
              </div>
            </div>
          `;
        },
      },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '6%',
        top: '14%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#262626' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#737373',
          fontSize: 11,
          margin: 10,
        },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#737373',
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: '#262626',
            type: 'solid',
          },
        },
      },
      series: [
        {
          name: metricTitle,
          type: 'line',
          data: values,
          smooth: false,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 7,
          itemStyle: {
            color: '#34d399',
            borderWidth: 2,
            borderColor: '#0a0a0a',
          },
          lineStyle: {
            width: 2.5,
            color: '#34d399',
          },
          label: {
            show: true,
            position: 'top',
            color: '#d4d4d4',
            fontSize: 11,
          },
        },
      ],
    };
  }, [filteredPoints, metricMode, unitPref, lbl]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Metric & Time Range Controls matching Figma 06 */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'weight', label: lbl.weight },
              { id: 'e1rm', label: lbl.e1rm },
              { id: 'volume', label: lbl.volume },
            ] as { id: MetricMode; label: string }[]
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setMetricMode(mode.id)}
              className={`min-h-[44px] px-3.5 rounded-[10px] text-xs font-semibold transition-colors cursor-pointer ${
                metricMode === mode.id
                  ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                  : 'bg-transparent text-[#a3a3a3] hover:text-[#fafafa] border border-transparent'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {(['1m', '3m', 'all'] as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setTimeRange(r)}
              className={`min-h-[44px] px-3 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer ${
                timeRange === r
                  ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                  : 'bg-transparent text-[#a3a3a3] hover:text-[#fafafa] border border-transparent'
              }`}
            >
              {r === '1m' ? lbl.m1 : r === '3m' ? lbl.m3 : lbl.all}
            </button>
          ))}
        </div>
      </div>

      {/* ECharts Line Canvas */}
      <div className="w-full pt-1">
        <EChartsReact
          option={option}
          style={{ height: '260px', width: '100%' }}
        />
      </div>

      {/* Bottom 3 Metrics matching Figma 06 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#262626]">
        <div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[#fafafa]">
            {stats.pr > 0 ? formatWeight(stats.pr, unitPref) : '—'}
          </div>
          <div className="text-xs text-[#a3a3a3] mt-0.5">{lbl.currentPR}</div>
        </div>
        <div>
          <div
            className={`text-xl sm:text-2xl font-bold tabular-nums ${
              stats.growthPct >= 0 ? 'text-[#34d399]' : 'text-rose-400'
            }`}
          >
            {stats.growthPct >= 0 ? `+${stats.growthPct}%` : `${stats.growthPct}%`}
          </div>
          <div className="text-xs text-[#a3a3a3] mt-0.5">{lbl.growth}</div>
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[#fafafa]">
            {stats.initial > 0 ? formatWeight(stats.initial, unitPref) : '—'}
          </div>
          <div className="text-xs text-[#a3a3a3] mt-0.5">{lbl.startWeight}</div>
        </div>
      </div>
    </div>
  );
};
