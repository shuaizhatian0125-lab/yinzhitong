'use client';

import * as React from 'react';
import type { EChartsOption } from 'echarts';
import { Chart } from './Chart';

type TrendChartProps = {
  categories: string[];
  series: { name: string; data: number[]; color?: string }[];
  height?: number | string;
  title?: string;
};

export function TrendChart({ categories, series, height = 300, title }: TrendChartProps) {
  const option: EChartsOption = {
    title: title ? { text: title, left: 'left', textStyle: { fontSize: 14, fontWeight: 600 } } : undefined,
    tooltip: {
      trigger: 'axis',
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
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#475569', fontSize: 12 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#475569', fontSize: 12 },
      splitLine: { lineStyle: { color: '#eef2f6' } },
    },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, color: s.color },
      itemStyle: { color: s.color },
      areaStyle: s.color ? { color: s.color, opacity: 0.08 } : undefined,
    })),
  };

  return <Chart option={option} height={height} />;
}