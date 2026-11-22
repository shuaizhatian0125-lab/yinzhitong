'use client';

import * as React from 'react';

type DemandItem = {
  type: string;
  amountRange: string;
  urgency: 'high' | 'medium' | 'low';
};

type DemandDistributionViewProps = {
  demands: DemandItem[];
};

const URGENCY_CONFIG = {
  high: { color: '#EF4444', label: '紧迫', bg: '#fdf0ef', border: '#f2cfcc' },
  medium: { color: '#F59E0B', label: '中等', bg: '#fdf4e7', border: '#f2ddbd' },
  low: { color: '#10B981', label: '较低', bg: '#edf7f1', border: '#cfe8da' },
} as const;

const DEMAND_ICONS: Record<string, string> = {
  '研发融资': '🔬',
  '扩产融资': '🏭',
  '结算需求': '💰',
  '供应链金融': '🔗',
  '国际化金融': '🌐',
};

export function DemandDistributionView({ demands }: DemandDistributionViewProps) {
  if (demands.length === 0) {
  return (
  <div className="flex flex-col items-center justify-center py-8">
  <p className="text-[13px] text-[var(--bz-text-muted)]">暂无识别到的金融需求</p>
  <p className="text-[11px] text-[var(--bz-text-muted)] mt-1">请先执行金融需求识别分析</p>
  </div>
  );
  }

  return (
  <div className="flex flex-col gap-2">
  {demands.map((demand, idx) => {
  const config = URGENCY_CONFIG[demand.urgency] ?? URGENCY_CONFIG.medium;
  const icon = DEMAND_ICONS[demand.type] ?? '📋';

  return (
  <div
  key={`${demand.type}-${idx}`}
  className="flex items-center gap-3 px-3 py-2.5 rounded border"
  style={{
  background: config.bg,
  borderColor: config.border,
  borderRadius: 6,
  }}
  >
  <span className="text-[16px] shrink-0">{icon}</span>
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2">
  <span className="text-[13px] font-medium text-[var(--bz-text)]">{demand.type}</span>
  <span
  className="bz-badge"
  style={{
  background: config.bg,
  color: config.color,
  borderColor: config.border,
  fontSize: 10,
  height: 18,
  }}
  >
  {config.label}
  </span>
  </div>
  <span className="text-[11px] text-[var(--bz-text-sub)] mt-0.5 block">
  预估金额: {demand.amountRange}
  </span>
  </div>
  </div>
  );
  })}
  </div>
  );
}