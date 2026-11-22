'use client';

import * as React from 'react';

type CompareData = {
  scale: number;
  tech: number;
  growth: number;
  risk: number;
};

type IndustryAvg = {
  scale: number;
  tech: number;
  growth: number;
  risk: number;
};

type IndustryCompareBarViewProps = {
  enterpriseData: CompareData;
  industryAvg: IndustryAvg;
};

const WIDTH = 320;
const HEIGHT = 200;
const PADDING = { top: 20, right: 20, bottom: 30, left: 40 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

const DIMENSIONS = [
  { key: 'scale', label: '规模' },
  { key: 'tech', label: '技术' },
  { key: 'growth', label: '成长' },
  { key: 'risk', label: '风险' },
] as const;

const BAR_WIDTH = 14;
const BAR_GAP = 4;
const GROUP_GAP = 30;

function getGroupX(index: number): number {
  const groupWidth = BAR_WIDTH * 2 + BAR_GAP;
  const totalGroupsWidth = DIMENSIONS.length * groupWidth + (DIMENSIONS.length - 1) * GROUP_GAP;
  const startX = PADDING.left + (PLOT_WIDTH - totalGroupsWidth) / 2;
  return startX + index * (groupWidth + GROUP_GAP);
}

function getBarY(value: number): number {
  return PADDING.top + PLOT_HEIGHT - (value / 100) * PLOT_HEIGHT;
}

function getBarHeight(value: number): number {
  return (value / 100) * PLOT_HEIGHT;
}

export function IndustryCompareBarView({ enterpriseData, industryAvg }: IndustryCompareBarViewProps) {
  const yTicks = [0, 25, 50, 75, 100];

  return (
  <div className="flex flex-col items-center">
  <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
  {/* Y轴刻度线和标签 */}
  {yTicks.map((tick) => {
  const y = PADDING.top + PLOT_HEIGHT - (tick / 100) * PLOT_HEIGHT;
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
  {tick}
  </text>
  </React.Fragment>
  );
  })}

  {/* 柱状图 */}
  {DIMENSIONS.map((dim, i) => {
  const groupX = getGroupX(i);
  const entValue = enterpriseData[dim.key];
  const avgValue = industryAvg[dim.key];

  const entBarX = groupX;
  const avgBarX = groupX + BAR_WIDTH + BAR_GAP;
  const entBarY = getBarY(entValue);
  const avgBarY = getBarY(avgValue);
  const entBarH = getBarHeight(entValue);
  const avgBarH = getBarHeight(avgValue);

  return (
  <React.Fragment key={dim.key}>
  {/* 企业值柱子 */}
  <rect
  x={entBarX}
  y={entBarY}
  width={BAR_WIDTH}
  height={Math.max(entBarH, 2)}
  rx={2}
  fill="#cc0000"
  />
  <text
  x={entBarX + BAR_WIDTH / 2}
  y={entBarY - 4}
  fontSize={9}
  fontWeight={600}
  fill="#cc0000"
  textAnchor="middle"
  >
  {entValue}
  </text>

  {/* 行业均值柱子 */}
  <rect
  x={avgBarX}
  y={avgBarY}
  width={BAR_WIDTH}
  height={Math.max(avgBarH, 2)}
  rx={2}
  fill="#cbd5e1"
  />
  <text
  x={avgBarX + BAR_WIDTH / 2}
  y={avgBarY - 4}
  fontSize={9}
  fontWeight={500}
  fill="#8a97a8"
  textAnchor="middle"
  >
  {avgValue}
  </text>

  {/* 维度标签 */}
  <text
  x={groupX + BAR_WIDTH + BAR_GAP / 2}
  y={HEIGHT - PADDING.bottom + 14}
  fontSize={11}
  fontWeight={500}
  fill="#475569"
  textAnchor="middle"
  >
  {dim.label}
  </text>
  </React.Fragment>
  );
  })}
  </svg>

  {/* 图例 */}
  <div className="flex items-center gap-4 mt-2">
  <div className="flex items-center gap-1.5">
  <span
  className="inline-block w-2.5 h-2.5 rounded-sm"
  style={{ background: '#cc0000' }}
  />
  <span className="text-[11px] text-[var(--bz-text-sub)]">企业值</span>
  </div>
  <div className="flex items-center gap-1.5">
  <span
  className="inline-block w-2.5 h-2.5 rounded-sm"
  style={{ background: '#cbd5e1' }}
  />
  <span className="text-[11px] text-[var(--bz-text-sub)]">行业均值</span>
  </div>
  </div>
  </div>
  );
}