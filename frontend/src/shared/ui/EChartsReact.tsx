import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export interface EChartsReactProps {
  option: echarts.EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  loading?: boolean;
  onEvents?: Record<string, (params: any) => void>;
}

export const EChartsReact: React.FC<EChartsReactProps> = ({
  option,
  style = { height: '320px', width: '100%' },
  className = '',
  loading = false,
  onEvents,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
      });
    }

    const chart = chartInstance.current;

    if (onEvents) {
      Object.entries(onEvents).forEach(([eventName, handler]) => {
        chart.off(eventName);
        chart.on(eventName, handler);
      });
    }

    if (loading) {
      chart.showLoading({
        text: '...',
        color: '#7C3AED',
        textColor: '#5A5575',
        maskColor: 'rgba(244, 243, 250, 0.75)',
      });
    } else {
      chart.hideLoading();
      chart.setOption(option, { notMerge: true });
    }

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(chartRef.current);

    const handleWindowResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
    };
  }, [option, loading, onEvents]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return <div ref={chartRef} style={style} className={`relative ${className}`} />;
};
