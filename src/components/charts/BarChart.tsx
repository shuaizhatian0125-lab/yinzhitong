'use client';

import * as React from 'react';
import type { EChartsOption } from 'echarts';
import { Chart } from './Chart';

type BarChartProps = {
  categories: string[];
  series: { name: string; data: number[]; color?: string; stack?: string }[];
  height?: number | string;
  title?: string;
  horizontal?: boolean;
};

export function BarChart({ categories, series, height = 300, title, horizontal }: BarChartProps) {
  const option: EChartsOption = {
    title: title ? { text: title, left: 'left', textStyle: { fontSize: 14, fontWeight: 600 } } : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: '#e2e8f0',
      textStyle: { color: '#0f172a', fontSize: 12 },
    },
    legend: {
      bottom: 0,
      textStyle: { fontSize: 12, color: '#475569' },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    },
    grid: { left: '3%', right: '4%', bottom: '12%', top: title ? '15%' : '8%', containLabel: true },
    xAxis: horizontal
      ? { type: 'value', axisLine: { show: false }, axisLabel: { color: '#475569', fontSize: 12 }, splitLine: { lineStyle: { color: '#eef2f6' } } }
      : { type: 'category', data: categories, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#475569', fontSize: 12 }, axisTick: { show: false } },
    yAxis: horizontal
      ? { type: 'category', data: categories, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#475569', fontSize: 12 }, axisTick: { show: false } }
      : { type: 'value', axisLine: { show: false }, axisLabel: { color: '#475569', fontSize: 12 }, splitLine: { lineStyle: { color: '#eef2f6' } } },
    series: series.map((s) => ({
      name: s.name,
      type: 'bar',
      data: s.data,
      stack: s.stack,
      barWidth: '40%',
      itemStyle: { color: s.color ?? '#cc0000', borderRadius: [2, 2, 0, 0] },
    })),
  };

  return <Chart option={option} height={height} />;
}