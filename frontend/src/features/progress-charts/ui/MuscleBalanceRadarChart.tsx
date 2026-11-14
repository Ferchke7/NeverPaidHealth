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
        backgroundColor: '#171717',
        borderColor: '#404040',
        borderWidth: 1,
        borderRadius: 10,
        padding: [10, 12],
        textStyle: { color: '#fafafa', fontSize: 12 },
      },
      radar: {
        indicator: indicatorList,
        shape: 'polygon',
        splitNumber: 4,
        center: ['50%', '50%'],
        radius: '68%',
        axisName: {
          color: '#d4d4d4',
          fontSize: 11,
          fontWeight: 'bold',
        },
        splitLine: { lineStyle: { color: '#262626' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: '#262626' } },
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
              lineStyle: { width: 1.5, color: '#737373', type: 'dashed' },
            },
            {
              value: actualValues,
              name: lbl.title,
              symbol: 'circle',
              symbolSize: 5,
              itemStyle: { color: '#34d399' },
              lineStyle: { width: 2, color: '#34d399' },
              areaStyle: { color: 'rgba(52, 211, 153, 0.2)' },
            },
          ],
        },
      ],
    };
  }, [entries, maxSetsFound, targetSets, lbl]);

  return (
    <section className={`bg-[#171717] border border-[#404040] rounded-[14px] p-5 space-y-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-[#fafafa]">{lbl.title}</h3>
          <p className="text-xs text-[#a3a3a3]">{lbl.subtitle}</p>
          <p className="text-xs font-medium text-[#fafafa] pt-1">{lbl.targetNote}</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('bars')}
            className={`min-h-[44px] px-3 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'bars'
                ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                : 'text-[#a3a3a3] hover:text-[#fafafa]'
            }`}
          >
            {t('progress.barsToggle')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('radar')}
            className={`min-h-[44px] px-3 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === 'radar'
                ? 'bg-[#022c22] text-[#34d399] border border-[#064e3b]'
                : 'text-[#a3a3a3] hover:text-[#fafafa]'
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
                  <span className="font-semibold text-[#fafafa]">{item.muscle}</span>
                  <span
                    className={`tabular-nums font-medium ${
                      item.isOptimal ? 'text-[#34d399]' : 'text-[#fafafa]'
                    }`}
                  >
                    {item.sets} / 12–16 {lbl.setsSuffix}
                  </span>
                </div>
                <div className={`text-xs ${item.isOptimal ? 'text-[#34d399]' : 'text-[#a3a3a3]'}`}>
                  {item.statusLabel}
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#262626] overflow-hidden">
                  <div
                    className="h-full bg-[#34d399] rounded-full transition-all duration-300"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-[#737373] pt-1">{lbl.scaleNote}</p>
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
