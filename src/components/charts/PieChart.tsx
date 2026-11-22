'use client';

import * as React from 'react';
import type { EChartsOption } from 'echarts';
import { Chart } from './Chart';

type PieChartProps = {
  data: { name: string; value: number; color?: string }[];
  height?: number | string;
  title?: string;
  donut?: boolean;
};

export function PieChart({ data, height = 300, title, donut }: PieChartProps) {
  const option: EChartsOption = {
    title: title ? { text: title, left: 'left', textStyle: { fontSize: 14, fontWeight: 600 } } : undefined,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#e2e8f0',
      textStyle: { color: '#0f172a', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      textStyle: { fontSize: 12, color: '#475569' },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    },
    series: [
      {
        type: 'pie',
        radius: donut ? ['40%', '70%'] : '70%',
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: !donut, fontSize: 12, color: '#475569' },
        labelLine: { show: !donut, length: 10, length2: 10 },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: d.color ? { color: d.color } : undefined,
        })),
      },
    ],
  };

  return <Chart option={option} height={height} />;
}