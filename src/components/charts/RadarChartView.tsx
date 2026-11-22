'use client';

import * as React from 'react';

type RadarScores = {
  techInnovation: number;
  growthPotential: number;
  marketSpace: number;
  financialDemand: number;
  riskLevel: number;
};

type RadarChartViewProps = {
  scores: RadarScores;
};

const DIMENSIONS = [
  { key: 'techInnovation', label: '技术创新', shortLabel: '技术' },
  { key: 'growthPotential', label: '成长潜力', shortLabel: '成长' },
  { key: 'marketSpace', label: '市场空间', shortLabel: '市场' },
  { key: 'financialDemand', label: '金融需求', shortLabel: '金融' },
  { key: 'riskLevel', label: '风险等级', shortLabel: '风险' },
] as const;

const SIZE = 280;
const CENTER = SIZE / 2;
const MAX_RADIUS = 90;
const RINGS = [20, 40, 60, 80, 100];

function polarToCartesian(angle: number, radius: number): { x: number; y: number } {
  const rad = (angle - 90) * (Math.PI / 180);
  return {
  x: CENTER + radius * Math.cos(rad),
  y: CENTER + radius * Math.sin(rad),
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#1e7b4f';
  if (score >= 60) return '#cc0000';
  if (score >= 40) return '#b26a00';
  return '#b42318';
}

export function RadarChartView({ scores }: RadarChartViewProps) {
  const angleStep = 360 / DIMENSIONS.length;

  const axisPoints = DIMENSIONS.map((dim, i) => {
  const angle = i * angleStep;
  const point = polarToCartesian(angle, MAX_RADIUS);
  return { ...dim, angle, x: point.x, y: point.y };
  });

  const dataPoints = DIMENSIONS.map((dim, i) => {
  const angle = i * angleStep;
  const score = scores[dim.key];
  const radius = (score / 100) * MAX_RADIUS;
  const point = polarToCartesian(angle, radius);
  return { ...dim, angle, x: point.x, y: point.y, score };
  });

  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
  <div className="flex items-center justify-center">
  <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
  {/* 同心环 */}
  {RINGS.map((ring) => {
  const ringPoints = DIMENSIONS.map((_, i) => {
  const angle = i * angleStep;
  const point = polarToCartesian(angle, (ring / 100) * MAX_RADIUS);
  return `${point.x},${point.y}`;
  }).join(' ');
  return (
  <polygon
  key={ring}
  points={ringPoints}
  fill="none"
  stroke="#e2e8f0"
  strokeWidth={1}
  />
  );
  })}

  {/* 轴线 */}
  {axisPoints.map((axis) => (
  <line
  key={axis.key}
  x1={CENTER}
  y1={CENTER}
  x2={axis.x}
  y2={axis.y}
  stroke="#e2e8f0"
  strokeWidth={1}
  />
  ))}

  {/* 数据填充区域 */}
  <polygon
  points={dataPolygon}
  fill="#cc000033"
  stroke="#cc0000"
  strokeWidth={2}
  strokeLinejoin="round"
  />

  {/* 数据点 */}
  {dataPoints.map((p) => (
  <circle
  key={p.key}
  cx={p.x}
  cy={p.y}
  r={4}
  fill={getScoreColor(p.score)}
  stroke="#fff"
  strokeWidth={1.5}
  />
  ))}

  {/* 维度标签和数值 */}
  {axisPoints.map((axis) => {
  const dataPoint = dataPoints.find((dp) => dp.key === axis.key);
  const labelRadius = MAX_RADIUS + 28;
  const labelPoint = polarToCartesian(axis.angle, labelRadius);
  const scorePoint = polarToCartesian(axis.angle, MAX_RADIUS + 14);
  return (
  <React.Fragment key={axis.key}>
  <text
  x={labelPoint.x}
  y={labelPoint.y}
  textAnchor="middle"
  dominantBaseline="middle"
  fontSize={12}
  fontWeight={600}
  fill="#0f172a"
  >
  {axis.shortLabel}
  </text>
  <text
  x={scorePoint.x}
  y={scorePoint.y}
  textAnchor="middle"
  dominantBaseline="middle"
  fontSize={11}
  fontWeight={700}
  fill={getScoreColor(dataPoint?.score ?? 50)}
  >
  {dataPoint?.score ?? 0}
  </text>
  </React.Fragment>
  );
  })}

  {/* 中心刻度标注 */}
  {RINGS.map((ring) => {
  const point = polarToCartesian(0, (ring / 100) * MAX_RADIUS);
  return (
  <text
  key={`ring-${ring}`}
  x={CENTER + 2}
  y={point.y}
  fontSize={9}
  fill="#8a97a8"
  textAnchor="start"
  >
  {ring}
  </text>
  );
  })}
  </svg>
  </div>
  );
}