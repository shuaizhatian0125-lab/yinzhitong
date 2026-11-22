'use client';

import * as React from 'react';

type TrendData = {
  years: string[];
  revenueGrowth: number[];
  rdInvestment: number[];
  marketShare: number[];
};

type TrendLineChartViewProps = {
  data: TrendData;
};

const WIDTH = 320;
const HEIGHT = 200;
const PADDING = { top: 20, right: 20, bottom: 30, left: 40 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

const SERIES = [
  { key: 'revenueGrowth', label: '营收增长', color: '#3B82F6' },
  { key: 'rdInvestment', label: '研发投入', color: '#10B981' },
  { key: 'marketShare', label: '市场份额', color: '#F59E0B' },
] as const;

function getMaxValue(allData: number[]): number {
  const max = Math.max(...allData, 10);
  return Math.ceil(max / 10) * 10;
}

function getX(index: number, total: number): number {
  if (total <= 1) return PADDING.left + PLOT_WIDTH / 2;
  return PADDING.left + (index / (total - 1)) * PLOT_WIDTH;
}

function getY(value: number, maxVal: number): number {
  return PADDING.top + PLOT_HEIGHT - (value / maxVal) * PLOT_HEIGHT;
}

export function TrendLineChartView({ data }: TrendLineChartViewProps) {
  const allValues = [...data.revenueGrowth, ...data.rdInvestment, ...data.marketShare];
  const maxVal = getMaxValue(allValues);
  const yTicks = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];

  return (
  <div className="flex flex-col items-center">
  <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
  {/* Y轴刻度线和标签 */}
  {yTicks.map((tick) => {
  const y = getY(tick, maxVal);
  return (
  <React.Fragment key={`ytick-${tick}`}>
  <line
  x1={PADDING.left}
  y1={y}
  x2={PADDING.left + PLOT_WIDTH}
  y2={y}
  stroke="#eef2f6"
  strokeWidth={1}
  />
  <text
  x={PADDING.left - 6}
  y={y}
  fontSize={9}
  fill="#8a97a8"
  textAnchor="end"
  dominantBaseline="middle"
  >
  {tick}%
  </text>
  </React.Fragment>
  );
  })}

  {/* X轴标签 */}
  {data.years.map((year, i) => (
  <text
  key={`x-${year}`}
  x={getX(i, data.years.length)}
  y={HEIGHT - PADDING.bottom + 14}
  fontSize={10}
  fill="#475569"
  textAnchor="middle"
  >
  {year}
  </text>
  ))}

  {/* 三条趋势线 */}
  {SERIES.map((series) => {
  const seriesData = data[series.key];
  const points = seriesData.map((val, i) => ({
  x: getX(i, seriesData.length),
  y: getY(val, maxVal),
  value: val,
  }));

  const pathD = points
  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
  .join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${PADDING.top + PLOT_HEIGHT} L ${points[0].x} ${PADDING.top + PLOT_HEIGHT} Z`;

  return (
  <React.Fragment key={series.key}>
  {/* 填充区域 */}
  <path d={areaD} fill={series.color} opacity={0.06} />

  {/* 折线 */}
  <path
  d={pathD}
  fill="none"
  stroke={series.color}
  strokeWidth={2}
  strokeLinejoin="round"
  strokeLinecap="round"
  />

  {/* 数据点 */}
  {points.map((p, i) => (
  <circle
  key={`${series.key}-${i}`}
  cx={p.x}
  cy={p.y}
  r={3}
  fill={series.color}
  stroke="#fff"
  strokeWidth={1}
  />
  ))}
  </React.Fragment>
  );
  })}
  </svg>

  {/* 图例 */}
  <div className="flex items-center gap-4 mt-2">
  {SERIES.map((series) => (
  <div key={series.key} className="flex items-center gap-1.5">
  <span
  className="inline-block w-2.5 h-2.5 rounded-full"
  style={{ background: series.color }}
  />
  <span className="text-[11px] text-[var(--bz-text-sub)]">{series.label}</span>
  </div>
  ))}
  </div>
  </div>
  );
}