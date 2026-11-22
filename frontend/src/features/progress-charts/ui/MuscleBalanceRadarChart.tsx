import React, { useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { EChartsReact } from '../../../shared/ui/EChartsReact.tsx';
import { useTranslation } from '../../../shared/lib/i18n/i18n.ts';

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
  const { t, language } = useTranslation();
  const [viewMode, setViewMode] = useState<'bars' | 'radar'>('bars');

  const lbl = useMemo(() => {
    if (language === 'uz') {
      return {
        title: 'Haftalik balans',
        subtitle: 'Joriy davr · ishchi yondashuvlar',
        targetNote: 'Mo‘ljal: haftasiga har bir guruh uchun 12–16 set',
        scaleNote: 'Shkala: 0–16 set · yashil ustun — amaldagi hajm',
        opt: 'Optimum',
        high: 'Yuqori yuklama',
        maint: 'Ushlab turish',
        untrained: 'Yuklama yo‘q',
        setsSuffix: 'set',
      };
    }
    if (language === 'en') {
      return {
        title: 'Weekly Balance',
        subtitle: 'Current period · working sets',
        targetNote: 'Target: 12–16 sets per muscle group weekly',
        scaleNote: 'Scale: 0–16 sets · green bar — actual volume',
        opt: 'Optimal',
        high: 'High load',
        maint: 'Maintenance',
        untrained: 'No load',
        setsSuffix: 'sets',
      };
    }
    return {
      title: 'Недельный баланс',
      subtitle: 'Текущая неделя · рабочие подходы',
      targetNote: 'Ориентир: 12–16 сетов на группу в неделю',
      scaleNote: 'Шкала: 0–16 сетов · зелёный столбец — фактический объём',
      opt: 'Оптимум',
      high: 'Высокая нагрузка',
      maint: 'Поддержка',
      untrained: 'Без нагрузки',
      setsSuffix: 'сетов',
    };
  }, [language]);

  const entries = useMemo(() => {
    return Object.entries(muscleSets).map(([muscle, sets]) => {
      const isOpt = sets >= 12 && sets <= 20;
      const isHigh = sets > 20;
      return {
        muscle,
        sets,
        pct: Math.min(100, Math.round((sets / targetSets) * 100)),
        isOptimal: isOpt || isHigh,
        statusLabel: isOpt
          ? lbl.opt
          : isHigh
          ? lbl.high
          : sets > 0
          ? lbl.maint
          : lbl.untrained,
      };
    });
  }, [muscleSets, targetSets, lbl]);

  const maxSetsFound = useMemo(() => {
    const vals = Object.values(muscleSets);
    return Math.max(20, ...vals);
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
      animationDuration: 500,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#FFFFFF',
        borderColor: '#ECEAF6',
        borderWidth: 1,
        borderRadius: 12,
        padding: [10, 12],
        textStyle: { color: '#1E1B4B', fontSize: 12 },
      },
      radar: {
        indicator: indicatorList,
        shape: 'polygon',
        splitNumber: 4,
        center: ['50%', '50%'],
        radius: '68%',
        axisName: {
          color: '#1E1B4B',
          fontSize: 11,
          fontWeight: 'bold',
        },
        splitLine: { lineStyle: { color: '#ECEAF6' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: '#ECEAF6' } },
      },
      series: [
        {
          name: lbl.title,
          type: 'radar',
          data: [
            {
              value: benchmarkValues,
              name: `${targetSets}`,
              symbol: 'none',
              lineStyle: { width: 1.5, color: '#94A3B8', type: 'dashed' },
            },
            {
              value: actualValues,
              name: lbl.title,
              symbol: 'circle',
              symbolSize: 5,
              itemStyle: { color: '#6D28D9' },
              lineStyle: { width: 2.5, color: '#6D28D9' },
              areaStyle: { color: 'rgba(109, 40, 217, 0.16)' },
            },
          ],
        },
      ],
    };
  }, [entries, maxSetsFound, targetSets, lbl]);

  return (
    <section className={`bg-white border border-[#ECEAF6] rounded-[22px] p-5 space-y-4 royal-card-shadow ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-[#1E1B4B]">{lbl.title}</h3>
          <p className="text-xs text-[#6B7280]">{lbl.subtitle}</p>
          <p className="text-xs font-semibold text-[#1E1B4B] pt-1">{lbl.targetNote}</p>
        </div>

        <div className="flex items-center gap-1 bg-[#F4F3FA] p-1 rounded-[12px] border border-[#ECEAF6]">
          <button
            type="button"
            onClick={() => setViewMode('bars')}
            className={`min-h-[38px] px-3 rounded-[9px] text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'bars'
                ? 'bg-white text-[#6D28D9] shadow-xs'
                : 'text-[#6B7280] hover:text-[#1E1B4B]'
            }`}
          >
            {t('progress.barsToggle')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('radar')}
            className={`min-h-[38px] px-3 rounded-[9px] text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'radar'
                ? 'bg-white text-[#6D28D9] shadow-xs'
                : 'text-[#6B7280] hover:text-[#1E1B4B]'
            }`}
          >
            {t('progress.radarToggle')}
          </button>
        </div>
      </div>

      {viewMode === 'bars' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {entries.map((item) => (
              <div key={item.muscle} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-[#1E1B4B]">{item.muscle}</span>
                  <span
                    className={`tabular-nums font-bold ${
                      item.isOptimal ? 'text-[#10B981]' : 'text-[#6D28D9]'
                    }`}
                  >
                    {item.sets} / 12–16 {lbl.setsSuffix}
                  </span>
                </div>
                <div className={`text-xs ${item.isOptimal ? 'text-[#059669]' : 'text-[#6B7280]'}`}>
                  {item.statusLabel}
                </div>
                <div className="w-full h-2 rounded-full bg-[#ECEAF6] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      item.isOptimal ? 'bg-[#10B981]' : 'bg-[#6D28D9]'
                    }`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-[#94A3B8] pt-1">{lbl.scaleNote}</p>
        </>
      ) : (
        <EChartsReact
          option={option}
          style={{ height: '300px', width: '100%' }}
        />
      )}
    </section>
  );
};
