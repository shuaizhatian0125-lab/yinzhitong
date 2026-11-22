'use client';

import * as React from 'react';

type GaugeChartViewProps = {
  score: number;
  valueLevel: string;
};

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 80;
const START_ANGLE = -90;
const END_ANGLE = 90;
const TOTAL_ANGLE = END_ANGLE - START_ANGLE;

const COLOR_ZONES = [
  { from: 0, to: 40, color: '#EF4444', label: '待评估' },
  { from: 40, to: 60, color: '#F59E0B', label: '低价值' },
  { from: 60, to: 80, color: '#86efac', label: '中价值' },
  { from: 80, to: 100, color: '#1e7b4f', label: '高价值' },
];

function polarToCartesian(angle: number, radius: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return {
  x: CENTER + radius * Math.cos(rad),
  y: CENTER + radius * Math.sin(rad),
  };
}

function describeArc(startAngle: number, endAngle: number, radius: number): string {
  const start = polarToCartesian(startAngle, radius);
  const end = polarToCartesian(endAngle, radius);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function getScoreColor(score: number): string {
  for (const zone of COLOR_ZONES) {
  if (score >= zone.from && score < zone.to) return zone.color;
  }
  return COLOR_ZONES[COLOR_ZONES.length - 1].color;
}

export function GaugeChartView({ score, valueLevel }: GaugeChartViewProps) {
  const scoreAngle = START_ANGLE + (score / 100) * TOTAL_ANGLE;
  const needleEnd = polarToCartesian(scoreAngle, RADIUS - 8);
  const needleBase1 = polarToCartesian(scoreAngle + 90, 4);
  const needleBase2 = polarToCartesian(scoreAngle - 90, 4);

  const tickAngles: number[] = [];
  for (let i = 0; i <= 10; i++) {
  tickAngles.push(START_ANGLE + (i / 10) * TOTAL_ANGLE);
  }

  return (
  <div className="flex flex-col items-center">
  <svg width={SIZE} height={SIZE * 0.7} viewBox={`0 0 ${SIZE} ${SIZE * 0.7}`}>
  {/* 颜色分区弧 */}
  {COLOR_ZONES.map((zone) => {
  const zoneStartAngle = START_ANGLE + (zone.from / 100) * TOTAL_ANGLE;
  const zoneEndAngle = START_ANGLE + (zone.to / 100) * TOTAL_ANGLE;
  return (
  <path
  key={zone.label}
  d={describeArc(zoneStartAngle, zoneEndAngle, RADIUS)}
  fill="none"
  stroke={zone.color}
  strokeWidth={12}
  strokeLinecap="butt"
  />
  );
  })}

  {/* 刻度线 */}
  {tickAngles.map((angle, i) => {
  const outer = polarToCartesian(angle, RADIUS + 6);
  const inner = polarToCartesian(angle, RADIUS + 2);
  return (
  <line
  key={`tick-${i}`}
  x1={inner.x}
  y1={inner.y}
  x2={outer.x}
  y2={outer.y}
  stroke="#475569"
  strokeWidth={1}
  />
  );
  })}

  {/* 刻度数值 */}
  {[0, 25, 50, 75, 100].map((val) => {
  const angle = START_ANGLE + (val / 100) * TOTAL_ANGLE;
  const point = polarToCartesian(angle, RADIUS + 18);
  return (
  <text
  key={`tickval-${val}`}
  x={point.x}
  y={point.y}
  fontSize={9}
  fill="#8a97a8"
  textAnchor="middle"
  dominantBaseline="middle"
  >
  {val}
  </text>
  );
  })}

  {/* 指针 */}
  <polygon
  points={`${needleEnd.x},${needleEnd.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
  fill={getScoreColor(score)}
  />

  {/* 中心圆 */}
  <circle cx={CENTER} cy={CENTER} r={6} fill="#0f172a" />

  {/* 评分数值 */}
  <text
  x={CENTER}
  y={CENTER + 28}
  fontSize={24}
  fontWeight={700}
  fill={getScoreColor(score)}
  textAnchor="middle"
  >
  {score}
  </text>
  <text
  x={CENTER}
  y={CENTER + 44}
  fontSize={10}
  fill="#8a97a8"
  textAnchor="middle"
  >
  /100
  </text>
  </svg>

  {/* 价值等级标注 */}
  <div className="flex flex-col items-center gap-1 mt-1">
  <div className="flex items-center gap-2">
  <span className="text-[13px] text-[var(--bz-text-sub)]">综合评分:</span>
  <span className="text-[15px] font-bold" style={{ color: getScoreColor(score) }}>
  {score}/100
  </span>
  </div>
  <div className="flex items-center gap-2">
  <span className="text-[13px] text-[var(--bz-text-sub)]">价值等级:</span>
  <span
  className="bz-badge"
  style={{
  background:
  score >= 80 ? '#edf7f1' : score >= 60 ? '#fbeeee' : score >= 40 ? '#fdf4e7' : '#fdf0ef',
  color: getScoreColor(score),
  borderColor:
  score >= 80 ? '#cfe8da' : score >= 60 ? '#cfd6dd' : score >= 40 ? '#f2ddbd' : '#f2cfcc',
  }}
  >
  {valueLevel}
  </span>
  </div>
  </div>
  </div>
  );
}