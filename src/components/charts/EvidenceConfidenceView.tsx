'use client';

import * as React from 'react';

type EvidenceItem = {
  finding: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
};

type EvidenceConfidenceViewProps = {
  evidence: EvidenceItem[];
};

const CONFIDENCE_CONFIG = {
  high: { color: '#1e7b4f', label: '高置信', bg: '#edf7f1', border: '#cfe8da', percent: 100 },
  medium: { color: '#55677a', label: '中置信', bg: '#fbeeee', border: '#cfd6dd', percent: 66 },
  low: { color: '#8a97a8', label: '低置信', bg: '#f1f5f9', border: '#e2e8f0', percent: 33 },
} as const;

const WIDTH = 280;
const HEIGHT = 160;
const BAR_HEIGHT = 16;
const BAR_GAP = 8;
const PADDING = { top: 16, left: 60, right: 16 };

export function EvidenceConfidenceView({ evidence }: EvidenceConfidenceViewProps) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const ev of evidence) {
  if (ev.confidence === 'high') counts.high++;
  else if (ev.confidence === 'medium') counts.medium++;
  else counts.low++;
  }
  const total = evidence.length || 1;
  const percentages = {
  high: Math.round((counts.high / total) * 100),
  medium: Math.round((counts.medium / total) * 100),
  low: Math.round((counts.low / total) * 100),
  };

  const bars = [
  { key: 'high', label: '高置信', count: counts.high, pct: percentages.high, config: CONFIDENCE_CONFIG.high },
  { key: 'medium', label: '中置信', count: counts.medium, pct: percentages.medium, config: CONFIDENCE_CONFIG.medium },
  { key: 'low', label: '低置信', count: counts.low, pct: percentages.low, config: CONFIDENCE_CONFIG.low },
  ] as const;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;

  return (
  <div className="flex flex-col items-center">
  <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
  {bars.map((bar, i) => {
  const y = PADDING.top + i * (BAR_HEIGHT + BAR_GAP);
  const barWidth = Math.max((bar.pct / 100) * plotWidth, 2);

  return (
  <React.Fragment key={bar.key}>
  {/* 标签 */}
  <text
  x={PADDING.left - 6}
  y={y + BAR_HEIGHT / 2}
  fontSize={11}
  fontWeight={500}
  fill="#475569"
  textAnchor="end"
  dominantBaseline="middle"
  >
  {bar.label}
  </text>

  {/* 背景条 */}
  <rect
  x={PADDING.left}
  y={y}
  width={plotWidth}
  height={BAR_HEIGHT}
  rx={3}
  fill="#f1f5f9"
  />

  {/* 数据条 */}
  <rect
  x={PADDING.left}
  y={y}
  width={barWidth}
  height={BAR_HEIGHT}
  rx={3}
  fill={bar.config.color}
  />

  {/* 数值标注 */}
  <text
  x={PADDING.left + barWidth + 4}
  y={y + BAR_HEIGHT / 2}
  fontSize={10}
  fontWeight={600}
  fill={bar.config.color}
  dominantBaseline="middle"
  >
  {bar.count}条 ({bar.pct}%)
  </text>
  </React.Fragment>
  );
  })}
  </svg>

  {/* 总数标注 */}
  <div className="mt-2 text-[11px] text-[var(--bz-text-muted)]">
  共 {evidence.length} 条证据
  </div>
  </div>
  );
}