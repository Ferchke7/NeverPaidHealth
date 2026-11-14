import React, { useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { EChartsReact } from '../../../shared/ui/EChartsReact.tsx';
import { WorkoutHistoryItem } from '../../../entities/workout/model/types.ts';
import { kgToLb } from '../../../shared/lib/units.ts';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

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
  const { language } = useTranslation();
  const [viewMode, setViewMode] = useState<'sessions' | 'weekly'>('sessions');

  const lbl = useMemo(() => {
    if (language === 'uz') {
      return {
        title: 'Tonnaj',
        byWeeks: 'Haftalar bo‘yicha',
        bySessions: 'Mashg‘ulotlar bo‘yicha',
        total: 'Jami',
        avg: 'O‘rtacha',
        peak: 'Eng yuqori',
        noData: 'Hajm qayd etilgan mashg‘ulotlar yo‘q',
        caption: 'Ustunlar — tonnaj · yozuvlar: t · «s.» — setlar',
        tonsUnit: 't',
      };
    }
    if (language === 'en') {
      return {
        title: 'Tonnage',
        byWeeks: 'Weekly',
        bySessions: 'By session',
        total: 'Total',
        avg: 'Average',
        peak: 'Peak session',
        noData: 'No workouts with logged volume',
        caption: 'Bars — tonnage · labels: t · «s.» — sets',
        tonsUnit: 't',
      };
    }
    return {
      title: 'Тоннаж',
      byWeeks: 'По неделям',
      bySessions: 'По тренировкам',
      total: 'Всего',
      avg: 'В среднем',
      peak: 'Пиковая тренировка',
      noData: 'Нет завершенных тренировок с объёмом',
      caption: 'Столбцы — тоннаж · подписи: т · «с.» — сеты',
      tonsUnit: 'т',
    };
  }, [language]);

  const processedData = useMemo(() => {
    if (!workouts || workouts.length === 0) return [];

    const valid = workouts
      .filter((w) => w.started_at && (w.total_volume_kg || 0) > 0)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

    if (viewMode === 'sessions') {
      return valid.map((w) => {
        const d = new Date(w.started_at);
        const label = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
        const volume = unitPref === 'lb' ? kgToLb(w.total_volume_kg || 0) : (w.total_volume_kg || 0);
        return {
          label,
          fullDate: w.started_at,
          name: w.name,
          volumeKg: Math.round(volume),
          sets: w.completed_sets_count || 0,
        };
      });
    }

    const weekMap = new Map<string, { volume: number; sets: number; count: number }>();
    for (const w of valid) {
      const d = new Date(w.started_at);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const key = `${String(monday.getDate()).padStart(2, '0')}.${String(monday.getMonth() + 1).padStart(2, '0')}`;

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
      name: `${data.count}`,
      volumeKg: Math.round(data.volume),
      sets: data.sets,
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

  const formatCompact = (val: number) =>
    val >= 1000
      ? `${(val / 1000).toFixed(1)} ${lbl.tonsUnit}`
      : `${val} ${unitPref === 'lb' ? 'lb' : 'кг'}`;

  const option = useMemo<echarts.EChartsOption>(() => {
    if (processedData.length === 0) {
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

    const categories = processedData.map((d) => `${d.label}\n${d.sets} с.`);
    const volumes = processedData.map((d) => d.volumeKg);
    const unitLabel = unitPref === 'lb' ? 'lb' : 'кг';

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
          const item = processedData[idx];
          return `
            <div style="min-width:140px;">
              <div style="font-size:11px;color:#a3a3a3;">${item.label}</div>
              <div style="font-size:12px;color:#fafafa;font-weight:600;margin-bottom:4px;">${item.name}</div>
              <div style="font-size:13px;font-weight:700;color:#34d399;">${item.volumeKg.toLocaleString('ru-RU')} ${unitLabel}</div>
            </div>
          `;
        },
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '6%',
        top: '16%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#262626' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#737373',
          fontSize: 11,
          lineHeight: 16,
        },
      },
      yAxis: {
        type: 'value',
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
          name: lbl.title,
          type: 'bar',
          data: volumes,
          barMaxWidth: 52,
          itemStyle: {
            color: '#34d399',
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: true,
            position: 'top',
            color: '#d4d4d4',
            fontSize: 11,
            formatter: (p: any) =>
              p.value >= 1000
                ? `${(Number(p.value) / 1000).toFixed(1)} ${lbl.tonsUnit}`
                : `${p.value}`,
          },
        },
      ],
    };
  }, [processedData, unitPref, lbl]);

  return (
    <section className={`bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-4 ${className}`}>
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-[#fafafa]">{lbl.title}</h3>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('weekly')}
            className={`min-h-[44px] px-3.5 rounded-[10px] text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'weekly'
                ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                : 'text-[#a3a3a3] hover:text-[#fafafa]'
            }`}
          >
            {lbl.byWeeks}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('sessions')}
            className={`min-h-[44px] px-3.5 rounded-[10px] text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'sessions'
                ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                : 'text-[#a3a3a3] hover:text-[#fafafa]'
            }`}
          >
            {lbl.bySessions}
          </button>
        </div>
      </div>

      {/* Top 3 Metrics matching Figma 07 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        <div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[#fafafa]">
            {formatCompact(summary.totalVol)}
          </div>
          <div className="text-xs text-[#a3a3a3] mt-0.5">{lbl.total}</div>
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[#fafafa]">
            {formatCompact(summary.avgVol)}
          </div>
          <div className="text-xs text-[#a3a3a3] mt-0.5">{lbl.avg}</div>
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-[#fafafa]">
            {formatCompact(summary.maxVol)}
          </div>
          <div className="text-xs text-[#a3a3a3] mt-0.5">{lbl.peak}</div>
        </div>
      </div>

      <EChartsReact
        option={option}
        style={{ height: '260px', width: '100%' }}
      />

      <p className="text-xs text-[#737373]">{lbl.caption}</p>
    </section>
  );
};
