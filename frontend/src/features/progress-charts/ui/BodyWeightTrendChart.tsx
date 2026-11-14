import React, { useMemo, useState } from 'react';
import * as echarts from 'echarts';
import { EChartsReact } from '../../../shared/ui/EChartsReact.tsx';
import { kgToLb } from '../../../shared/lib/units.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

export interface BodyTrendPoint {
  date: string;
  weight_kg: number;
  sma_7day_kg: number;
}

export interface BodyChartLog {
  log_date: string;
  weight_kg: number;
  body_fat_percentage?: number | null;
  waist_cm?: number | null;
  chest_cm?: number | null;
  arms_cm?: number | null;
  thighs_cm?: number | null;
  neck_cm?: number | null;
}

export type BodyChartMode = 'weight' | 'girths' | 'bodyfat';

interface BodyWeightTrendChartProps {
  trendPoints: BodyTrendPoint[];
  logs?: BodyChartLog[];
  targetWeightKg?: number;
  unitPref: 'kg' | 'lb';
  mode?: BodyChartMode;
  onModeChange?: (mode: BodyChartMode) => void;
  className?: string;
}

export const BodyWeightTrendChart: React.FC<BodyWeightTrendChartProps> = ({
  trendPoints,
  logs = [],
  targetWeightKg,
  unitPref,
  mode: controlledMode,
  onModeChange,
  className = '',
}) => {
  const { t, language } = useTranslation();
  const [internalMode, setInternalMode] = useState<BodyChartMode>('weight');
  const activeMode = controlledMode ?? internalMode;
  const setMode = (next: BodyChartMode) => {
    setInternalMode(next);
    onModeChange?.(next);
  };

  const locale = language === 'uz' ? 'uz-UZ' : language === 'en' ? 'en-US' : 'ru-RU';

  const sortedPoints = useMemo(() => {
    if (!trendPoints || trendPoints.length === 0) return [];
    return [...trendPoints].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [trendPoints]);

  const sortedLogs = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    return [...logs].sort(
      (a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
    );
  }, [logs]);

  const girthsLogs = useMemo(
    () =>
      sortedLogs.filter(
        (l) =>
          (l.waist_cm != null && l.waist_cm > 0) ||
          (l.chest_cm != null && l.chest_cm > 0) ||
          (l.arms_cm != null && l.arms_cm > 0) ||
          (l.thighs_cm != null && l.thighs_cm > 0) ||
          (l.neck_cm != null && l.neck_cm > 0)
      ),
    [sortedLogs]
  );

  const bodyFatLogs = useMemo(
    () =>
      sortedLogs.filter(
        (l) => l.body_fat_percentage != null && l.body_fat_percentage > 0
      ),
    [sortedLogs]
  );

  const entryCount =
    activeMode === 'weight'
      ? sortedPoints.length
      : activeMode === 'girths'
      ? girthsLogs.length
      : bodyFatLogs.length;

  const option = useMemo<echarts.EChartsOption>(() => {
    const emptyOption = (): echarts.EChartsOption => ({
      backgroundColor: 'transparent',
      title: {
        text: t('body.noTrendPoints'),
        left: 'center',
        top: 'center',
        textStyle: { color: '#737373', fontSize: 13, fontWeight: 'normal' },
      },
    });

    if (activeMode === 'girths') {
      if (girthsLogs.length === 0) return emptyOption();
      const dates = girthsLogs.map((l) =>
        new Date(l.log_date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
      );

      const defs: Array<{
        key: keyof Pick<BodyChartLog, 'waist_cm' | 'chest_cm' | 'arms_cm' | 'thighs_cm' | 'neck_cm'>;
        name: string;
        color: string;
      }> = [
        { key: 'waist_cm', name: t('body.waistCm'), color: '#34d399' },
        { key: 'chest_cm', name: t('body.chestCm'), color: '#fafafa' },
        { key: 'arms_cm', name: t('body.armsCm'), color: '#fbbf24' },
        { key: 'thighs_cm', name: t('body.hipsCm'), color: '#f87171' },
        { key: 'neck_cm', name: t('body.neckCm'), color: '#a3a3a3' },
      ];

      const seriesList = defs
        .filter((d) => girthsLogs.some((l) => l[d.key] != null && Number(l[d.key]) > 0))
        .map((d) => ({
          name: d.name,
          type: 'line' as const,
          smooth: 0.25,
          connectNulls: true,
          symbolSize: 6,
          itemStyle: { color: d.color },
          lineStyle: { width: 2.5, color: d.color },
          data: girthsLogs.map((l) => (l[d.key] != null ? Number(l[d.key]) : null)),
        }));

      return {
        backgroundColor: 'transparent',
        animationDuration: 450,
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#171717',
          borderColor: '#404040',
          borderWidth: 1,
          borderRadius: 10,
          textStyle: { color: '#fafafa', fontSize: 12 },
        },
        legend: {
          top: 0,
          right: 0,
          textStyle: { color: '#a3a3a3', fontSize: 11 },
        },
        grid: { left: '2%', right: '4%', bottom: '4%', top: '18%', containLabel: true },
        xAxis: {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#262626' } },
          axisTick: { show: false },
          axisLabel: { color: '#737373', fontSize: 10, fontFamily: 'monospace' },
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#737373', fontSize: 10, fontFamily: 'monospace', formatter: '{value} cm' },
          splitLine: { lineStyle: { color: '#262626', type: 'dashed' } },
        },
        series: seriesList,
      };
    }

    if (activeMode === 'bodyfat') {
      if (bodyFatLogs.length === 0) return emptyOption();
      const dates = bodyFatLogs.map((l) =>
        new Date(l.log_date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
      );
      const values = bodyFatLogs.map((l) => Math.round((l.body_fat_percentage || 0) * 10) / 10);
      return {
        backgroundColor: 'transparent',
        animationDuration: 450,
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#171717',
          borderColor: '#404040',
          borderWidth: 1,
          borderRadius: 10,
          textStyle: { color: '#fafafa', fontSize: 12 },
          valueFormatter: (val) => `${val}%`,
        },
        grid: { left: '2%', right: '4%', bottom: '4%', top: '14%', containLabel: true },
        xAxis: {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#262626' } },
          axisTick: { show: false },
          axisLabel: { color: '#737373', fontSize: 10, fontFamily: 'monospace' },
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#737373', fontSize: 10, fontFamily: 'monospace', formatter: '{value}%' },
          splitLine: { lineStyle: { color: '#262626', type: 'dashed' } },
        },
        series: [
          {
            name: t('body.bodyFat'),
            type: 'line',
            data: values,
            smooth: 0.3,
            symbolSize: 6,
            itemStyle: { color: '#34d399', borderColor: '#0a0a0a', borderWidth: 1.5 },
            lineStyle: { width: 2.5, color: '#34d399' },
            areaStyle: { color: 'rgba(52, 211, 153, 0.08)' },
          },
        ],
      };
    }

    // Default: Weight & 7d SMA
    if (sortedPoints.length === 0) return emptyOption();

    const dates = sortedPoints.map((p) => {
      const d = new Date(p.date);
      return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    });

    const dailyWeights = sortedPoints.map((p) => {
      const w = unitPref === 'lb' ? kgToLb(p.weight_kg) : p.weight_kg;
      return Math.round(w * 10) / 10;
    });

    const smaWeights = sortedPoints.map((p) => {
      const w =
        unitPref === 'lb' ? kgToLb(p.sma_7day_kg || p.weight_kg) : p.sma_7day_kg || p.weight_kg;
      return Math.round(w * 10) / 10;
    });

    const unitLabel = unitPref.toUpperCase();
    const smaLabel = language === 'uz' ? 'SMA 7k' : language === 'en' ? '7-Day SMA' : 'Тренд · SMA 7';
    const dailyLabel = language === 'uz' ? 'Kunlik vazn' : language === 'en' ? 'Daily Weight' : 'Замер дня';
    const targetLabelText = language === 'uz' ? 'Maqsad' : language === 'en' ? 'Target' : 'Цель';

    const targetVal = targetWeightKg
      ? Math.round((unitPref === 'lb' ? kgToLb(targetWeightKg) : targetWeightKg) * 10) / 10
      : null;

    const seriesList: any[] = [
      {
        name: dailyLabel,
        type: 'line',
        data: dailyWeights,
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: '#737373', borderColor: '#0a0a0a', borderWidth: 1 },
        lineStyle: { width: 1.5, color: '#737373', type: 'dotted' },
      },
      {
        name: smaLabel,
        type: 'line',
        data: smaWeights,
        smooth: 0.35,
        symbol: 'none',
        lineStyle: {
          width: 2.5,
          color: '#34d399',
        },
        areaStyle: {
          color: 'rgba(52, 211, 153, 0.08)',
        },
      },
    ];

    if (targetVal) {
      seriesList.push({
        name: targetLabelText,
        type: 'line',
        data: [],
        markLine: {
          symbol: 'none',
          data: [{ yAxis: targetVal, name: targetLabelText }],
          lineStyle: { color: '#34d399', type: 'dashed', width: 1.5 },
          label: {
            formatter: `${targetLabelText}: ${targetVal} ${unitLabel}`,
            color: '#34d399',
            fontSize: 10,
            fontFamily: 'monospace',
          },
        },
      });
    }

    return {
      backgroundColor: 'transparent',
      animationDuration: 450,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#171717',
        borderColor: '#404040',
        borderWidth: 1,
        borderRadius: 10,
        padding: [10, 12],
        axisPointer: {
          type: 'line',
          lineStyle: { color: '#404040', width: 1, type: 'dashed' },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const idx = params[0].dataIndex;
          const point = sortedPoints[idx];
          const dWeight = dailyWeights[idx];
          const sWeight = smaWeights[idx];

          return `
            <div style="font-family: inherit; min-width: 145px;">
              <div style="font-size: 11px; color: #a3a3a3; margin-bottom: 4px;">
                ${point.date}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 2px;">
                <span style="font-size: 11px; color: #fafafa;">${smaLabel}:</span>
                <span style="font-size: 12px; font-weight: 700; color: #34d399; font-family: monospace;">
                  ${sWeight} ${unitLabel}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <span style="font-size: 11px; color: #a3a3a3;">${dailyLabel}:</span>
                <span style="font-size: 12px; font-weight: 600; color: #fafafa; font-family: monospace;">
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
        textStyle: { color: '#a3a3a3', fontSize: 11 },
        data: [smaLabel, dailyLabel],
      },
      grid: {
        left: '2%',
        right: '4%',
        bottom: '4%',
        top: '18%',
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
          color: '#737373',
          fontSize: 10,
          fontFamily: 'monospace',
          formatter: `{value} ${unitLabel}`,
        },
        splitLine: {
          lineStyle: {
            color: '#262626',
            type: 'dashed',
          },
        },
      },
      series: seriesList,
    };
  }, [activeMode, sortedPoints, girthsLogs, bodyFatLogs, targetWeightKg, unitPref, locale, language, t]);

  const tabs: Array<{ id: BodyChartMode; label: string }> = [
    { id: 'weight', label: t('body.tabWeight') },
    { id: 'girths', label: t('body.tabGirths') },
    { id: 'bodyfat', label: t('body.tabBodyFat') },
  ];

  return (
    <div className={`bg-[#171717] rounded-[14px] border border-[#404040] p-4 sm:p-5 space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262626]">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-semibold text-[#fafafa] tracking-tight">
            {t('body.weightDynamics')}
          </h3>
          <span className="px-2 py-0.5 rounded-[6px] bg-[#0a0a0a] border border-[#262626] text-[11px] font-mono tabular-nums text-[#a3a3a3]">
            {entryCount}
          </span>
        </div>

        <div className="inline-flex rounded-[10px] bg-[#0a0a0a] border border-[#404040] p-1 gap-1 self-start sm:self-auto">
          {tabs.map((tab) => {
            const isSelected = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`min-h-[44px] px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                    : 'text-[#a3a3a3] hover:text-[#fafafa] border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <EChartsReact
        option={option}
        style={{ height: '290px', width: '100%' }}
      />
    </div>
  );
};
